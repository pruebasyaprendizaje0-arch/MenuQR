"use server";

import { prisma } from "@/lib/db";
import { pool, ensureDbTables } from "@/lib/db-pool";
import { getUserSession, getSuperAdminSession, refreshUserSession } from "@/lib/auth";
import { verifyOrderStaffAuth } from "@/lib/order-auth";
import { revalidatePath } from "next/cache";
import { emitStockActualizado, emitProductoActualizado, emitPedidoActualizado, emitCitaActualizada } from "@/lib/socket-server";
import { __testCajaHooks } from "./caja-test-hooks";

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

export type CustomerSearchResult = {
  id: string;
  name: string;
  phone: string;
  address: string | null;
  notes: string | null;
  totalOrders: number;
};

/**
 * Busca clientes registrados en el CRM para autocompletar ventas por teléfono/caja
 */
export async function searchCustomersForCajaAction(
  restaurantId: string,
  query: string
): Promise<CustomerSearchResult[]> {
  try {
    await refreshUserSession();
    const auth = await verifyRestaurantOwnership(restaurantId);
    if (!auth.authorized) return [];

    const q = query.trim();
    if (!q || q.length < 2) return [];

    const customers = await prisma.customer.findMany({
      where: {
        restaurantId,
        OR: [
          { phone: { contains: q, mode: "insensitive" } },
          { name: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 6,
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        phone: true,
        address: true,
        notes: true,
        totalOrders: true,
      },
    });

    return customers;
  } catch (err) {
    console.error("Error buscando clientes para caja:", err);
    return [];
  }
}

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
    paymentMethod: "EFECTIVO" | "DEUNA" | "PAYPHONE" | "TARJETA" | "TRANSFERENCIA";
    customerName?: string;
    customerPhone?: string;
    customerAddress?: string;
    deliveryCost?: number;
    iva?: number;
    serviceCharge?: number;
    depositDiscount?: number;
    reservationId?: string;
    total?: number;
    tableName?: string;
    splitDetails?: SplitPaymentDetail[];
    partialPayment?: {
      isPartial: boolean;
      montoAbonado: number;
      saldoPendiente: number;
      costoTotal: number;
      treatmentName?: string;
    };
    specialistId?: string;
    specialistName?: string;
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

    const safeIva = typeof data.iva === "number" ? Math.max(0, data.iva) : 0;
    const safeService = typeof data.serviceCharge === "number" ? Math.max(0, data.serviceCharge) : 0;
    const safeDelivery = typeof data.deliveryCost === "number" ? Math.max(0, data.deliveryCost) : 0;
    const safeDeposit = typeof data.depositDiscount === "number" ? Math.max(0, data.depositDiscount) : 0;
    const computedTotal = Math.max(0, Math.round((subtotal + safeIva + safeService + safeDelivery - safeDeposit) * 100) / 100);
    const finalTotal = typeof data.total === "number" && data.total >= 0 ? data.total : computedTotal;

    const result = await prisma.$transaction(async (tx) => {
      let clientPid: number | undefined;
      if (process.env.NODE_ENV === "test") {
        try {
          const pidRows = await tx.$queryRaw<Array<{ pid: number }>>`SELECT pg_backend_pid() AS pid`;
          clientPid = pidRows[0]?.pid;
          if (__testCajaHooks.beforePosSaleLock) {
            await __testCajaHooks.beforePosSaleLock(restaurantId, clientPid);
          }
        } catch {}
      }

      // 0. Exigir turno de caja abierto y bloquearlo pesimísticamente para coordinar con closeCashShift
      const lockedShifts = await tx.$queryRaw<Array<{ id: string; status: string }>>`
        SELECT id, status FROM "CashShift"
        WHERE "restaurantId" = ${restaurantId} AND status = 'OPEN'
        LIMIT 1
        FOR UPDATE
      `;
      const activeShift = lockedShifts[0];

      if (!activeShift) {
        throw new Error("Abre un turno de caja primero.");
      }

      if (process.env.NODE_ENV === "test" && __testCajaHooks.afterPosSaleLock) {
        await __testCajaHooks.afterPosSaleLock(activeShift.id, clientPid);
      }

      // 1. Validar existencias de stock estricto (solo para productos físicos con trackStock activo)
      for (const it of data.items) {
        const dish = await tx.dish.findUnique({
          where: { id: it.dishId },
          select: { id: true, name: true, stock: true, trackStock: true, isAvailable: true, restaurantId: true },
        });

        if (!dish || dish.restaurantId !== restaurantId) {
          throw new Error(`El producto o servicio "${it.name}" no fue encontrado en este negocio.`);
        }

        if (!dish.isAvailable) {
          throw new Error(`"${dish.name}" no se encuentra disponible actualmente.`);
        }

        if (dish.trackStock) {
          const currentStock = typeof dish.stock === "number" ? dish.stock : 0;
          if (currentStock <= 0) {
            throw new Error(`El producto "${dish.name}" se encuentra agotado en bodega.`);
          }

          if (currentStock < it.quantity) {
            throw new Error(
              `Stock insuficiente para "${dish.name}". Disponible en bodega: ${currentStock}, solicitado: ${it.quantity}.`
            );
          }
        }
      }

      const rest = await tx.restaurant.findUnique({
        where: { id: restaurantId },
        select: { id: true, name: true, testMode: true },
      });
      const isTestSale = Boolean(rest?.testMode);

      // 2. Crear Pedido / Ticket de Venta oficial vinculado al turno abierto
      const order = await tx.order.create({
        data: {
          restaurantId,
          cashShiftId: activeShift.id,
          tableName: data.tableName?.trim() || `Caja POS (${data.paymentMethod})`,
          customerName: data.customerName?.trim() || `Venta Directa (${data.paymentMethod})`,
          customerPhone: data.customerPhone?.trim() || null,
          customerAddress: data.customerAddress?.trim() || null,
          deliveryCost: safeDelivery,
          depositDiscount: safeDeposit,
          reservationId: data.reservationId?.trim() || null,
          status: "COMPLETED",
          subtotal,
          iva: safeIva,
          serviceCharge: safeService,
          tip: 0.0,
          total: finalTotal,
          paymentMethod: data.paymentMethod,
          isTest: isTestSale,
          items: {
            create: data.items.map((it) => ({
              dishName: it.name,
              price: it.price,
              quantity: it.quantity,
              sourcePedidoItemId: null,
              lineStatus: "ACTIVE",
            })),
          },
        },
      });

      // Si hay turno de caja activo, actualizar contadores en el arqueo Z
      // Para abonos / cuotas parciales, registrar ÚNICAMENTE el monto efectivamente abonado hoy
      const effectiveAmountToShift = (data.partialPayment?.isPartial && typeof data.partialPayment.montoAbonado === "number")
        ? data.partialPayment.montoAbonado
        : finalTotal;

      if (activeShift) {
        let cashSum = 0;
        let deunaSum = 0;
        let transferSum = 0;
        let cardSum = 0;

        if (data.splitDetails && data.splitDetails.length > 0) {
          data.splitDetails.forEach((d) => {
            const amt = Number(d.amount) || 0;
            if (d.paymentMethod === "EFECTIVO") cashSum += amt;
            else if (d.paymentMethod === "DEUNA") deunaSum += amt;
            else if (d.paymentMethod === "TRANSFERENCIA") transferSum += amt;
            else cardSum += amt;
          });
        } else {
          if (data.paymentMethod === "EFECTIVO") cashSum = effectiveAmountToShift;
          else if (data.paymentMethod === "DEUNA") deunaSum = effectiveAmountToShift;
          else if (data.paymentMethod === "TRANSFERENCIA") transferSum = effectiveAmountToShift;
          else cardSum = effectiveAmountToShift;
        }

        await tx.cashShift.update({
          where: { id: activeShift.id },
          data: {
            totalSales: { increment: effectiveAmountToShift },
            totalCash: { increment: cashSum },
            expectedCash: { increment: cashSum },
            totalDeuna: { increment: deunaSum },
            totalTransfer: { increment: transferSum },
            totalCard: { increment: cardSum },
          },
        });
      }

      // Sincronizar con CRM Customer si se suministró teléfono
      if (data.customerPhone) {
        const cleanPhone = data.customerPhone.trim();
        const existingCust = await tx.customer.findFirst({
          where: { restaurantId, phone: cleanPhone },
          select: { id: true, totalOrders: true, totalSpent: true, notes: true },
        });

        let updatedNotes = existingCust?.notes || "";
        if (data.partialPayment?.isPartial) {
          let parsedNotes: any = {};
          try {
            parsedNotes = existingCust?.notes ? JSON.parse(existingCust.notes) : {};
          } catch {}
          const prevTotalAbonado = Number(parsedNotes.activePaymentPlan?.totalAbonado) || 0;
          const currentTotalAbonado = prevTotalAbonado + data.partialPayment.montoAbonado;
          parsedNotes.activePaymentPlan = {
            treatmentName: data.partialPayment.treatmentName || "Tratamiento / Servicio",
            costoTotal: data.partialPayment.costoTotal,
            totalAbonado: currentTotalAbonado,
            saldoPendiente: data.partialPayment.saldoPendiente,
            updatedAt: new Date().toISOString(),
            historial: [
              ...(Array.isArray(parsedNotes.activePaymentPlan?.historial) ? parsedNotes.activePaymentPlan.historial : []),
              {
                fecha: new Date().toISOString(),
                abono: data.partialPayment.montoAbonado,
                metodo: data.paymentMethod,
                saldoDespues: data.partialPayment.saldoPendiente,
                especialista: data.specialistName || undefined,
              },
            ],
          };
          updatedNotes = JSON.stringify(parsedNotes);
        }

        if (existingCust) {
          await tx.customer.update({
            where: { id: existingCust.id },
            data: {
              name: data.customerName?.trim() || undefined,
              address: data.customerAddress?.trim() || undefined,
              notes: data.partialPayment?.isPartial ? updatedNotes : undefined,
              totalOrders: { increment: 1 },
              totalSpent: { increment: effectiveAmountToShift },
            },
          });
        } else {
          await tx.customer.create({
            data: {
              restaurantId,
              name: data.customerName?.trim() || "Cliente",
              phone: cleanPhone,
              address: data.customerAddress?.trim() || null,
              notes: data.partialPayment?.isPartial ? updatedNotes : null,
              totalOrders: 1,
              totalSpent: effectiveAmountToShift,
            },
          });
        }
      }

      // 3. Descontar Stock SOLO para productos físicos que tengan trackStock activo
      const updatedDishes: any[] = [];
      for (const it of data.items) {
        const dish = await tx.dish.findUnique({
          where: { id: it.dishId },
          select: { id: true, name: true, stock: true, trackStock: true, isAvailable: true },
        });

        if (dish && dish.trackStock) {
          const currentStock = typeof dish.stock === "number" ? dish.stock : 0;
          const newStock = Math.max(0, currentStock - it.quantity);
          const stillAvailable = newStock > 0;

          await tx.dish.update({
            where: { id: it.dishId },
            data: {
              stock: newStock,
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

      // Hook de prueba para validar rollback integral post-escritura en transacción POS
      if (process.env.NODE_ENV === "test" && __testCajaHooks.beforePosSaleCommit) {
        await __testCajaHooks.beforePosSaleCommit(order.id, activeShift.id);
      }

      const createdItems = await tx.orderItem.findMany({
        where: { orderId: order.id },
        orderBy: { id: "asc" },
      });

      return {
        orderId: order.id,
        orderNumber: order.orderNumber,
        total: finalTotal,
        updatedDishes,
        isTestSale,
        shiftId: activeShift.id,
        createdItems,
      };
    });

    // Sincronizar venta de Caja POS a la tabla de PostgreSQL pedidos para visibilidad inmediata en módulo mesero y cocina
    try {
      await ensureDbTables();
      const finalTableName = data.tableName?.trim() || "Caja POS";
      const metadataPayload = {
        tipo_pedido: "caja_pos",
        cash_shift_id: result.shiftId,
        paymentMethod: data.paymentMethod,
        subtotal,
        iva: safeIva,
        service_charge: safeService,
        costo_envio: safeDelivery,
      };

      await pool.query(
        `INSERT INTO pedidos (id, negocio_id, mesa, estado, total, es_prueba, vertical, metadata)
         VALUES ($1, $2, $3, 'pagado', $4, $5, 'menuqr', $6)
         ON CONFLICT (id) DO UPDATE SET estado = 'pagado', total = $4, mesa = $3, metadata = $6`,
        [
          result.orderId,
          restaurantId,
          finalTableName,
          result.total,
          result.isTestSale,
          JSON.stringify(metadataPayload),
        ]
      );
      for (const it of result.createdItems) {
        const piRes = await pool.query(
          `INSERT INTO pedido_items (pedido_id, nombre, cantidad, precio, notas, es_añadido, estado_item)
           VALUES ($1, $2, $3, $4, $5, false, 'pagado')
           RETURNING id`,
          [result.orderId, it.dishName, it.quantity, it.price, it.notes || null]
        );
        if (piRes.rows.length > 0) {
          const insertedPiId = String(piRes.rows[0].id);
          await prisma.orderItem.update({
            where: { id: it.id },
            data: { sourcePedidoItemId: insertedPiId },
          });
        }
      }

      // Si la venta directa corresponde a una mesa, cerrar cualquier TableSession abierta
      if (
        finalTableName &&
        !finalTableName.toLowerCase().includes("domicilio") &&
        !finalTableName.toLowerCase().includes("llevar") &&
        !finalTableName.toLowerCase().includes("caja pos")
      ) {
        try {
          const rawMesa = finalTableName.replace(/^Mesa\s*#?/i, "").trim();
          await prisma.tableSession.updateMany({
            where: {
              restaurantId,
              tableName: { in: [finalTableName, rawMesa] },
              status: { in: ["OPEN", "PARTIALLY_PAID"] },
            },
            data: { status: "CLOSED", paidAmount: finalTotal },
          });
        } catch (tableSessErr) {
          console.warn("No se pudo cerrar TableSession en venta directa:", tableSessErr);
        }
      }

      // Emitir evento Socket.IO para actualizar pantallas de meseros y KDS
      try {
        emitPedidoActualizado(restaurantId, {
          id: result.orderId,
          mesa: finalTableName,
          estado: "pagado",
          solicita_mesero: false,
        });
      } catch {}

      if (data.reservationId) {
        try {
          if ((prisma as any)?.tableReservation) {
            await (prisma as any).tableReservation.update({
              where: { id: data.reservationId },
              data: {
                status: "COMPLETED",
                usedInOrderId: result.orderId,
              },
            });
          }
        } catch (resErr) {
          console.warn("Error updating reservation status in processCajaSaleAction:", resErr);
        }
      }
    } catch (pgErr) {
      console.error("Error sincronizando venta Caja POS a PG pedidos:", pgErr);
    }

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
      orderId: result.orderId,
      orderNumber: result.orderNumber,
      total: result.total,
    };
  } catch (error: any) {
    console.error("Error processing caja sale:", error);
    return { error: error.message || "Error al procesar el cobro de la venta." };
  }
}

export interface SplitPaymentDetail {
  payerName?: string;
  amount: number;
  paymentMethod: "EFECTIVO" | "DEUNA" | "PAYPHONE" | "TARJETA" | "TRANSFERENCIA";
}

/**
 * Cobro y liquidación de una mesa, pedido para llevar o domicilio desde la Caja POS.
 * Actualiza el estado a 'pagado', libera la mesa y registra la venta en el turno de caja activo.
 * Soporta cobro único o cobro dividido / pagos mixtos (Split Pay).
 */
export async function settleOrderInCashShiftAction(
  restaurantId: string,
  data: {
    orderId: string;
    mesa?: string | null;
    total: number;
    paymentMethod: "EFECTIVO" | "DEUNA" | "PAYPHONE" | "TARJETA" | "TRANSFERENCIA";
    customerName?: string | null;
    depositDiscount?: number;
    reservationId?: string;
    splitDetails?: SplitPaymentDetail[];
    items?: {
      dishId?: string;
      name: string;
      price: number;
      quantity: number;
      trackStock?: boolean;
    }[];
    partialPayment?: {
      isPartial: boolean;
      montoAbonado: number;
      saldoPendiente: number;
      costoTotal: number;
      treatmentName?: string;
    };
  }
) {
  try {
    await refreshUserSession();
    const auth = await verifyRestaurantOwnership(restaurantId);
    if (!auth.authorized) return { error: auth.error };

    const effectiveTotalToShift = (data.partialPayment?.isPartial && typeof data.partialPayment.montoAbonado === "number")
      ? data.partialPayment.montoAbonado
      : Math.max(0, Number(data.total) || 0);

    await ensureDbTables();

    if (!data.orderId) {
      return { error: "ID de comanda requerido para liquidar en caja." };
    }

    // 1. Lectura inicial para distinguir la vertical (Citas vs Menú QR) y validar estado antes de cualquier escritura
    const { rows: initialOrderRows } = await pool.query(
      `SELECT id, vertical, mesa, estado, metadata, total::float, cliente_telefono, cliente_nombre 
       FROM pedidos 
       WHERE id = $1 AND negocio_id = $2 
       LIMIT 1`,
      [data.orderId, restaurantId]
    );

    if (initialOrderRows.length === 0) {
      return { error: "Pedido no encontrado." };
    }

    const initialOrder = initialOrderRows[0];

    // PUNTO 1: Rechazo inmediato de pedidos cancelados antes de cualquier escritura
    if (initialOrder.estado === "cancelado") {
      return { error: "No se puede liquidar ni cobrar un pedido cancelado." };
    }

    // Protección de idempotencia temprana
    if (initialOrder.estado === "pagado" && !data.partialPayment?.isPartial) {
      return {
        success: true,
        orderId: data.orderId,
        alreadyPrepaid: true,
        message: "Este pedido ya se encuentra cobrado y registrado en caja.",
      };
    }

    const isCitaOrder = initialOrder.vertical === "citas" || String(initialOrder.mesa).toUpperCase() === "CITA";

    const unresolvedCheckPrisma = await prisma.orderItem.findFirst({
      where: { orderId: data.orderId, lineStatus: "UNRESOLVED" },
    });
    if (unresolvedCheckPrisma) {
      return {
        error: "No se puede liquidar ni cobrar este pedido porque contiene líneas no conciliadas (UNRESOLVED). Resuelva la ambigüedad antes de cobrar.",
      };
    }

    // =========================================================================
    // CAMINO SEPARADO PARA VERTICAL CITAS (Comportamiento previo preservado)
    // Evita mezclar escrituras de Prisma (CRM y stock) dentro de la transacción SQL de Menú
    // =========================================================================
    if (isCitaOrder) {
      let meta: any = {};
      try {
        meta = typeof initialOrder.metadata === "string" ? JSON.parse(initialOrder.metadata) : (initialOrder.metadata || {});
      } catch {}

      meta.cobrado_en_caja = true;
      meta.monto_cobrado = effectiveTotalToShift;
      meta.fecha_cobro = new Date().toISOString();

      if (data.partialPayment?.isPartial) {
        meta.isPartialPayment = true;
        meta.monto_abonado_hoy = data.partialPayment.montoAbonado;
        meta.saldo_pendiente = data.partialPayment.saldoPendiente;
        meta.costo_total = data.partialPayment.costoTotal;
        meta.historial_abonos = [
          ...(Array.isArray(meta.historial_abonos) ? meta.historial_abonos : []),
          {
            fecha: new Date().toISOString(),
            monto: data.partialPayment.montoAbonado,
            metodo: data.paymentMethod,
            saldoDespues: data.partialPayment.saldoPendiente,
          },
        ];
      }

      // Calcular comisión por especialista si tiene porcentaje configurado
      let comisionCalculada = meta.comision_calculada || 0;
      if (meta.especialista_id) {
        try {
          const rest = await prisma.restaurant.findUnique({
            where: { id: restaurantId },
            select: { customLabels: true },
          });
          let cLabels: any = {};
          try {
            cLabels = typeof rest?.customLabels === "string" ? JSON.parse(rest?.customLabels) : (rest?.customLabels || {});
          } catch {}
          const specialists = Array.isArray(cLabels.specialists) ? cLabels.specialists : [];
          const spec = specialists.find((s: any) => s.id === meta.especialista_id);
          const commPercent = Number(spec?.commissionPercentage) || 0;
          if (commPercent > 0) {
            const servicePrice = Number(meta.precio_estimado) || Number(initialOrder.total) || 0;
            comisionCalculada = Math.round(((servicePrice * commPercent) / 100) * 100) / 100;
          }
        } catch (specErr) {
          console.warn("Error calculating specialist commission:", specErr);
        }
      }
      if (comisionCalculada > 0) {
        meta.comision_calculada = comisionCalculada;
      }

      // Si el cajero agregó productos físicos retail al ticket de la cita
      if (Array.isArray(data.items) && data.items.length > 0) {
        for (const it of data.items) {
          if (it.dishId && it.dishId !== "cita-item" && it.dishId !== "abono-cuota") {
            try {
              await pool.query(
                `INSERT INTO pedido_items (pedido_id, nombre, cantidad, precio, notas)
                 VALUES ($1, $2, $3, $4, $5)`,
                [data.orderId, it.name, it.quantity, it.price, "Agregado en Caja POS"]
              );
              const dish = await prisma.dish.findUnique({
                where: { id: it.dishId },
                select: { id: true, trackStock: true },
              });
              if (dish && dish.trackStock) {
                await prisma.dish.update({
                  where: { id: it.dishId },
                  data: { stock: { decrement: it.quantity } },
                });
              }
            } catch (prodErr) {
              console.warn("Error agregando producto físico a la cita:", prodErr);
            }
          }
        }
      }

      const newEstado = (data.partialPayment?.isPartial && data.partialPayment.saldoPendiente > 0)
        ? "en_atencion"
        : "completada";

      const { rows: updatedCitaRows } = await pool.query(
        `UPDATE pedidos 
         SET estado = $1,
             total = $2,
             metadata = $3,
             solicita_mesero = false
         WHERE id = $4 AND negocio_id = $5
         RETURNING *`,
        [newEstado, effectiveTotalToShift, JSON.stringify(meta), data.orderId, restaurantId]
      );

      // Actualizar plan activo en Customer del CRM si tiene teléfono
      if (initialOrder.cliente_telefono) {
        try {
          const cust = await prisma.customer.findFirst({
            where: { restaurantId, phone: initialOrder.cliente_telefono },
          });
          if (cust) {
            let custNotes: any = {};
            try {
              custNotes = typeof cust.notes === "string" ? JSON.parse(cust.notes) : (cust.notes || {});
            } catch {}

            if (data.partialPayment?.isPartial) {
              const prevAbonado = Number(custNotes.activePaymentPlan?.totalAbonado) || 0;
              custNotes.activePaymentPlan = {
                treatmentName: data.partialPayment.treatmentName || "Tratamiento / Cita",
                costoTotal: data.partialPayment.costoTotal,
                totalAbonado: prevAbonado + data.partialPayment.montoAbonado,
                saldoPendiente: data.partialPayment.saldoPendiente,
                updatedAt: new Date().toISOString(),
                historial: [
                  ...(Array.isArray(custNotes.activePaymentPlan?.historial) ? custNotes.activePaymentPlan.historial : []),
                  {
                    fecha: new Date().toISOString(),
                    abono: data.partialPayment.montoAbonado,
                    metodo: data.paymentMethod,
                    saldoDespues: data.partialPayment.saldoPendiente,
                  },
                ],
              };
            }

            await prisma.customer.update({
              where: { id: cust.id },
              data: {
                notes: JSON.stringify(custNotes),
                totalSpent: { increment: effectiveTotalToShift },
              },
            });
          }
        } catch (custErr) {
          console.warn("Error updating customer activePaymentPlan:", custErr);
        }
      }

      // Vincular y registrar la venta en CashShift (Prisma)
      const activeShift = await prisma.cashShift.findFirst({
        where: { restaurantId, status: "OPEN" },
      });

      try {
        await prisma.order.updateMany({
          where: { id: data.orderId },
          data: {
            status: "COMPLETED",
            paymentMethod: data.paymentMethod,
            cashShiftId: activeShift?.id || null,
            ...(data.depositDiscount !== undefined ? { depositDiscount: data.depositDiscount } : {}),
            ...(data.reservationId ? { reservationId: data.reservationId } : {}),
          },
        });
      } catch {}

      if (activeShift) {
        const deltaTotal = effectiveTotalToShift;
        let cashSum = 0;
        let deunaSum = 0;
        let transferSum = 0;
        let cardSum = 0;

        if (data.splitDetails && data.splitDetails.length > 0) {
          for (const d of data.splitDetails) {
            const amt = Math.max(0, Number(d.amount) || 0);
            const m = String(d.paymentMethod || "").toUpperCase();
            if (m === "EFECTIVO" || m === "CASH") cashSum += amt;
            else if (m === "DEUNA" || m === "QR") deunaSum += amt;
            else if (m === "TRANSFERENCIA" || m.includes("TRANSFER")) transferSum += amt;
            else if (m === "TARJETA" || m === "PAYPHONE" || m === "CARD") cardSum += amt;
            else {
              return { error: `Método no reconocido en cobro dividido ("${d.paymentMethod}"). No se puede clasificar el arqueo.` };
            }
          }
        } else {
          if (data.paymentMethod === "EFECTIVO") cashSum = deltaTotal;
          else if (data.paymentMethod === "DEUNA") deunaSum = deltaTotal;
          else if (data.paymentMethod === "TRANSFERENCIA") transferSum = deltaTotal;
          else cardSum = deltaTotal;
        }

        await prisma.cashShift.update({
          where: { id: activeShift.id },
          data: {
            totalSales: { increment: deltaTotal },
            totalCash: { increment: cashSum },
            expectedCash: { increment: cashSum },
            totalDeuna: { increment: deunaSum },
            totalTransfer: { increment: transferSum },
            totalCard: { increment: cardSum },
          },
        });
      }

      // Si vino una reserva asociada, marcarla como completada y asociar la orden
      if (data.reservationId) {
        try {
          if ((prisma as any)?.tableReservation) {
            await (prisma as any).tableReservation.update({
              where: { id: data.reservationId },
              data: {
                status: "COMPLETED",
                usedInOrderId: data.orderId,
              },
            });
          }
        } catch (resErr) {
          console.warn("Error updating reservation status in settleOrderInCashShiftAction (citas):", resErr);
        }
      }

      try {
        emitCitaActualizada(restaurantId, updatedCitaRows[0]);
      } catch {}

      try {
        emitPedidoActualizado(restaurantId, {
          id: data.orderId,
          mesa: data.mesa || "CITA",
          estado: newEstado === "completada" ? "pagado" : newEstado,
          solicita_mesero: false,
        });
      } catch {}

      const restaurant = await prisma.restaurant.findUnique({
        where: { id: restaurantId },
        select: { slug: true },
      });

      revalidatePath("/caja");
      revalidatePath("/admin");
      if (restaurant?.slug) {
        revalidatePath(`/${restaurant.slug}`);
      }

      return { success: true, orderId: data.orderId, alreadyPrepaid: false };
    }

    // =========================================================================
    // CAMINO ATÓMICO TRANSACCIONAL DE MENÚ QR (Mesa, Llevar, Domicilio)
    // Transacción común protegida contra doble cobro, cancelaciones y bypass de prepago
    // =========================================================================
    const client = await pool.connect();
    let isAlreadyPrepaid = false;

    try {
      await client.query("BEGIN");

      // Paso 1: Bloqueo pesimista de la fila contable en Order de Prisma
      const { rows: prismaOrderRows } = await client.query(
        `SELECT id, "restaurantId", "cashShiftId", "status", "paymentMethod"
         FROM "Order" 
         WHERE id = $1 
         LIMIT 1 
         FOR UPDATE`,
        [data.orderId]
      );

      if (prismaOrderRows.length === 0) {
        await client.query("ROLLBACK");
        return {
          error: "La orden aún no está sincronizada en el registro contable. Por favor, reintente en unos segundos.",
        };
      }

      const orderPrisma = prismaOrderRows[0];
      if (orderPrisma.restaurantId !== restaurantId) {
        await client.query("ROLLBACK");
        return { error: "La orden no pertenece a este negocio." };
      }

      // Paso 2: Bloqueo pesimista del pedido operativo en la tabla pedidos
      const { rows: orderRows } = await client.query(
        `SELECT id, vertical, mesa, estado, metadata, total::float, cliente_telefono, cliente_nombre 
         FROM pedidos 
         WHERE id = $1 AND negocio_id = $2 
         LIMIT 1 
         FOR UPDATE`,
        [data.orderId, restaurantId]
      );

      if (orderRows.length === 0) {
        await client.query("ROLLBACK");
        return { error: "Pedido no encontrado." };
      }

      const orderRecord = orderRows[0];

      // Rechazo de pedidos cancelados dentro de la transacción y antes de cualquier escritura
      if (orderRecord.estado === "cancelado") {
        await client.query("ROLLBACK");
        return { error: "No se puede liquidar ni cobrar un pedido cancelado." };
      }

      // Bloqueo estricto si el pedido contiene líneas no conciliadas (UNRESOLVED)
      const { rows: unresolvedRows } = await client.query(
        `SELECT id, "dishName" FROM "OrderItem" WHERE "orderId" = $1 AND "lineStatus" = 'UNRESOLVED' LIMIT 1`,
        [data.orderId]
      );
      if (unresolvedRows.length > 0) {
        await client.query("ROLLBACK");
        return {
          error: "No se puede liquidar ni cobrar este pedido porque contiene líneas no conciliadas (UNRESOLVED). Resuelva la ambigüedad antes de cobrar.",
        };
      }

      let meta: any = {};
      try {
        meta = typeof orderRecord.metadata === "string" ? JSON.parse(orderRecord.metadata) : (orderRecord.metadata || {});
      } catch {}

      // Protección de idempotencia y validación de trazabilidad si ya figura como pagado
      if (orderRecord.estado === "pagado") {
        const origShiftId = orderPrisma.cashShiftId || meta.cash_shift_id;
        if (!origShiftId) {
          await client.query("ROLLBACK");
          return { error: "Falta trazabilidad: el pedido figura como pagado pero no tiene turno de caja registrado." };
        }
        if (orderPrisma.cashShiftId && meta.cash_shift_id && orderPrisma.cashShiftId !== meta.cash_shift_id) {
          await client.query("ROLLBACK");
          return { error: "Contradicción en trazabilidad: el turno contable difiere del turno operativo." };
        }
        const { rows: origShiftRows } = await client.query(
          `SELECT id, "restaurantId", status FROM "CashShift" WHERE id = $1 AND "restaurantId" = $2`,
          [origShiftId, restaurantId]
        );
        if (origShiftRows.length === 0) {
          await client.query("ROLLBACK");
          return { error: "El turno original de este pedido no pertenece a este negocio o no existe." };
        }

        await client.query("COMMIT");
        return {
          success: true,
          orderId: data.orderId,
          alreadyPrepaid: true,
          message: "Este pedido ya se encuentra cobrado y registrado en caja.",
        };
      }

      // Si el pedido ya fue prepagado y confirmado previamente por caja
      if (meta.pago_confirmado === true) {
        isAlreadyPrepaid = true;
        const origShiftId = orderPrisma.cashShiftId || meta.cash_shift_id;
        if (!origShiftId) {
          await client.query("ROLLBACK");
          return { error: "Falta trazabilidad: el prepago está confirmado pero carece de turno original." };
        }
        if (orderPrisma.cashShiftId && meta.cash_shift_id && orderPrisma.cashShiftId !== meta.cash_shift_id) {
          await client.query("ROLLBACK");
          return { error: "Contradicción en trazabilidad entre registro contable y operativo del prepago." };
        }
        const { rows: origShiftRows } = await client.query(
          `SELECT id, "restaurantId", status FROM "CashShift" WHERE id = $1 AND "restaurantId" = $2`,
          [origShiftId, restaurantId]
        );
        if (origShiftRows.length === 0) {
          await client.query("ROLLBACK");
          return { error: "El turno original del prepago no pertenece a este negocio o no existe." };
        }
      }

      // Si exige prepago pero no ha sido confirmado por caja, RECHAZAR bypass
      if (meta.exige_prepago && !meta.pago_confirmado) {
        await client.query("ROLLBACK");
        return {
          error: "Este pedido exige prepago y su pago aún no ha sido confirmado por Caja. Confirma el prepago antes de liquidar o entregar.",
        };
      }

      // Paso 3: Verificar y bloquear Turno de Caja (CashShift) activo ÚNICAMENTE si no es prepago previo
      let activeShiftId: string | null = null;
      if (!isAlreadyPrepaid) {
        let clientPid: number | undefined;
        if (process.env.NODE_ENV === "test") {
          try {
            const { rows: pidRows } = await client.query("SELECT pg_backend_pid() AS pid");
            clientPid = pidRows[0]?.pid;
            if (__testCajaHooks.beforeSettleOrderLock) {
              await __testCajaHooks.beforeSettleOrderLock(data.orderId, restaurantId, clientPid);
            }
          } catch {}
        }

        const { rows: shiftRows } = await client.query(
          `SELECT id, status 
           FROM "CashShift" 
           WHERE "restaurantId" = $1 AND "status" = 'OPEN' 
           ORDER BY "createdAt" DESC 
           LIMIT 1 
           FOR UPDATE`,
          [restaurantId]
        );

        if (shiftRows.length === 0) {
          await client.query("ROLLBACK");
          return { error: "Abre un turno de caja primero." };
        }

        activeShiftId = shiftRows[0].id;

        if (process.env.NODE_ENV === "test" && __testCajaHooks.afterSettleOrderLock) {
          await __testCajaHooks.afterSettleOrderLock(data.orderId, activeShiftId, clientPid);
        }

        if (orderPrisma.cashShiftId && orderPrisma.cashShiftId !== activeShiftId) {
          await client.query("ROLLBACK");
          return {
            error: "El pedido ya se encuentra asociado a otro turno de caja. No se puede cobrar en un turno diferente.",
          };
        }
      }

      // Paso 3: Marcar pedido como pagado y apagar solicita_mesero, persistiendo el cash_shift_id
      meta.cobrado_en_caja = true;
      meta.monto_cobrado = effectiveTotalToShift;
      meta.fecha_cobro = new Date().toISOString();
      if (activeShiftId) {
        meta.cash_shift_id = activeShiftId;
      }

      await client.query(
        `UPDATE pedidos 
         SET estado = 'pagado',
             solicita_mesero = false,
             metadata = $1
         WHERE id = $2 AND negocio_id = $3`,
        [JSON.stringify(meta), data.orderId, restaurantId]
      );

      // Paso 4: Registrar en CashShift ÚNICAMENTE si no fue prepagado previamente
      if (!isAlreadyPrepaid && activeShiftId) {
        const deltaTotal = effectiveTotalToShift;
        let cashSum = 0;
        let deunaSum = 0;
        let transferSum = 0;
        let cardSum = 0;

        if (data.splitDetails && data.splitDetails.length > 0) {
          for (const d of data.splitDetails) {
            const amt = Math.max(0, Number(d.amount) || 0);
            const m = String(d.paymentMethod || "").toUpperCase();
            if (m === "EFECTIVO" || m === "CASH") cashSum += amt;
            else if (m === "DEUNA" || m === "QR") deunaSum += amt;
            else if (m === "TRANSFERENCIA" || m.includes("TRANSFER")) transferSum += amt;
            else if (m === "TARJETA" || m === "PAYPHONE" || m === "CARD") cardSum += amt;
            else {
              await client.query("ROLLBACK");
              return { error: `Método no reconocido en cobro dividido ("${d.paymentMethod}"). No se puede clasificar el arqueo.` };
            }
          }
        } else {
          const m = String(data.paymentMethod || "").toUpperCase();
          if (m === "EFECTIVO" || m === "CASH") cashSum = deltaTotal;
          else if (m === "DEUNA" || m === "QR") deunaSum = deltaTotal;
          else if (m === "TRANSFERENCIA" || m.includes("TRANSFER")) transferSum = deltaTotal;
          else if (m === "TARJETA" || m === "PAYPHONE" || m === "CARD") cardSum = deltaTotal;
          else {
            await client.query("ROLLBACK");
            return { error: `Método de pago no reconocido ("${data.paymentMethod}"). No se puede clasificar el ingreso en caja.` };
          }
        }

        await client.query(
          `UPDATE "CashShift"
           SET "totalSales" = "totalSales" + $1,
               "totalCash" = "totalCash" + $2,
               "expectedCash" = "expectedCash" + $2,
               "totalDeuna" = "totalDeuna" + $3,
               "totalTransfer" = "totalTransfer" + $4,
               "totalCard" = "totalCard" + $5,
               "updatedAt" = NOW()
           WHERE id = $6`,
          [deltaTotal, cashSum, deunaSum, transferSum, cardSum, activeShiftId]
        );

        // Actualizar "Order" de Prisma vinculándola explícitamente al turno activo
        await client.query(
          `UPDATE "Order"
           SET "status" = 'COMPLETED',
               "paymentMethod" = COALESCE($1, "paymentMethod"),
               "cashShiftId" = $2,
               "depositDiscount" = COALESCE($3, "depositDiscount"),
               "reservationId" = COALESCE($4, "reservationId"),
               "updatedAt" = NOW()
           WHERE id = $5 AND "restaurantId" = $6`,
          [
            data.paymentMethod,
            activeShiftId,
            data.depositDiscount !== undefined ? data.depositDiscount : null,
            data.reservationId || null,
            data.orderId,
            restaurantId,
          ]
        );
      } else {
        // Si ya estaba prepagado, únicamente finalizar el estado operativo a COMPLETED sin alterar el turno original
        await client.query(
          `UPDATE "Order"
           SET "status" = 'COMPLETED',
               "updatedAt" = NOW()
           WHERE id = $1 AND "restaurantId" = $2`,
          [data.orderId, restaurantId]
        );
      }

      await client.query("COMMIT");
    } catch (dbErr) {
      await client.query("ROLLBACK");
      throw dbErr;
    } finally {
      client.release();
    }

    // 4. Si es una mesa de salón y existe TableSession, registrar pagos divididos y evaluar si se cierra la sesión
    const mesaRaw = String(data.mesa || "").trim();
    const mesaUpper = mesaRaw.toUpperCase();
    const isSalonTable = Boolean(
      mesaRaw &&
      mesaUpper !== "DELIVERY" &&
      !mesaUpper.includes("DOMICILIO") &&
      mesaUpper !== "LLEVAR" &&
      !mesaUpper.includes("RETIRO") &&
      !mesaUpper.includes("TAKEOUT") &&
      !mesaUpper.includes("PICKUP") &&
      mesaUpper !== "CATALOGO" &&
      mesaUpper !== "CITA"
    );

    if (isSalonTable) {
      try {
        const tableSess = await prisma.tableSession.findFirst({
          where: { restaurantId, tableName: data.mesa!, status: { in: ["OPEN", "PARTIALLY_PAID"] } },
        });

        if (tableSess) {
          // Conservar el registro de los pagos divididos aunque la sesión siga abierta
          if (data.splitDetails && data.splitDetails.length > 0) {
            for (const d of data.splitDetails) {
              await prisma.tableSplitPayment.create({
                data: {
                  tableSessionId: tableSess.id,
                  payerName: d.payerName || "Pago en Caja",
                  amount: Math.max(0, Number(d.amount) || 0),
                  paymentMethod: d.paymentMethod.toLowerCase(),
                  status: "COMPLETED",
                  confirmedAt: new Date(),
                },
              });
            }
          }

          // Verificar si quedan otras comandas activas de esa misma mesa y negocio
          const { rows: remainingRows } = await pool.query(
            `SELECT COUNT(*)::int as count 
             FROM pedidos 
             WHERE negocio_id = $1 
               AND LOWER(TRIM(mesa)) = LOWER(TRIM($2)) 
               AND id != $3 
               AND estado NOT IN ('pagado', 'cancelado')`,
            [restaurantId, data.mesa, data.orderId]
          );

          const remainingActiveOrders = Number(remainingRows[0]?.count) || 0;

          // Solo se libera (status = CLOSED) al cobrar la última cuenta de la mesa
          if (remainingActiveOrders === 0) {
            await prisma.tableSession.update({
              where: { id: tableSess.id },
              data: { status: "CLOSED", paidAmount: tableSess.totalAmount },
            });
          }
        }
      } catch (sessErr) {
        console.warn("Error actualizando TableSession en settleOrderInCashShiftAction:", sessErr);
      }
    }

    // 5. Si vino una reserva asociada, marcarla como completada y asociar la orden
    if (data.reservationId) {
      try {
        if ((prisma as any)?.tableReservation) {
          await (prisma as any).tableReservation.update({
            where: { id: data.reservationId },
            data: {
              status: "COMPLETED",
              usedInOrderId: data.orderId,
            },
          });
        }
      } catch (resErr) {
        console.warn("Error updating reservation status in settleOrderInCashShiftAction:", resErr);
      }
    }

    // 6. Notificar a través de Socket.IO para actualizar pantallas de meseros y cocina
    try {
      emitPedidoActualizado(restaurantId, {
        id: data.orderId,
        mesa: data.mesa || "Mesa",
        estado: "pagado",
        solicita_mesero: false,
      });
    } catch {}

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { slug: true },
    });

    revalidatePath("/caja");
    revalidatePath("/admin");
    if (restaurant?.slug) {
      revalidatePath(`/${restaurant.slug}`);
    }

    return { success: true, orderId: data.orderId, alreadyPrepaid: isAlreadyPrepaid };
  } catch (error: any) {
    console.error("Error in settleOrderInCashShiftAction:", error);
    return { error: error.message || "Error al liquidar el cobro en caja." };
  }
}
export async function confirmarPrepagoPedidoAction(
  restaurantId: string,
  orderId: string
) {
  try {
    await refreshUserSession();

    // 1. Verificar autorización (Admin o Superadmin, o personal de caja autorizado)
    // Solo Caja y Administración pueden confirmar pagos recibidos (Cocina y Mesero prohibidos).
    let isAuthorized = false;
    let staffIdentifier = "Caja / Administración";

    const authOwner = await verifyRestaurantOwnership(restaurantId);
    if (authOwner.authorized) {
      isAuthorized = true;
      const session = await getUserSession();
      staffIdentifier = session?.email ? `Admin (${session.email})` : "Administrador";
    } else {
      const staffAuth = await verifyOrderStaffAuth(undefined, restaurantId);
      if (staffAuth.authorized) {
        const allowedRoles = ["CAJERO", "ADMIN", "SUPERADMIN"];
        if (!allowedRoles.includes(staffAuth.role!)) {
          return {
            error: "No autorizado. Solo el personal con rol de Caja o Administración puede confirmar pagos.",
          };
        }
        isAuthorized = true;
        staffIdentifier = staffAuth.staffNombre
          ? `${staffAuth.staffNombre} (${staffAuth.role})`
          : `Personal (${staffAuth.role})`;
      }
    }

    if (!isAuthorized) {
      return { error: "No autorizado. Se requieren credenciales de caja o administración del negocio." };
    }

    await ensureDbTables();

    // 2. Transacción Atómica Completa (pedidos + CashShift + Order)
    // Protegida contra race conditions concurrentes mediante SELECT ... FOR UPDATE
    const client = await pool.connect();
    let updatedOrder: any = null;

    try {
      await client.query("BEGIN");

      // Paso A: Bloqueo pesimista de la fila contable en Order de Prisma
      const { rows: prismaOrderRows } = await client.query(
        `SELECT id, "restaurantId", "cashShiftId", "paymentMethod", "paymentDetails", status 
         FROM "Order" 
         WHERE id = $1 
         LIMIT 1 
         FOR UPDATE`,
        [orderId]
      );

      if (prismaOrderRows.length === 0) {
        await client.query("ROLLBACK");
        return {
          error: "La orden aún no está sincronizada en el registro contable. Por favor, reintente en unos segundos.",
        };
      }

      const orderPrisma = prismaOrderRows[0];
      if (orderPrisma.restaurantId !== restaurantId) {
        await client.query("ROLLBACK");
        return { error: "La orden no pertenece a este negocio." };
      }

      // Paso B: Bloqueo pesimista del pedido operativo en la tabla pedidos
      const { rows: existingRows } = await client.query(
        `SELECT id, negocio_id, mesa, estado, total::float, metadata, cliente_nombre, cliente_telefono, created_at 
         FROM pedidos 
         WHERE id = $1 AND negocio_id = $2
         FOR UPDATE`,
        [orderId, restaurantId]
      );

      if (existingRows.length === 0) {
        await client.query("ROLLBACK");
        return { error: "Pedido no encontrado." };
      }

      const orderRecord = existingRows[0];
      let meta: any = {};
      try {
        meta = typeof orderRecord.metadata === "string" ? JSON.parse(orderRecord.metadata) : (orderRecord.metadata || {});
      } catch {}

      // A.1. Idempotencia y Reintentos Válidos con Validación Rigurosa de Trazabilidad
      if (meta.pago_confirmado === true) {
        const originalShiftId = orderPrisma.cashShiftId || meta.cash_shift_id;
        if (!originalShiftId) {
          await client.query("ROLLBACK");
          return { error: "Falta trazabilidad: el pedido figura como confirmado pero carece de turno de caja registrado." };
        }
        if (orderPrisma.cashShiftId && meta.cash_shift_id && orderPrisma.cashShiftId !== meta.cash_shift_id) {
          await client.query("ROLLBACK");
          return { error: "Contradicción en trazabilidad: el turno contable difiere del turno operativo." };
        }
        const { rows: origShiftRows } = await client.query(
          `SELECT id, "restaurantId", status FROM "CashShift" WHERE id = $1 AND "restaurantId" = $2`,
          [originalShiftId, restaurantId]
        );
        if (origShiftRows.length === 0) {
          await client.query("ROLLBACK");
          return { error: "El turno original de este pedido no pertenece a este negocio o no existe." };
        }

        // Reintento válido: se reconoce aunque el turno de origen esté cerrado, sin sumar nuevamente ni adelantar estado
        await client.query("COMMIT");
        return {
          success: true,
          alreadyConfirmed: true,
          pedido: orderRecord,
          message: "El pago de este pedido ya fue confirmado previamente.",
        };
      }

      // A.2. Validar estado del pedido: no permitir si está cancelado o ya cerrado/pagado
      if (orderRecord.estado === "cancelado") {
        await client.query("ROLLBACK");
        return { error: "No se puede confirmar el pago de un pedido cancelado." };
      }

      if (orderRecord.estado === "pagado") {
        await client.query("ROLLBACK");
        return { error: "Este pedido ya se encuentra cerrado o liquidado en caja." };
      }

      // A.3. Validar que realmente exige prepago anticipado
      if (!meta.exige_prepago) {
        await client.query("ROLLBACK");
        return {
          error: "Este pedido no está sujeto a prepago anticipado. Debe cobrarse en caja al finalizar o contraentrega.",
        };
      }

      // A.4. No permitir usar esta acción para pedidos de salón (mesa)
      const mesaUpper = String(orderRecord.mesa || "").trim().toUpperCase();
      const isTableOrder = mesaUpper !== "DELIVERY" && mesaUpper !== "DOMICILIO" && mesaUpper !== "LLEVAR" && mesaUpper !== "RETIRO" && mesaUpper !== "CATALOGO";
      if (isTableOrder || meta.tipo_pedido === "mesa" || meta.tipo_entrega === "SALON") {
        await client.query("ROLLBACK");
        return { error: "No se puede aplicar confirmación de prepago a pedidos en mesa." };
      }

      // Paso C: Leer y clasificar método de pago
      const savedMethodRaw = (
        orderPrisma.paymentMethod ||
        meta.metodo_pago ||
        meta.paymentMethod ||
        ""
      ).toString().trim().toUpperCase();

      // Validar contraentrega: no permitir confirmar prepago si el método es contraentrega
      if (savedMethodRaw.includes("CONTRAENTREGA") || savedMethodRaw === "EFECTIVO_CONTRAENTREGA") {
        await client.query("ROLLBACK");
        return {
          error: "No se puede confirmar como prepago un pedido con método contraentrega. Este pedido debe cobrarse al momento de la entrega.",
        };
      }

      // Clasificación rigurosa del método de pago (sin convertir métodos desconocidos silenciosamente a efectivo)
      let classifiedMethod: "DEUNA" | "PAYPHONE" | "TRANSFERENCIA" | "EFECTIVO" | null = null;

      if (savedMethodRaw.includes("DEUNA") || savedMethodRaw === "QR") {
        classifiedMethod = "DEUNA";
      } else if (
        savedMethodRaw.includes("PAYPHONE") ||
        savedMethodRaw.includes("TARJETA") ||
        savedMethodRaw.includes("CARD")
      ) {
        classifiedMethod = "PAYPHONE";
      } else if (savedMethodRaw.includes("TRANSFER")) {
        classifiedMethod = "TRANSFERENCIA";
      } else if (savedMethodRaw === "EFECTIVO" || savedMethodRaw === "CASH") {
        classifiedMethod = "EFECTIVO";
      }

      if (!classifiedMethod) {
        await client.query("ROLLBACK");
        return {
          error: `Método de pago no reconocido o no especificado ("${savedMethodRaw}"). No se puede clasificar el ingreso en caja para el arqueo.`,
        };
      }

      // Paso D: Verificar y bloquear el Turno de Caja (CashShift) activo en la misma transacción
      let clientPid: number | undefined;
      if (process.env.NODE_ENV === "test") {
        try {
          const { rows: pidRows } = await client.query("SELECT pg_backend_pid() AS pid");
          clientPid = pidRows[0]?.pid;
          if (__testCajaHooks.beforeConfirmPrepagoLock) {
            await __testCajaHooks.beforeConfirmPrepagoLock(orderId, restaurantId, clientPid);
          }
        } catch {}
      }

      const { rows: shiftRows } = await client.query(
        `SELECT id, status 
         FROM "CashShift" 
         WHERE "restaurantId" = $1 AND "status" = 'OPEN' 
         ORDER BY "createdAt" DESC 
         LIMIT 1 
         FOR UPDATE`,
        [restaurantId]
      );

      // Si no hay turno abierto, RECHAZAR y revertir cualquier cambio
      if (shiftRows.length === 0) {
        await client.query("ROLLBACK");
        return { error: "Abre un turno de caja primero." };
      }

      const activeShiftId = shiftRows[0].id;

      if (process.env.NODE_ENV === "test" && __testCajaHooks.afterConfirmPrepagoLock) {
        await __testCajaHooks.afterConfirmPrepagoLock(orderId, activeShiftId, clientPid);
      }

      // Evitar mover pedidos entre turnos o duplicar ingresos
      if (orderPrisma.cashShiftId && orderPrisma.cashShiftId !== activeShiftId) {
        await client.query("ROLLBACK");
        return {
          error: "El pedido ya se encuentra asociado a otro turno de caja. No se puede confirmar en un turno diferente.",
        };
      }

      const orderTotal = Number(orderRecord.total) || 0;

      // Registrar incremento en CashShift según método exacto
      const deunaInc = classifiedMethod === "DEUNA" ? orderTotal : 0;
      const cardInc = classifiedMethod === "PAYPHONE" ? orderTotal : 0;
      const transferInc = classifiedMethod === "TRANSFERENCIA" ? orderTotal : 0;
      const cashInc = classifiedMethod === "EFECTIVO" ? orderTotal : 0;

      await client.query(
        `UPDATE "CashShift"
         SET "totalSales" = "totalSales" + $1,
             "totalDeuna" = "totalDeuna" + $2,
             "totalCard" = "totalCard" + $3,
             "totalTransfer" = "totalTransfer" + $4,
             "totalCash" = "totalCash" + $5,
             "expectedCash" = "expectedCash" + $5,
             "updatedAt" = NOW()
         WHERE id = $6`,
        [orderTotal, deunaInc, cardInc, transferInc, cashInc, activeShiftId]
      );

      // Paso D: Actualización de metadata en pedidos (mantiene estado operativo 'nuevo' o el que tenga)
      const nowIso = new Date().toISOString();
      meta.pago_confirmado = true;
      meta.pago_confirmado_por = staffIdentifier;
      meta.pago_confirmado_at = nowIso;
      meta.pago_estado = "pagado";
      meta.metodo_pago_clasificado = classifiedMethod;
      meta.cash_shift_id = activeShiftId;

      const { rows: updatedRows } = await client.query(
        `UPDATE pedidos
         SET metadata = $1
         WHERE id = $2 AND negocio_id = $3
         RETURNING id, negocio_id, mesa, estado, total::float, metadata, cliente_nombre, cliente_telefono, created_at`,
        [JSON.stringify(meta), orderId, restaurantId]
      );

      updatedOrder = updatedRows[0];

      // Paso E: Actualizar la tabla "Order" vinculándola explícitamente al turno activo sin cambiar su estado operativo
      let pDetails: any = {};
      try {
        const rawPd = orderPrisma.paymentDetails;
        pDetails = rawPd && rawPd.startsWith("{") ? JSON.parse(rawPd) : { details: rawPd };
      } catch {}

      pDetails.pago_confirmado = true;
      pDetails.pago_confirmado_por = staffIdentifier;
      pDetails.pago_confirmado_at = nowIso;
      pDetails.pago_estado = "pagado";

      await client.query(
        `UPDATE "Order"
         SET "cashShiftId" = $1,
             "paymentDetails" = $2,
             "paymentMethod" = COALESCE("paymentMethod", $3),
             "updatedAt" = NOW()
         WHERE id = $4 AND "restaurantId" = $5`,
        [activeShiftId, JSON.stringify(pDetails), classifiedMethod, orderId, restaurantId]
      );

      // Paso F: Commit atómico - si todo fue exitoso, ambas escrituras persisten juntas
      await client.query("COMMIT");
    } catch (dbErr) {
      await client.query("ROLLBACK");
      throw dbErr;
    } finally {
      client.release();
    }

    // 3. Emitir socket para que Cocina desbloquee la comanda inmediatamente
    try {
      emitPedidoActualizado(restaurantId, updatedOrder);
    } catch {}

    revalidatePath("/caja");
    revalidatePath("/admin");
    return {
      success: true,
      pedido: updatedOrder,
      message: "Pago confirmado exitosamente. La preparación en cocina ha sido habilitada.",
    };
  } catch (err: any) {
    console.error("Error en confirmarPrepagoPedidoAction:", err);
    return { error: err.message || "Error al confirmar el prepago del pedido." };
  }
}
/**
 * ==========================================
 * ACCIONES DE SESIÓN DE CAJA (CASH SHIFT / ARQUEO)
 * ==========================================
 */

export interface SerializedCashMovement {
  id: string;
  shiftId: string;
  type: "CASH_IN" | "CASH_OUT";
  amount: number;
  reason: string;
  performedBy: string;
  createdAt: string;
}

export interface SerializedCashShift {
  id: string;
  restaurantId: string;
  openedById: string;
  openedByName: string;
  openedAt: string;
  closedById?: string | null;
  closedByName?: string | null;
  closedAt?: string | null;
  initialCash: number;
  expectedCash: number;
  actualCash?: number | null;
  difference?: number | null;
  totalCash: number;
  totalCard: number;
  totalTransfer: number;
  totalDeuna: number;
  totalSales: number;
  status: "OPEN" | "CLOSED";
  notes?: string | null;
  movements: SerializedCashMovement[];
}

function serializeShift(
  shift: any,
  overrides?: {
    totalCash?: number;
    totalCard?: number;
    totalTransfer?: number;
    totalDeuna?: number;
    totalSales?: number;
    expectedCash?: number;
  }
): SerializedCashShift {
  const toIso = (d: any): string | null => {
    if (!d) return null;
    if (d instanceof Date) return d.toISOString();
    return new Date(d).toISOString();
  };

  return {
    id: shift.id,
    restaurantId: shift.restaurantId,
    openedById: shift.openedById,
    openedByName: shift.openedByName,
    openedAt: toIso(shift.openedAt) || new Date().toISOString(),
    closedById: shift.closedById || null,
    closedByName: shift.closedByName || null,
    closedAt: toIso(shift.closedAt),
    initialCash: Number(shift.initialCash) || 0,
    expectedCash: overrides?.expectedCash !== undefined ? overrides.expectedCash : (Number(shift.expectedCash) || 0),
    actualCash: shift.actualCash !== null && shift.actualCash !== undefined ? Number(shift.actualCash) : null,
    difference: shift.difference !== null && shift.difference !== undefined ? Number(shift.difference) : null,
    totalCash: overrides?.totalCash !== undefined ? overrides.totalCash : (Number(shift.totalCash) || 0),
    totalCard: overrides?.totalCard !== undefined ? overrides.totalCard : (Number(shift.totalCard) || 0),
    totalTransfer: overrides?.totalTransfer !== undefined ? overrides.totalTransfer : (Number(shift.totalTransfer) || 0),
    totalDeuna: overrides?.totalDeuna !== undefined ? overrides.totalDeuna : (Number(shift.totalDeuna) || 0),
    totalSales: overrides?.totalSales !== undefined ? overrides.totalSales : (Number(shift.totalSales) || 0),
    status: shift.status,
    notes: shift.notes || null,
    movements: (shift.movements || []).map((m: any) => ({
      id: m.id,
      shiftId: m.shiftId,
      type: m.type,
      amount: Number(m.amount) || 0,
      reason: m.reason,
      performedBy: m.performedBy,
      createdAt: toIso(m.createdAt) || new Date().toISOString(),
    })),
  };
}

/**
 * Obtiene el turno de caja abierto para un negocio determinado con cálculos en vivo.
 */
export async function getActiveCashShift(
  restaurantId: string
): Promise<{ success: boolean; shift?: SerializedCashShift | null; error?: string }> {
  try {
    await refreshUserSession();
    const auth = await verifyRestaurantOwnership(restaurantId);
    if (!auth.authorized) return { success: false, error: auth.error };

    const shift = await prisma.cashShift.findFirst({
      where: {
        restaurantId,
        status: "OPEN",
      },
      include: {
        movements: {
          orderBy: { createdAt: "asc" },
        },
        orders: {
          select: {
            id: true,
            total: true,
            paymentMethod: true,
            status: true,
          },
        },
      },
      orderBy: { openedAt: "desc" },
    });

    if (!shift) {
      return { success: true, shift: null };
    }

    // Calcular ventas y fondos en caliente para exactitud total
    let liveCashSales = 0;
    let liveCardSales = 0;
    let liveTransferSales = 0;
    let liveDeunaSales = 0;
    let liveTotalSales = 0;

    for (const order of (shift.orders || [])) {
      if (order.status === "CANCELLED") continue;
      const orderTotal = Number(order.total) || 0;
      liveTotalSales += orderTotal;
      const pm = (order.paymentMethod || "").toUpperCase();
      if (pm.includes("EFECTIVO") || pm === "CASH") liveCashSales += orderTotal;
      else if (pm.includes("TARJETA") || pm.includes("CARD") || pm.includes("PAYPHONE")) liveCardSales += orderTotal;
      else if (pm.includes("TRANSFERENCIA") || pm.includes("TRANSFER")) liveTransferSales += orderTotal;
      else if (pm.includes("DEUNA")) liveDeunaSales += orderTotal;
      else liveCashSales += orderTotal;
    }

    // Reconciliación robusta: priorizar los acumuladores atómicos del turno que soportan Split Pay,
    // garantizando que nunca se descarte una venta registrada ni se desfiguren transferencias/tarjetas.
    const dbCash = Number(shift.totalCash) || 0;
    const dbCard = Number(shift.totalCard) || 0;
    const dbTransfer = Number(shift.totalTransfer) || 0;
    const dbDeuna = Number(shift.totalDeuna) || 0;
    const dbSales = Number(shift.totalSales) || 0;

    let resolvedCashSales = dbCash;
    let resolvedCardSales = dbCard;
    let resolvedTransferSales = dbTransfer;
    let resolvedDeunaSales = dbDeuna;
    let resolvedTotalSales = dbSales;

    if (resolvedTotalSales === 0 && liveTotalSales > 0) {
      resolvedCashSales = liveCashSales;
      resolvedCardSales = liveCardSales;
      resolvedTransferSales = liveTransferSales;
      resolvedDeunaSales = liveDeunaSales;
      resolvedTotalSales = liveTotalSales;
    } else if (liveTotalSales > resolvedTotalSales) {
      resolvedTotalSales = liveTotalSales;
      resolvedCashSales += Math.max(0, liveCashSales - dbCash);
      resolvedCardSales += Math.max(0, liveCardSales - dbCard);
      resolvedTransferSales += Math.max(0, liveTransferSales - dbTransfer);
      resolvedDeunaSales += Math.max(0, liveDeunaSales - dbDeuna);
    }

    let cashInTotal = 0;
    let cashOutTotal = 0;
    for (const m of (shift.movements || [])) {
      const amt = Number(m.amount) || 0;
      if (m.type === "CASH_IN") cashInTotal += amt;
      if (m.type === "CASH_OUT") cashOutTotal += amt;
    }

    const initialCash = Number(shift.initialCash) || 0;
    const computedExpectedCash = Math.round((initialCash + resolvedCashSales + cashInTotal - cashOutTotal) * 100) / 100;

    return {
      success: true,
      shift: serializeShift(shift, {
        totalCash: Math.round(resolvedCashSales * 100) / 100,
        totalCard: Math.round(resolvedCardSales * 100) / 100,
        totalTransfer: Math.round(resolvedTransferSales * 100) / 100,
        totalDeuna: Math.round(resolvedDeunaSales * 100) / 100,
        totalSales: Math.round(resolvedTotalSales * 100) / 100,
        expectedCash: computedExpectedCash,
      }),
    };
  } catch (error: any) {
    console.error("Error getting active cash shift:", error);
    return { success: false, error: "Error al consultar turno de caja activo." };
  }
}

/**
 * Apertura de un nuevo turno de caja.
 */
export async function openCashShift(params: {
  restaurantId: string;
  openedById: string;
  openedByName: string;
  initialCash: number;
}): Promise<{ success: boolean; shift?: SerializedCashShift; error?: string }> {
  try {
    await refreshUserSession();
    const auth = await verifyRestaurantOwnership(params.restaurantId);
    if (!auth.authorized) return { success: false, error: auth.error };

    // Verificar si ya existe un turno abierto
    const existing = await prisma.cashShift.findFirst({
      where: {
        restaurantId: params.restaurantId,
        status: "OPEN",
      },
    });

    if (existing) {
      return {
        success: false,
        error: "Ya existe un turno de caja abierto para este negocio. Debe cerrarlo antes de iniciar otro.",
      };
    }

    const initialAmount = Math.max(0, Math.round((Number(params.initialCash) || 0) * 100) / 100);

    const shift = await prisma.cashShift.create({
      data: {
        restaurantId: params.restaurantId,
        openedById: params.openedById || "anon",
        openedByName: params.openedByName || "Cajero",
        initialCash: initialAmount,
        expectedCash: initialAmount,
        status: "OPEN",
      },
      include: {
        movements: true,
      },
    });

    revalidatePath("/caja");
    revalidatePath("/admin");

    return { success: true, shift: serializeShift(shift) };
  } catch (error: any) {
    console.error("Error opening cash shift:", error);
    return { success: false, error: error.message || "Error al abrir el turno de caja." };
  }
}

/**
 * Registra un movimiento de entrada o salida de efectivo en caja chica.
 */
export async function addCashMovement(params: {
  shiftId: string;
  type: "CASH_IN" | "CASH_OUT";
  amount: number;
  reason: string;
  performedBy: string;
}): Promise<{ success: boolean; movement?: SerializedCashMovement; error?: string }> {
  try {
    await refreshUserSession();
    await ensureDbTables();

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      let clientPid: number | undefined;
      if (process.env.NODE_ENV === "test") {
        try {
          const { rows: pidRows } = await client.query("SELECT pg_backend_pid() AS pid");
          clientPid = pidRows[0]?.pid;
          if (__testCajaHooks.beforeCashMovementLock) {
            await __testCajaHooks.beforeCashMovementLock(params.shiftId, clientPid);
          }
        } catch {}
      }

      // Adquirir bloqueo pesimista exclusivo en la misma transacción para coordinar con closeCashShift
      const { rows: shiftRows } = await client.query(
        `SELECT id, "restaurantId", status, "expectedCash"::float
         FROM "CashShift"
         WHERE id = $1
         FOR UPDATE`,
        [params.shiftId]
      );

      if (shiftRows.length === 0) {
        await client.query("ROLLBACK");
        return { success: false, error: "Turno de caja no encontrado." };
      }

      const shift = shiftRows[0];
      if (shift.status !== "OPEN") {
        await client.query("ROLLBACK");
        return { success: false, error: "El turno de caja se encuentra cerrado." };
      }

      if (process.env.NODE_ENV === "test" && __testCajaHooks.afterCashMovementLock) {
        await __testCajaHooks.afterCashMovementLock(shift.id, clientPid);
      }

      const auth = await verifyRestaurantOwnership(shift.restaurantId);
      if (!auth.authorized) {
        await client.query("ROLLBACK");
        return { success: false, error: auth.error };
      }

      const cleanAmount = Math.max(0.01, Math.round((Number(params.amount) || 0) * 100) / 100);
      const cleanReason = (params.reason || "").trim();
      if (!cleanReason) {
        await client.query("ROLLBACK");
        return { success: false, error: "Debe especificar el motivo del movimiento." };
      }

      const delta = params.type === "CASH_IN" ? cleanAmount : -cleanAmount;
      const currentExpected = Number(shift.expectedCash) || 0;
      const newExpected = Math.max(0, Math.round((currentExpected + delta) * 100) / 100);

      const movId = "mov_" + Date.now().toString(36) + Math.random().toString(36).substring(2, 10);
      const { rows: movRows } = await client.query(
        `INSERT INTO "CashMovement" (id, "shiftId", type, amount, reason, "performedBy", "createdAt")
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         RETURNING id, "shiftId", type, amount::float, reason, "performedBy", "createdAt"`,
        [movId, params.shiftId, params.type, cleanAmount, cleanReason, params.performedBy || "Cajero"]
      );

      await client.query(
        `UPDATE "CashShift"
         SET "expectedCash" = $1,
             "updatedAt" = NOW()
         WHERE id = $2`,
        [newExpected, params.shiftId]
      );

      await client.query("COMMIT");
      const result = movRows[0];

      revalidatePath("/caja");

      return {
        success: true,
        movement: {
          id: result.id,
          shiftId: result.shiftId,
          type: result.type,
          amount: Number(result.amount),
          reason: result.reason,
          performedBy: result.performedBy,
          createdAt: result.createdAt instanceof Date ? result.createdAt.toISOString() : new Date(result.createdAt).toISOString(),
        },
      };
    } catch (txErr) {
      await client.query("ROLLBACK");
      throw txErr;
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error("Error adding cash movement:", error);
    return { success: false, error: error.message || "Error al registrar movimiento de efectivo." };
  }
}

/**
 * Cierre y arqueo ciego de turno de caja (Generación de Reporte Z).
 */
export async function closeCashShift(params: {
  shiftId: string;
  closedById: string;
  closedByName: string;
  actualCash: number;
  notes?: string;
}): Promise<{
  success: boolean;
  shift?: SerializedCashShift;
  report?: {
    shiftId: string;
    openedByName: string;
    closedByName: string;
    openedAt: string;
    closedAt: string;
    initialCash: number;
    totalCashSales: number;
    totalCardSales: number;
    totalTransferSales: number;
    totalDeunaSales: number;
    totalSales: number;
    cashInTotal: number;
    cashOutTotal: number;
    expectedCash: number;
    actualCash: number;
    difference: number;
    notes?: string;
  };
  error?: string;
}> {
  try {
    await refreshUserSession();
    await ensureDbTables();

    const client = await pool.connect();
    let shift: any = null;
    let updatedShift: any = null;
    let now = new Date();
    let initialCash = 0;
    let resolvedCashSales = 0;
    let resolvedCardSales = 0;
    let resolvedTransferSales = 0;
    let resolvedDeunaSales = 0;
    let resolvedTotalSales = 0;
    let cashInTotal = 0;
    let cashOutTotal = 0;
    let expectedCash = 0;
    let actualCash = 0;
    let difference = 0;

    try {
      await client.query("BEGIN");

      let clientPid: number | undefined;
      if (process.env.NODE_ENV === "test") {
        try {
          const { rows: pidRows } = await client.query("SELECT pg_backend_pid() AS pid");
          clientPid = pidRows[0]?.pid;
          if (__testCajaHooks.beforeCloseShiftLock) {
            await __testCajaHooks.beforeCloseShiftLock(params.shiftId, clientPid);
          }
        } catch {}
      }

      // 1. Bloqueo pesimista exclusivo y lectura atómica del turno en la misma conexión
      const { rows: lockedRows } = await client.query(
        `SELECT id, "restaurantId", status, "openedByName", "openedAt", "initialCash"::float,
                "totalCash"::float, "totalCard"::float, "totalTransfer"::float, "totalDeuna"::float, "totalSales"::float
         FROM "CashShift"
         WHERE id = $1
         FOR UPDATE`,
        [params.shiftId]
      );

      if (lockedRows.length === 0) {
        await client.query("ROLLBACK");
        return { success: false, error: "Turno de caja no encontrado." };
      }

      shift = lockedRows[0];
      if (shift.status !== "OPEN") {
        await client.query("ROLLBACK");
        return { success: false, error: "Este turno de caja ya fue cerrado previamente." };
      }

      if (process.env.NODE_ENV === "test" && __testCajaHooks.afterCloseShiftLock) {
        await __testCajaHooks.afterCloseShiftLock(shift.id, clientPid);
      }

      const auth = await verifyRestaurantOwnership(shift.restaurantId);
      if (!auth.authorized) {
        await client.query("ROLLBACK");
        return { success: false, error: auth.error };
      }

      // 2. Re-lectura atómica de órdenes asociadas a este turno en la MISMA conexión y transacción
      const { rows: orderRows } = await client.query(
        `SELECT id, total::float, "paymentMethod", status
         FROM "Order"
         WHERE "cashShiftId" = $1`,
        [params.shiftId]
      );

      // 3. Re-lectura atómica de movimientos asociados a este turno en la MISMA conexión y transacción
      const { rows: movementRows } = await client.query(
        `SELECT id, "shiftId", type, amount::float, reason, "performedBy", "createdAt"
         FROM "CashMovement"
         WHERE "shiftId" = $1`,
        [params.shiftId]
      );

      // 4. Totales de ventas asociadas a este turno (Live Order scan)
      let liveCashSales = 0;
      let liveCardSales = 0;
      let liveTransferSales = 0;
      let liveDeunaSales = 0;
      let liveTotalSales = 0;

      for (const order of orderRows) {
        // Solo sumamos órdenes no canceladas
        if (order.status === "CANCELLED") continue;

        const orderTotal = Number(order.total) || 0;
        liveTotalSales += orderTotal;

        const pm = (order.paymentMethod || "").toUpperCase();
        if (pm.includes("EFECTIVO") || pm === "CASH") {
          liveCashSales += orderTotal;
        } else if (pm.includes("TARJETA") || pm.includes("CARD") || pm.includes("PAYPHONE")) {
          liveCardSales += orderTotal;
        } else if (pm.includes("TRANSFERENCIA") || pm.includes("TRANSFER")) {
          liveTransferSales += orderTotal;
        } else if (pm.includes("DEUNA")) {
          liveDeunaSales += orderTotal;
        } else {
          liveCashSales += orderTotal; // Default fallback
        }
      }

      // 5. Reconciliación con acumuladores atómicos persistidos en el CashShift (soporte Split Pay y comandas)
      const dbCash = Number(shift.totalCash) || 0;
      const dbCard = Number(shift.totalCard) || 0;
      const dbTransfer = Number(shift.totalTransfer) || 0;
      const dbDeuna = Number(shift.totalDeuna) || 0;
      const dbSales = Number(shift.totalSales) || 0;

      resolvedCashSales = dbCash;
      resolvedCardSales = dbCard;
      resolvedTransferSales = dbTransfer;
      resolvedDeunaSales = dbDeuna;
      resolvedTotalSales = dbSales;

      if (resolvedTotalSales === 0 && liveTotalSales > 0) {
        resolvedCashSales = liveCashSales;
        resolvedCardSales = liveCardSales;
        resolvedTransferSales = liveTransferSales;
        resolvedDeunaSales = liveDeunaSales;
        resolvedTotalSales = liveTotalSales;
      } else if (liveTotalSales > resolvedTotalSales) {
        resolvedTotalSales = liveTotalSales;
        resolvedCashSales += Math.max(0, liveCashSales - dbCash);
        resolvedCardSales += Math.max(0, liveCardSales - dbCard);
        resolvedTransferSales += Math.max(0, liveTransferSales - dbTransfer);
        resolvedDeunaSales += Math.max(0, liveDeunaSales - dbDeuna);
      }

      // 6. Totales de movimientos de caja chica
      cashInTotal = 0;
      cashOutTotal = 0;
      for (const m of movementRows) {
        const amt = Number(m.amount) || 0;
        if (m.type === "CASH_IN") cashInTotal += amt;
        if (m.type === "CASH_OUT") cashOutTotal += amt;
      }

      initialCash = Number(shift.initialCash) || 0;
      expectedCash = Math.round((initialCash + resolvedCashSales + cashInTotal - cashOutTotal) * 100) / 100;
      actualCash = Math.round((Number(params.actualCash) || 0) * 100) / 100;
      difference = Math.round((actualCash - expectedCash) * 100) / 100;

      now = new Date();

      // 7. Cierre atómico del turno en la MISMA conexión y transacción
      const { rows: updatedRows } = await client.query(
        `UPDATE "CashShift"
         SET status = 'CLOSED',
             "closedById" = $1,
             "closedByName" = $2,
             "closedAt" = $3,
             "expectedCash" = $4,
             "actualCash" = $5,
             "difference" = $6,
             "totalCash" = $7,
             "totalCard" = $8,
             "totalTransfer" = $9,
             "totalDeuna" = $10,
             "totalSales" = $11,
             "notes" = $12,
             "updatedAt" = NOW()
         WHERE id = $13
         RETURNING *`,
        [
          params.closedById || "anon",
          params.closedByName || "Cajero",
          now,
          expectedCash,
          actualCash,
          difference,
          Math.round(resolvedCashSales * 100) / 100,
          Math.round(resolvedCardSales * 100) / 100,
          Math.round(resolvedTransferSales * 100) / 100,
          Math.round(resolvedDeunaSales * 100) / 100,
          Math.round(resolvedTotalSales * 100) / 100,
          params.notes?.trim() || null,
          params.shiftId,
        ]
      );

      await client.query("COMMIT");
      updatedShift = updatedRows[0];
      updatedShift.movements = movementRows;
    } catch (lockErr) {
      await client.query("ROLLBACK");
      throw lockErr;
    } finally {
      client.release();
    }

    revalidatePath("/caja");
    revalidatePath("/admin");

    const serialized = serializeShift(updatedShift);

    return {
      success: true,
      shift: serialized,
      report: {
        shiftId: updatedShift.id,
        openedByName: updatedShift.openedByName,
        closedByName: updatedShift.closedByName || "Cajero",
        openedAt: (updatedShift.openedAt instanceof Date ? updatedShift.openedAt : new Date(updatedShift.openedAt)).toISOString(),
        closedAt: now.toISOString(),
        initialCash,
        totalCashSales: Math.round(resolvedCashSales * 100) / 100,
        totalCardSales: Math.round(resolvedCardSales * 100) / 100,
        totalTransferSales: Math.round(resolvedTransferSales * 100) / 100,
        totalDeunaSales: Math.round(resolvedDeunaSales * 100) / 100,
        totalSales: Math.round(resolvedTotalSales * 100) / 100,
        cashInTotal: Math.round(cashInTotal * 100) / 100,
        cashOutTotal: Math.round(cashOutTotal * 100) / 100,
        expectedCash,
        actualCash,
        difference,
        notes: params.notes?.trim(),
      },
    };
  } catch (error: any) {
    console.error("Error closing cash shift:", error);
    return { success: false, error: error.message || "Error al cerrar el turno de caja." };
  }
}
