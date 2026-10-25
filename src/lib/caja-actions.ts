"use server";

import { prisma } from "@/lib/db";
import { getUserSession, getSuperAdminSession, refreshUserSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { emitStockActualizado, emitProductoActualizado } from "@/lib/socket-server";

async function verifyRestaurantOwnership(restaurantId: string): Promise<{ authorized: boolean; error?: string }> {
  const isSuperAdmin = await getSuperAdminSession();
  if (isSuperAdmin) return { authorized: true };

  const session = await getUserSession();
  if (!session || !session.userId) {
    return { authorized: false, error: "No autenticado. Por favor inicie sesión." };
  }

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { id: true, userId: true },
  });

  if (!restaurant) {
    return { authorized: false, error: "Negocio no encontrado." };
  }

  if (restaurant.userId !== session.userId) {
    return { authorized: false, error: "No tiene permisos para modificar este negocio." };
  }

  return { authorized: true };
}

export type ScannedDishResult = {
  found: boolean;
  dish?: {
    id: string;
    name: string;
    price: number;
    stock: number | null;
    trackStock: boolean;
    isAvailable?: boolean;
    barcode: string | null;
    imageUrl: string | null;
  };
  isBox?: boolean;
  unitsPerBox?: number;
  barcode?: string;
  error?: string;
};

/**
 * Busca un producto por código de barras de unidad o código de caja/bulto.
 */
export async function searchDishByBarcodeAction(
  restaurantId: string,
  rawBarcode: string
): Promise<ScannedDishResult> {
  try {
    await refreshUserSession();
    const auth = await verifyRestaurantOwnership(restaurantId);
    if (!auth.authorized) return { found: false, error: auth.error };

    const barcode = rawBarcode.trim();
    if (!barcode) return { found: false, error: "Código vacío" };

    const dishes = await prisma.dish.findMany({
      where: { restaurantId },
      select: {
        id: true,
        name: true,
        price: true,
        stock: true,
        trackStock: true,
        isAvailable: true,
        barcode: true,
        sku: true,
        imageUrl: true,
        variants: true,
      },
    });

    // 1. Coincidencia directa con código de barras de unidad o SKU
    for (const d of dishes) {
      const bCode = d.barcode?.trim();
      const skuCode = d.sku?.trim();
      if ((bCode && bCode === barcode) || (skuCode && skuCode === barcode)) {
        return {
          found: true,
          dish: {
            id: d.id,
            name: d.name,
            price: d.price,
            stock: d.stock,
            trackStock: d.trackStock,
            isAvailable: d.isAvailable,
            barcode: d.barcode,
            imageUrl: d.imageUrl,
          },
          isBox: false,
          unitsPerBox: 1,
        };
      }
    }

    // 2. Coincidencia con código de caja / bulto en variantes JSON
    for (const d of dishes) {
      if (d.variants) {
        try {
          const parsed = typeof d.variants === "string" ? JSON.parse(d.variants) : d.variants;
          if (parsed && typeof parsed === "object") {
            const boxBarcode = (parsed.boxBarcode || parsed.codigo_caja || parsed.boxCode || "")
              .toString()
              .trim();
            if (boxBarcode && boxBarcode === barcode) {
              const units = Number(parsed.unitsPerBox || parsed.unidades_caja || 12) || 12;
              return {
                found: true,
                dish: {
                  id: d.id,
                  name: d.name,
                  price: d.price,
                  stock: d.stock,
                  trackStock: d.trackStock,
                  isAvailable: d.isAvailable,
                  barcode: d.barcode,
                  imageUrl: d.imageUrl,
                },
                isBox: true,
                unitsPerBox: units,
              };
            }
          }
        } catch {}
      }
    }

    return { found: false, barcode };
  } catch (error: any) {
    console.error("Error searching barcode in caja:", error);
    return { found: false, error: "Error al buscar el código de barras." };
  }
}

