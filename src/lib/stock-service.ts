import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { emitStockActualizado, emitProductoActualizado } from "@/lib/socket-server";

export interface StockDeductItem {
  dishId?: string;
  name?: string;
  quantity: number;
}

export interface StockDeductResult {
  success: boolean;
  updatedDishes: Array<{
    id: string;
    name: string;
    previousStock: number;
    newStock: number;
    isAvailable: boolean;
  }>;
  error?: string;
}

/**
 * Servicio Centralizado Universal de Deducción de Stock
 * Garantiza validación y descuento atómico de inventario en todos los canales:
 * - Caja POS
 * - Tienda / Catálogo en línea (/ctalo)
 * - Menú Digital de Restaurante (/[slug])
 * - Comandas de Mesas (/mesas)
 * - API de pedidos (/api/pedidos)
 */
export async function deductStockUniversal(
  restaurantId: string,
  items: StockDeductItem[],
  externalTx?: any
): Promise<StockDeductResult> {
  if (!items || items.length === 0) {
    return { success: true, updatedDishes: [] };
  }

  const runWithTx = async (tx: any): Promise<StockDeductResult> => {
    // 1. Recolectar IDs y nombres de platos
    const dishIds = items.map((i) => i.dishId).filter(Boolean) as string[];
    const itemNames = items.map((i) => i.name?.trim()).filter(Boolean) as string[];

    // Buscar platos candidatos en la base de datos pertenecientes al negocio
    const dbDishes = await tx.dish.findMany({
      where: {
        restaurantId,
        OR: [
          dishIds.length > 0 ? { id: { in: dishIds } } : undefined,
          itemNames.length > 0 ? { name: { in: itemNames, mode: "insensitive" } } : undefined,
        ].filter(Boolean) as any,
      },
      select: {
        id: true,
        name: true,
        stock: true,
        trackStock: true,
        isAvailable: true,
        restaurantId: true,
      },
    });

    const dishById = new Map<string, any>(dbDishes.map((d: any) => [d.id, d]));
    const dishByName = new Map<string, any>(
      dbDishes.map((d: any) => [d.name.toLowerCase().trim(), d])
    );

    // 2. FASE 1: Validación estricta previa de existencias
    for (const item of items) {
      const qty = Math.max(1, parseInt(String(item.quantity)) || 1);
      let matchedDish = item.dishId ? dishById.get(item.dishId) : null;
      if (!matchedDish && item.name) {
        matchedDish = dishByName.get(item.name.toLowerCase().trim());
      }

      if (matchedDish) {
        const curStock = typeof matchedDish.stock === "number" ? matchedDish.stock : 0;
        const isAvail = matchedDish.isAvailable !== false;

        // Si el producto no está disponible o no tiene stock suficiente
        if (!isAvail || curStock < qty) {
          throw new Error(
            curStock <= 0
              ? `El producto "${matchedDish.name}" se encuentra agotado en bodega.`
              : `Stock insuficiente para "${matchedDish.name}". Disponible: ${curStock}, solicitado: ${qty}.`
          );
        }
      }
    }

    // 3. FASE 2: Deducción atómica y auto-bloqueo al llegar a 0
    const updatedDishes: StockDeductResult["updatedDishes"] = [];

    for (const item of items) {
      const qty = Math.max(1, parseInt(String(item.quantity)) || 1);
      let matchedDish = item.dishId ? dishById.get(item.dishId) : null;
      if (!matchedDish && item.name) {
        matchedDish = dishByName.get(item.name.toLowerCase().trim());
      }

      if (matchedDish) {
        const curStock = typeof matchedDish.stock === "number" ? matchedDish.stock : 0;
        const newStock = Math.max(0, curStock - qty);
        const isStillAvailable = newStock > 0;

        await tx.dish.update({
          where: { id: matchedDish.id },
          data: {
            stock: newStock,
            trackStock: true, // Forzar activación de control de stock
            isAvailable: isStillAvailable,
          },
        });

        // Actualizar referencia en memoria para ítems duplicados en el mismo pedido
        matchedDish.stock = newStock;
        matchedDish.isAvailable = isStillAvailable;

        updatedDishes.push({
          id: matchedDish.id,
          name: matchedDish.name,
          previousStock: curStock,
          newStock,
          isAvailable: isStillAvailable,
        });
      }
    }

    return { success: true, updatedDishes };
  };

  try {
    let result: StockDeductResult;
    if (externalTx) {
      result = await runWithTx(externalTx);
    } else {
      result = await prisma.$transaction(async (tx) => runWithTx(tx));
    }

    // Notificaciones y revalidaciones en tiempo real
    try {
      revalidatePath("/admin");
      revalidatePath("/caja");
      const rest = await prisma.restaurant.findUnique({
        where: { id: restaurantId },
        select: { slug: true },
      });
      if (rest?.slug) {
        revalidatePath(`/${rest.slug}`);
        revalidatePath(`/ctalo/${rest.slug}`);
      }

      // Emisión de Socket.IO para actualizar todas las pantallas conectadas
      emitStockActualizado(restaurantId, result.updatedDishes);
      for (const d of result.updatedDishes) {
        emitProductoActualizado(restaurantId, {
          id: d.id,
          name: d.name,
          stock: d.newStock,
          isAvailable: d.isAvailable,
          trackStock: true,
        });
      }
    } catch (notifyErr) {
      console.warn("[deductStockUniversal] Error en notificaciones no críticas:", notifyErr);
    }

    return result;
  } catch (err: any) {
    console.error("[deductStockUniversal] Error deduciendo stock:", err);
    return {
      success: false,
      updatedDishes: [],
      error: err?.message || "Error al validar o descontar existencias de stock.",
    };
  }
}
