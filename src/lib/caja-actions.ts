"use server";

import { prisma } from "@/lib/db";
import { pool, ensureDbTables } from "@/lib/db-pool";
import { getUserSession, getSuperAdminSession, refreshUserSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { emitStockActualizado, emitProductoActualizado, emitPedidoActualizado, emitCitaActualizada } from "@/lib/socket-server";

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

      // Buscar turno de caja activo para vincular la venta automáticamente
      const activeShift = await tx.cashShift.findFirst({
        where: { restaurantId, status: "OPEN" },
        select: { id: true },
      });

      const rest = await tx.restaurant.findUnique({
        where: { id: restaurantId },
        select: { id: true, name: true, testMode: true },
      });
      const isTestSale = Boolean(rest?.testMode);

      // 2. Crear Pedido / Ticket de Venta oficial
      const order = await tx.order.create({
        data: {
          restaurantId,
          cashShiftId: activeShift?.id || null,
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

      return { orderId: order.id, orderNumber: order.orderNumber, total: finalTotal, updatedDishes, isTestSale };
    });

    // Sincronizar venta de Caja POS a la tabla de PostgreSQL pedidos para visibilidad inmediata en módulo mesero
    try {
      await ensureDbTables();
      await pool.query(
        `INSERT INTO pedidos (id, negocio_id, mesa, estado, total, es_prueba, vertical, metadata)
         VALUES ($1, $2, 'Caja POS', 'pagado', $3, $4, 'menuqr', $5)
         ON CONFLICT (id) DO UPDATE SET estado = 'pagado', total = $3`,
        [
          result.orderId,
          restaurantId,
          result.total,
          result.isTestSale,
          JSON.stringify({ tipo_pedido: "caja_pos", paymentMethod: data.paymentMethod }),
        ]
      );
      for (const it of data.items) {
        await pool.query(
          `INSERT INTO pedido_items (pedido_id, nombre, cantidad, precio, es_añadido, estado_item)
           VALUES ($1, $2, $3, $4, false, 'pagado')`,
          [result.orderId, it.name, it.quantity, it.price]
        );
      }

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

    const totalToSettle = Math.max(0, Number(data.total) || 0);

    await ensureDbTables();

    // 1. Marcar como pagado o completada en la tabla relacional de pedidos
    if (data.orderId) {
      const { rows: orderRows } = await pool.query(
        `SELECT id, vertical, mesa, metadata, total::float, cliente_telefono, cliente_nombre FROM pedidos WHERE id = $1 AND negocio_id = $2 LIMIT 1`,
        [data.orderId, restaurantId]
      );

      if (orderRows.length > 0) {
        const orderRecord = orderRows[0];
        let meta: any = {};
        try {
          meta = typeof orderRecord.metadata === "string" ? JSON.parse(orderRecord.metadata) : (orderRecord.metadata || {});
        } catch {}

        const isCitaOrder = orderRecord.vertical === "citas" || String(orderRecord.mesa).toUpperCase() === "CITA";

        if (isCitaOrder) {
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
                cLabels = typeof rest?.customLabels === "string" ? JSON.parse(rest.customLabels) : (rest?.customLabels || {});
              } catch {}
              const specialists = Array.isArray(cLabels.specialists) ? cLabels.specialists : [];
              const spec = specialists.find((s: any) => s.id === meta.especialista_id);
              const commPercent = Number(spec?.commissionPercentage) || 0;
              if (commPercent > 0) {
                const servicePrice = Number(meta.precio_estimado) || Number(orderRecord.total) || 0;
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
          if (orderRecord.cliente_telefono) {
            try {
              const cust = await prisma.customer.findFirst({
                where: { restaurantId, phone: orderRecord.cliente_telefono },
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

          try {
            emitCitaActualizada(restaurantId, updatedCitaRows[0]);
          } catch {}
        } else {
          await pool.query(
            `UPDATE pedidos 
             SET estado = 'pagado',
                 solicita_mesero = false
             WHERE id = $1 AND negocio_id = $2`,
            [data.orderId, restaurantId]
          );
        }
      }
    }

    // 2. Si es una mesa de salón, liberar todas las comandas activas huérfanas de esa mesa
    if (data.mesa && data.mesa !== "Delivery" && data.mesa !== "LLEVAR" && data.mesa !== "CATALOGO") {
      await pool.query(
        `UPDATE pedidos 
         SET estado = 'pagado',
             solicita_mesero = false
         WHERE negocio_id = $1 
           AND LOWER(TRIM(mesa)) = LOWER(TRIM($2))
           AND estado NOT IN ('pagado', 'cancelado')`,
        [restaurantId, data.mesa]
      );
    }

    // 3. Vincular y registrar la venta en el Turno de Caja (CashShift) activo
    const activeShift = await prisma.cashShift.findFirst({
      where: { restaurantId, status: "OPEN" },
    });

    // 4. Si existe en el modelo Order de Prisma, actualizarlo y asociarlo al turno
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

      // Desglose de pagos si proviene de cobro dividido (Split Pay)
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

    // 5. Si existe sesión de mesa en TableSession, cerrar y registrar pagos de split
    if (data.mesa) {
      try {
        const tableSess = await prisma.tableSession.findFirst({
          where: { restaurantId, tableName: data.mesa, status: { in: ["OPEN", "PARTIALLY_PAID"] } },
        });

        if (tableSess) {
          if (data.splitDetails && data.splitDetails.length > 0) {
            for (const d of data.splitDetails) {
              await prisma.tableSplitPayment.create({
                data: {
                  tableSessionId: tableSess.id,
                  payerName: d.payerName || "Pago en Caja",
                  amount: d.amount,
                  paymentMethod: d.paymentMethod.toLowerCase(),
                  status: "COMPLETED",
                  confirmedAt: new Date(),
                },
              });
            }
          }
          await prisma.tableSession.update({
            where: { id: tableSess.id },
            data: { status: "CLOSED", paidAmount: tableSess.totalAmount },
          });
        }
      } catch {}
    }

    // 5.b. Si vino una reserva asociada, marcarla como completada y asociar la orden
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
      revalidatePath(`/${restaurant.slug}/mesas`);
      revalidatePath(`/${restaurant.slug}/cocina`);
      revalidatePath(`/${restaurant.slug}/repartidor`);
    }

    return {
      success: true,
      orderId: data.orderId,
      message: `Cobro de $${totalToSettle.toFixed(2)} registrado exitosamente. Mesa liberada.`,
      total: totalToSettle,
    };
  } catch (error: any) {
    console.error("Error in settleOrderInCashShiftAction:", error);
    return { error: error.message || "Error al liquidar el cobro en caja." };
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
  return {
    id: shift.id,
    restaurantId: shift.restaurantId,
    openedById: shift.openedById,
    openedByName: shift.openedByName,
    openedAt: shift.openedAt ? shift.openedAt.toISOString() : new Date().toISOString(),
    closedById: shift.closedById || null,
    closedByName: shift.closedByName || null,
    closedAt: shift.closedAt ? shift.closedAt.toISOString() : null,
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
      createdAt: m.createdAt ? m.createdAt.toISOString() : new Date().toISOString(),
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

    const shift = await prisma.cashShift.findUnique({
      where: { id: params.shiftId },
      select: { id: true, restaurantId: true, status: true, expectedCash: true },
    });

    if (!shift) {
      return { success: false, error: "Turno de caja no encontrado." };
    }

    if (shift.status !== "OPEN") {
      return { success: false, error: "El turno de caja se encuentra cerrado." };
    }

    const auth = await verifyRestaurantOwnership(shift.restaurantId);
    if (!auth.authorized) return { success: false, error: auth.error };

    const cleanAmount = Math.max(0.01, Math.round((Number(params.amount) || 0) * 100) / 100);
    const cleanReason = (params.reason || "").trim();
    if (!cleanReason) {
      return { success: false, error: "Debe especificar el motivo del movimiento." };
    }

    const delta = params.type === "CASH_IN" ? cleanAmount : -cleanAmount;
    const currentExpected = Number(shift.expectedCash) || 0;
    const newExpected = Math.max(0, Math.round((currentExpected + delta) * 100) / 100);

    const result = await prisma.$transaction(async (tx) => {
      const mov = await tx.cashMovement.create({
        data: {
          shiftId: params.shiftId,
          type: params.type,
          amount: cleanAmount,
          reason: cleanReason,
          performedBy: params.performedBy || "Cajero",
        },
      });

      await tx.cashShift.update({
        where: { id: params.shiftId },
        data: { expectedCash: newExpected },
      });

      return mov;
    });

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
        createdAt: result.createdAt.toISOString(),
      },
    };
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

    const shift = await prisma.cashShift.findUnique({
      where: { id: params.shiftId },
      include: {
        movements: true,
        orders: {
          select: {
            id: true,
            total: true,
            paymentMethod: true,
            status: true,
          },
        },
      },
    });

    if (!shift) {
      return { success: false, error: "Turno de caja no encontrado." };
    }

    if (shift.status !== "OPEN") {
      return { success: false, error: "Este turno de caja ya fue cerrado previamente." };
    }

    const auth = await verifyRestaurantOwnership(shift.restaurantId);
    if (!auth.authorized) return { success: false, error: auth.error };

    // 1. Totales de ventas asociadas a este turno (Live Order scan)
    let liveCashSales = 0;
    let liveCardSales = 0;
    let liveTransferSales = 0;
    let liveDeunaSales = 0;
    let liveTotalSales = 0;

    for (const order of shift.orders) {
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

    // Reconciliación con acumuladores atómicos persistidos en el CashShift (soporte Split Pay y comandas)
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

    // 2. Totales de movimientos de caja chica
    let cashInTotal = 0;
    let cashOutTotal = 0;
    for (const m of shift.movements) {
      const amt = Number(m.amount) || 0;
      if (m.type === "CASH_IN") cashInTotal += amt;
      if (m.type === "CASH_OUT") cashOutTotal += amt;
    }

    const initialCash = Number(shift.initialCash) || 0;
    const expectedCash = Math.round((initialCash + resolvedCashSales + cashInTotal - cashOutTotal) * 100) / 100;
    const actualCash = Math.round((Number(params.actualCash) || 0) * 100) / 100;
    const difference = Math.round((actualCash - expectedCash) * 100) / 100;

    const now = new Date();

    const updatedShift = await prisma.cashShift.update({
      where: { id: params.shiftId },
      data: {
        status: "CLOSED",
        closedById: params.closedById || "anon",
        closedByName: params.closedByName || "Cajero",
        closedAt: now,
        expectedCash,
        actualCash,
        difference,
        totalCash: Math.round(resolvedCashSales * 100) / 100,
        totalCard: Math.round(resolvedCardSales * 100) / 100,
        totalTransfer: Math.round(resolvedTransferSales * 100) / 100,
        totalDeuna: Math.round(resolvedDeunaSales * 100) / 100,
        totalSales: Math.round(resolvedTotalSales * 100) / 100,
        notes: params.notes?.trim() || null,
      },
      include: {
        movements: true,
      },
    });

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
        openedAt: updatedShift.openedAt.toISOString(),
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