/**
 * Creación ultrarrápida de un producto desde el escáner POS si no existía.
 */
export async function createQuickDishFromBarcodeAction(
  restaurantId: string,
  data: {
    name: string;
    price: number;
    categoryId?: string;
    barcode: string;
    isBox?: boolean;
    unitsPerBox?: number;
    initialStock?: number;
  }
) {
  try {
    await refreshUserSession();
    const auth = await verifyRestaurantOwnership(restaurantId);
    if (!auth.authorized) return { error: auth.error };

    const name = data.name.trim();
    const barcode = data.barcode.trim();
    if (!name || !barcode) return { error: "El nombre y el código son obligatorios." };

    let categoryId = data.categoryId;
    if (!categoryId) {
      const firstCat = await prisma.category.findFirst({
        where: { restaurantId },
        orderBy: { order: "asc" },
      });
      if (firstCat) {
        categoryId = firstCat.id;
      } else {
        const createdCat = await prisma.category.create({
          data: {
            restaurantId,
            name: "General",
            order: 0,
          },
        });
        categoryId = createdCat.id;
      }
    }

    let variantsJson: string | null = null;
    let unitBarcode: string | null = barcode;

    if (data.isBox) {
      const units = Number(data.unitsPerBox) || 12;
      variantsJson = JSON.stringify({
        boxBarcode: barcode,
        unitsPerBox: units,
      });
      unitBarcode = null;
    }

    const initialStock = typeof data.initialStock === "number" ? data.initialStock : 0;

    const dish = await prisma.dish.create({
      data: {
        restaurantId,
        categoryId,
        name,
        price: Number(data.price) || 0,
        barcode: unitBarcode,
        variants: variantsJson,
        stock: initialStock,
        trackStock: true,
        isAvailable: true,
      },
      select: {
        id: true,
        name: true,
        price: true,
        stock: true,
        trackStock: true,
        barcode: true,
        imageUrl: true,
      },
    });

    revalidatePath("/admin");
    revalidatePath("/caja");

    return {
      success: true,
      dish,
      isBox: Boolean(data.isBox),
      unitsPerBox: data.isBox ? Number(data.unitsPerBox) || 12 : 1,
    };
  } catch (error: any) {
    console.error("Error creating quick dish in caja:", error);
    return { error: "Error al registrar el nuevo producto." };
  }
}

/**
 * Procesa la ENTRADA de inventario (Suma de Stock).
 */
export async function processCajaEntryAction(
  restaurantId: string,
  items: Array<{ dishId: string; quantity: number }>
) {
  try {
    await refreshUserSession();
    const auth = await verifyRestaurantOwnership(restaurantId);
    if (!auth.authorized) return { error: auth.error };

    if (!items || items.length === 0) {
      return { error: "No hay productos en la lista para ingresar." };
    }

    await prisma.$transaction(async (tx) => {
      for (const it of items) {
        const qty = Number(it.quantity) || 0;
        if (qty <= 0) continue;

        const dish = await tx.dish.findUnique({
          where: { id: it.dishId },
          select: { id: true, stock: true, restaurantId: true },
        });

        if (!dish || dish.restaurantId !== restaurantId) continue;

        const currentStock = dish.stock ?? 0;
        const newStock = currentStock + qty;

        await tx.dish.update({
          where: { id: it.dishId },
          data: {
            stock: newStock,
            trackStock: true,
            isAvailable: true,
          },
        });
      }
    });

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { slug: true },
    });

    revalidatePath("/admin");
    revalidatePath("/caja");
    if (restaurant?.slug) revalidatePath(`/${restaurant.slug}`);

    return { success: true, count: items.length };
  } catch (error: any) {
    console.error("Error processing caja entry:", error);
    return { error: "Error al registrar la entrada de productos." };
  }
}

/**
 * Procesa la VENTA de productos (Resta de Stock y Creación de Pedido/Venta Oficial).
 */
export async function processCajaSaleAction(
  restaurantId: string,
  data: {
    items: Array<{ dishId: string; quantity: number; price: number; name: string }>;
    paymentMethod: "EFECTIVO" | "DEUNA" | "TARJETA";
    customerName?: string;
  }
) {
  try {
    await refreshUserSession();
    const auth = await verifyRestaurantOwnership(restaurantId);
    if (!auth.authorized) return { error: auth.error };

    if (!data.items || data.items.length === 0) {
      return { error: "No hay productos en la lista para cobrar." };
    }

    const subtotal = data.items.reduce(
      (acc, it) => acc + (Number(it.price) || 0) * (Number(it.quantity) || 0),
      0
    );

    const result = await prisma.$transaction(async (tx) => {
      // 1. Validar existencias de stock estricto
      for (const it of data.items) {
        const dish = await tx.dish.findUnique({
          where: { id: it.dishId },
          select: { id: true, name: true, stock: true, trackStock: true, isAvailable: true, restaurantId: true },
        });

        if (!dish || dish.restaurantId !== restaurantId) {
          throw new Error(`El producto "${it.name}" no fue encontrado en este negocio.`);
        }

        const currentStock = typeof dish.stock === "number" ? dish.stock : 0;
        if (!dish.isAvailable || currentStock <= 0) {
          throw new Error(`El producto "${dish.name}" se encuentra agotado en bodega.`);
        }

        if (currentStock < it.quantity) {
          throw new Error(
            `Stock insuficiente para "${dish.name}". Disponible en bodega: ${currentStock}, solicitado: ${it.quantity}.`
          );
        }
      }

      // 2. Crear Pedido / Ticket de Venta oficial
      const order = await tx.order.create({
        data: {
          restaurantId,
          tableName: `Caja POS (${data.paymentMethod})`,
          customerName: data.customerName?.trim() || `Venta Directa (${data.paymentMethod})`,
          status: "COMPLETED",
          subtotal,
          iva: 0.0,
          serviceCharge: 0.0,
          tip: 0.0,
          total: subtotal,
          paymentMethod: data.paymentMethod,
          items: {
            create: data.items.map((it) => ({
              dishName: it.name,
              price: it.price,
              quantity: it.quantity,
            })),
          },
        },
      });

      // 3. Descontar Stock y marcar agotado si llega a 0
      const updatedDishes: any[] = [];
      for (const it of data.items) {
        const dish = await tx.dish.findUnique({
          where: { id: it.dishId },
          select: { id: true, name: true, stock: true, trackStock: true, isAvailable: true },
        });

        if (dish) {
          const currentStock = typeof dish.stock === "number" ? dish.stock : 0;
          const newStock = Math.max(0, currentStock - it.quantity);
          const stillAvailable = newStock > 0;

          await tx.dish.update({
            where: { id: it.dishId },
            data: {
              stock: newStock,
              trackStock: true,
              isAvailable: stillAvailable,
            },
          });

          updatedDishes.push({
            id: dish.id,
            name: dish.name,
            stock: newStock,
            isAvailable: stillAvailable,
            trackStock: true,
          });
        }
      }

      return { orderNumber: order.orderNumber, total: subtotal, updatedDishes };
    });

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { slug: true },
    });

    revalidatePath("/admin");
    revalidatePath("/caja");
    if (restaurant?.slug) {
      revalidatePath(`/${restaurant.slug}`);
      revalidatePath(`/ctalo/${restaurant.slug}`);
    }

    // Notificar por Socket.IO en tiempo real
    try {
      emitStockActualizado(restaurantId, result.updatedDishes);
      for (const ud of result.updatedDishes) {
        emitProductoActualizado(restaurantId, ud);
      }
    } catch {}

    return {
      success: true,
      orderNumber: result.orderNumber,
      total: result.total,
    };
  } catch (error: any) {
    console.error("Error processing caja sale:", error);
    return { error: error.message || "Error al procesar el cobro de la venta." };
  }
}
