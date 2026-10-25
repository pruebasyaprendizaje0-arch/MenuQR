"use server";

import { prisma } from "@/lib/db";
import { getUserSession, getSuperAdminSession, refreshUserSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";

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
    return { authorized: false, error: "Restaurante no encontrado." };
  }

  if (restaurant.userId !== session.userId) {
    return { authorized: false, error: "No tiene permisos para modificar este negocio." };
  }

  return { authorized: true };
}

// ==========================================
// 1. OBTENER DATOS INTEGRALES DE INVENTARIO
// ==========================================
export async function getInventoryDataAction(restaurantId: string) {
  try {
    await refreshUserSession();
    const auth = await verifyRestaurantOwnership(restaurantId);
    if (!auth.authorized) return { error: auth.error };

    // Auto-sincronizar proveedores habituales para platos e insumos que hayan sido
    // comprados u ordenados con un proveedor pero que aún tengan supplierId en null
    try {
      const dishesNeedingSupplier = await prisma.dish.findMany({
        where: { restaurantId, supplierId: null },
        include: {
          purchaseOrderItems: {
            where: { purchaseOrder: { supplierId: { not: null } } },
            include: { purchaseOrder: { select: { supplierId: true } } },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      });

      for (const d of dishesNeedingSupplier) {
        const foundSupId = d.purchaseOrderItems[0]?.purchaseOrder?.supplierId;
        if (foundSupId) {
          await prisma.dish.update({
            where: { id: d.id },
            data: { supplierId: foundSupId },
          });
        }
      }

      const suppliesNeedingSupplier = await prisma.supplyItem.findMany({
        where: { restaurantId, supplierId: null },
        include: {
          purchaseOrderItems: {
            where: { purchaseOrder: { supplierId: { not: null } } },
            include: { purchaseOrder: { select: { supplierId: true } } },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      });

      for (const s of suppliesNeedingSupplier) {
        const foundSupId = s.purchaseOrderItems[0]?.purchaseOrder?.supplierId;
        if (foundSupId) {
          await prisma.supplyItem.update({
            where: { id: s.id },
            data: { supplierId: foundSupId },
          });
        }
      }
    } catch (syncErr) {
      console.warn("Aviso al auto-sincronizar proveedores de órdenes de compra:", syncErr);
    }

    const [suppliers, supplyItems, dishes, purchaseOrders] = await Promise.all([
      prisma.supplier.findMany({
        where: { restaurantId },
        orderBy: { name: "asc" },
        include: {
          _count: {
            select: {
              dishes: true,
              supplyItems: true,
              purchaseOrders: true,
            },
          },
        },
      }),
      prisma.supplyItem.findMany({
        where: { restaurantId },
        orderBy: { name: "asc" },
        include: {
          supplier: true,
          _count: {
            select: { recipeItems: true },
          },
        },
      }),
      prisma.dish.findMany({
        where: { restaurantId },
        orderBy: { name: "asc" },
        include: {
          category: { select: { id: true, name: true } },
          supplier: { select: { id: true, name: true, phone: true } },
          recipeItems: {
            include: {
              supplyItem: true,
            },
          },
        },
      }),
      prisma.purchaseOrder.findMany({
        where: { restaurantId },
        orderBy: { createdAt: "desc" },
        take: 50,
        include: {
          supplier: true,
          items: {
            include: {
              dish: { select: { id: true, name: true } },
              supplyItem: { select: { id: true, name: true, unit: true } },
            },
          },
        },
      }),
    ]);

    return {
      success: true,
      suppliers,
      supplyItems,
      dishes,
      purchaseOrders,
    };
  } catch (error: any) {
    console.error("Error in getInventoryDataAction:", error);
    return { error: error?.message || "Error al cargar datos de inventario." };
  }
}

// ==========================================
// 2. CRUD DE PROVEEDORES
// ==========================================
export async function createSupplierAction(
  restaurantId: string,
  data: {
    name: string;
    contactName?: string;
    phone?: string;
    email?: string;
    taxId?: string;
    address?: string;
    notes?: string;
  }
) {
  try {
    await refreshUserSession();
    const auth = await verifyRestaurantOwnership(restaurantId);
    if (!auth.authorized) return { error: auth.error };

    if (!data.name || data.name.trim() === "") {
      return { error: "El nombre del proveedor es obligatorio." };
    }

    const supplier = await prisma.supplier.create({
      data: {
        restaurantId,
        name: data.name.trim(),
        contactName: data.contactName?.trim() || null,
        phone: data.phone?.trim() || null,
        email: data.email?.trim() || null,
        taxId: data.taxId?.trim() || null,
        address: data.address?.trim() || null,
        notes: data.notes?.trim() || null,
      },
    });

    revalidatePath("/admin");
    return { success: true, supplier };
  } catch (error: any) {
    console.error("Error in createSupplierAction:", error);
    return { error: error?.message || "Error al crear proveedor." };
  }
}

export async function updateSupplierAction(
  supplierId: string,
  data: {
    name: string;
    contactName?: string;
    phone?: string;
    email?: string;
    taxId?: string;
    address?: string;
    notes?: string;
  }
) {
  try {
    await refreshUserSession();
    const supplier = await prisma.supplier.findUnique({
      where: { id: supplierId },
      select: { restaurantId: true },
    });
    if (!supplier) return { error: "Proveedor no encontrado." };

    const auth = await verifyRestaurantOwnership(supplier.restaurantId);
    if (!auth.authorized) return { error: auth.error };

    const updated = await prisma.supplier.update({
      where: { id: supplierId },
      data: {
        name: data.name.trim(),
        contactName: data.contactName?.trim() || null,
        phone: data.phone?.trim() || null,
        email: data.email?.trim() || null,
        taxId: data.taxId?.trim() || null,
        address: data.address?.trim() || null,
        notes: data.notes?.trim() || null,
      },
    });

    revalidatePath("/admin");
    return { success: true, supplier: updated };
  } catch (error: any) {
    console.error("Error in updateSupplierAction:", error);
    return { error: error?.message || "Error al actualizar proveedor." };
  }
}

export async function deleteSupplierAction(supplierId: string) {
  try {
    await refreshUserSession();
    const supplier = await prisma.supplier.findUnique({
      where: { id: supplierId },
      select: { restaurantId: true },
    });
    if (!supplier) return { error: "Proveedor no encontrado." };

    const auth = await verifyRestaurantOwnership(supplier.restaurantId);
    if (!auth.authorized) return { error: auth.error };

    await prisma.supplier.delete({ where: { id: supplierId } });
    revalidatePath("/admin");
    return { success: true };
  } catch (error: any) {
    console.error("Error in deleteSupplierAction:", error);
    return { error: error?.message || "Error al eliminar proveedor." };
  }
}

// ==========================================
// 3. CRUD DE INSUMOS (MATERIAS PRIMAS)
// ==========================================
export async function createSupplyItemAction(
  restaurantId: string,
  data: {
    name: string;
    unit: string;
    currentStock: number;
    minStock: number;
    costPerUnit: number;
    supplierId?: string | null;
  }
) {
  try {
    await refreshUserSession();
    const auth = await verifyRestaurantOwnership(restaurantId);
    if (!auth.authorized) return { error: auth.error };

    if (!data.name || data.name.trim() === "") {
      return { error: "El nombre del insumo es obligatorio." };
    }

    const item = await prisma.supplyItem.create({
      data: {
        restaurantId,
        name: data.name.trim(),
        unit: data.unit?.trim() || "unidad",
        currentStock: Number(data.currentStock) || 0,
        minStock: Number(data.minStock) || 0,
        costPerUnit: Number(data.costPerUnit) || 0,
        supplierId: data.supplierId || null,
      },
    });

    revalidatePath("/admin");
    return { success: true, item };
  } catch (error: any) {
    console.error("Error in createSupplyItemAction:", error);
    return { error: error?.message || "Error al crear insumo." };
  }
}

export async function updateSupplyItemAction(
  supplyItemId: string,
  data: {
    name: string;
    unit: string;
    currentStock: number;
    minStock: number;
    costPerUnit: number;
    supplierId?: string | null;
  }
) {
  try {
    await refreshUserSession();
    const existing = await prisma.supplyItem.findUnique({
      where: { id: supplyItemId },
      select: { restaurantId: true },
    });
    if (!existing) return { error: "Insumo no encontrado." };

    const auth = await verifyRestaurantOwnership(existing.restaurantId);
    if (!auth.authorized) return { error: auth.error };

    const item = await prisma.supplyItem.update({
      where: { id: supplyItemId },
      data: {
        name: data.name.trim(),
        unit: data.unit?.trim() || "unidad",
        currentStock: Number(data.currentStock) || 0,
        minStock: Number(data.minStock) || 0,
        costPerUnit: Number(data.costPerUnit) || 0,
        supplierId: data.supplierId || null,
      },
    });

    revalidatePath("/admin");
    return { success: true, item };
  } catch (error: any) {
    console.error("Error in updateSupplyItemAction:", error);
    return { error: error?.message || "Error al actualizar insumo." };
  }
}

export async function deleteSupplyItemAction(supplyItemId: string) {
  try {
    await refreshUserSession();
    const existing = await prisma.supplyItem.findUnique({
      where: { id: supplyItemId },
      select: { restaurantId: true },
    });
    if (!existing) return { error: "Insumo no encontrado." };

    const auth = await verifyRestaurantOwnership(existing.restaurantId);
    if (!auth.authorized) return { error: auth.error };

    await prisma.supplyItem.delete({ where: { id: supplyItemId } });
    revalidatePath("/admin");
    return { success: true };
  } catch (error: any) {
    console.error("Error in deleteSupplyItemAction:", error);
    return { error: error?.message || "Error al eliminar insumo." };
  }
}

// ==========================================
// 4. AJUSTE RÁPIDO DE STOCK Y MERMAS
// ==========================================
export async function adjustInventoryStockAction(params: {
  itemType: "DISH" | "SUPPLY";
  itemId: string;
  delta: number;
  reason?: string;
}) {
  try {
    await refreshUserSession();
    const { itemType, itemId, delta } = params;

    let restaurantSlug: string | null = null;
    if (itemType === "DISH") {
      const dish = await prisma.dish.findUnique({
        where: { id: itemId },
        select: {
          id: true,
          restaurantId: true,
          stock: true,
          restaurant: { select: { slug: true } },
        },
      });
      if (!dish) return { error: "Producto no encontrado." };

      const auth = await verifyRestaurantOwnership(dish.restaurantId);
      if (!auth.authorized) return { error: auth.error };

      restaurantSlug = dish.restaurant.slug;
      const current = typeof dish.stock === "number" ? dish.stock : 0;
      const nextStock = Math.max(0, current + delta);

      await prisma.dish.update({
        where: { id: itemId },
        data: {
          stock: nextStock,
          trackStock: true,
          isAvailable: nextStock > 0,
        },
      });
    } else {
      const supply = await prisma.supplyItem.findUnique({
        where: { id: itemId },
        select: {
          id: true,
          restaurantId: true,
          currentStock: true,
          restaurant: { select: { slug: true } },
        },
      });
      if (!supply) return { error: "Insumo no encontrado." };

      const auth = await verifyRestaurantOwnership(supply.restaurantId);
      if (!auth.authorized) return { error: auth.error };

      restaurantSlug = supply.restaurant.slug;
      const current = supply.currentStock || 0;
      const nextStock = Math.max(0, current + delta);

      await prisma.supplyItem.update({
        where: { id: itemId },
        data: {
          currentStock: nextStock,
        },
      });
    }

    revalidatePath("/admin");
    revalidatePath("/caja");
    if (restaurantSlug) {
      revalidatePath(`/${restaurantSlug}`);
    }
    return { success: true };
  } catch (error: any) {
    console.error("Error in adjustInventoryStockAction:", error);
    return { error: error?.message || "Error al ajustar existencias." };
  }
}

export async function setInventoryStockAction(params: {
  itemType: "DISH" | "SUPPLY";
  itemId: string;
  newStock: number;
}) {
  try {
    await refreshUserSession();
    const { itemType, itemId, newStock } = params;
    const sanitizedStock = Math.max(0, Number(newStock) || 0);

    let restaurantSlug: string | null = null;
    if (itemType === "DISH") {
      const dish = await prisma.dish.findUnique({
        where: { id: itemId },
        select: {
          id: true,
          restaurantId: true,
          restaurant: { select: { slug: true } },
        },
      });
      if (!dish) return { error: "Producto no encontrado." };

      const auth = await verifyRestaurantOwnership(dish.restaurantId);
      if (!auth.authorized) return { error: auth.error };

      restaurantSlug = dish.restaurant.slug;
      await prisma.dish.update({
        where: { id: itemId },
        data: {
          stock: Math.round(sanitizedStock),
          trackStock: true,
          isAvailable: sanitizedStock > 0,
        },
      });
    } else {
      const supply = await prisma.supplyItem.findUnique({
        where: { id: itemId },
        select: {
          id: true,
          restaurantId: true,
          restaurant: { select: { slug: true } },
        },
      });
      if (!supply) return { error: "Insumo no encontrado." };

      const auth = await verifyRestaurantOwnership(supply.restaurantId);
      if (!auth.authorized) return { error: auth.error };

      restaurantSlug = supply.restaurant.slug;
      await prisma.supplyItem.update({
        where: { id: itemId },
        data: {
          currentStock: sanitizedStock,
        },
      });
    }

    revalidatePath("/admin");
    revalidatePath("/caja");
    if (restaurantSlug) {
      revalidatePath(`/${restaurantSlug}`);
    }
    return { success: true };
  } catch (error: any) {
    console.error("Error in setInventoryStockAction:", error);
    return { error: error?.message || "Error al actualizar existencias." };
  }
}

// ==========================================
// 5. RECETAS SENCILLAS (ESCANDALLO BÁSICO)
// ==========================================
export async function saveDishRecipeAction(
  dishId: string,
  ingredients: Array<{ supplyItemId: string; quantity: number }>
) {
  try {
    await refreshUserSession();
    const dish = await prisma.dish.findUnique({
      where: { id: dishId },
      select: { id: true, restaurantId: true },
    });
    if (!dish) return { error: "Producto / Plato no encontrado." };

    const auth = await verifyRestaurantOwnership(dish.restaurantId);
    if (!auth.authorized) return { error: auth.error };

    // Validar y obtener costos de los insumos
    const supplyItemIds = ingredients.map((i) => i.supplyItemId);
    const supplyItems = await prisma.supplyItem.findMany({
      where: { id: { in: supplyItemIds } },
    });

    const supplyMap = new Map(supplyItems.map((s) => [s.id, s]));

    let calculatedCost = 0;
    for (const ing of ingredients) {
      const s = supplyMap.get(ing.supplyItemId);
      if (s) {
        calculatedCost += (s.costPerUnit || 0) * (Number(ing.quantity) || 0);
      }
    }

    // Transacción: limpiar receta anterior, agregar nuevos items y actualizar costo de plato
    await prisma.$transaction([
      prisma.dishRecipeItem.deleteMany({
        where: { dishId },
      }),
      ...ingredients.map((ing) =>
        prisma.dishRecipeItem.create({
          data: {
            dishId,
            supplyItemId: ing.supplyItemId,
            quantity: Math.max(0.001, Number(ing.quantity) || 1),
          },
        })
      ),
      prisma.dish.update({
        where: { id: dishId },
        data: {
          costPrice: Math.round(calculatedCost * 100) / 100,
        },
      }),
    ]);

    revalidatePath("/admin");
    return { success: true, calculatedCost: Math.round(calculatedCost * 100) / 100 };
  } catch (error: any) {
    console.error("Error in saveDishRecipeAction:", error);
    return { error: error?.message || "Error al guardar receta." };
  }
}

// ==========================================
// 6. ÓRDENES DE COMPRA CON CONVERSOR DE CAJAS
// ==========================================
export async function createPurchaseOrderAction(
  restaurantId: string,
  data: {
    supplierId?: string | null;
    notes?: string;
    items: Array<{
      itemType: "DISH" | "SUPPLY";
      dishId?: string | null;
      supplyItemId?: string | null;
      name: string;
      packageType: string; // UNIDAD, CAJA, PACK, FARDO, BULTO
      packageQuantity: number; // Ej: 2
      unitsPerPackage: number; // Ej: 24 (CONVERSOR)
      costPerPackage: number; // Ej: $18.00
    }>;
  }
) {
  try {
    await refreshUserSession();
    const auth = await verifyRestaurantOwnership(restaurantId);
    if (!auth.authorized) return { error: auth.error };

    if (!data.items || data.items.length === 0) {
      return { error: "La orden de compra debe contener al menos un producto o insumo." };
    }

    let calculatedTotal = 0;
    const sanitizedItems = data.items.map((item) => {
      const packageQuantity = Math.max(0.1, Number(item.packageQuantity) || 1);
      const unitsPerPackage = Math.max(1, Number(item.unitsPerPackage) || 1);
      const costPerPackage = Math.max(0, Number(item.costPerPackage) || 0);

      const totalUnits = packageQuantity * unitsPerPackage;
      const costPerUnit = unitsPerPackage > 0 ? costPerPackage / unitsPerPackage : 0;
      const totalCost = packageQuantity * costPerPackage;

      calculatedTotal += totalCost;

      return {
        itemType: item.itemType,
        dishId: item.dishId || null,
        supplyItemId: item.supplyItemId || null,
        name: item.name.trim(),
        packageType: item.packageType || "UNIDAD",
        packageQuantity,
        unitsPerPackage,
        totalUnits,
        costPerPackage,
        costPerUnit: Math.round(costPerUnit * 1000) / 1000,
        totalCost: Math.round(totalCost * 100) / 100,
      };
    });

    const po = await prisma.purchaseOrder.create({
      data: {
        restaurantId,
        supplierId: data.supplierId || null,
        notes: data.notes?.trim() || null,
        totalCost: Math.round(calculatedTotal * 100) / 100,
        status: "PENDING",
        items: {
          create: sanitizedItems,
        },
      },
      include: {
        supplier: true,
        items: true,
      },
    });

    // Si la orden de compra tiene proveedor asignado, asociar inmediatamente
    // como proveedor habitual a los platos e insumos de la orden que no tengan proveedor
    if (data.supplierId) {
      try {
        for (const item of sanitizedItems) {
          if (item.itemType === "DISH" && item.dishId) {
            const currentDish = await prisma.dish.findUnique({
              where: { id: item.dishId },
              select: { supplierId: true },
            });
            if (currentDish && !currentDish.supplierId) {
              await prisma.dish.update({
                where: { id: item.dishId },
                data: { supplierId: data.supplierId },
              });
            }
          } else if (item.itemType === "SUPPLY" && item.supplyItemId) {
            const currentSupply = await prisma.supplyItem.findUnique({
              where: { id: item.supplyItemId },
              select: { supplierId: true },
            });
            if (currentSupply && !currentSupply.supplierId) {
              await prisma.supplyItem.update({
                where: { id: item.supplyItemId },
                data: { supplierId: data.supplierId },
              });
            }
          }
        }
      } catch (linkErr) {
        console.warn("Aviso al enlazar proveedor habitual en orden de compra:", linkErr);
      }
    }

    revalidatePath("/admin");
    return { success: true, purchaseOrder: po };
  } catch (error: any) {
    console.error("Error in createPurchaseOrderAction:", error);
    return { error: error?.message || "Error al generar la orden de compra." };
  }
}

// RECEPCIÓN DE MERCADERÍA: Suma automáticamente al stock con factor de conversión
export async function receivePurchaseOrderAction(
  orderId: string,
  updateCosts: boolean = true
) {
  try {
    await refreshUserSession();
    const po = await prisma.purchaseOrder.findUnique({
      where: { id: orderId },
      include: {
        items: true,
      },
    });

    if (!po) return { error: "Orden de compra no encontrada." };
    if (po.status === "RECEIVED") return { error: "Esta orden ya fue recibida anteriormente." };
    if (po.status === "CANCELLED") return { error: "Esta orden está cancelada." };

    const auth = await verifyRestaurantOwnership(po.restaurantId);
    if (!auth.authorized) return { error: auth.error };

    // Procesar cada ítem de la orden incrementando stock
    for (const item of po.items) {
      if (item.itemType === "DISH" && item.dishId) {
        const dish = await prisma.dish.findUnique({
          where: { id: item.dishId },
          select: { stock: true },
        });
        const current = typeof dish?.stock === "number" ? dish.stock : 0;
        const nextStock = current + Math.round(item.totalUnits);

        await prisma.dish.update({
          where: { id: item.dishId },
          data: {
            stock: nextStock,
            trackStock: true,
            isAvailable: true,
            ...(updateCosts && item.costPerUnit > 0 ? { costPrice: item.costPerUnit } : {}),
            ...(po.supplierId ? { supplierId: po.supplierId } : {}),
          },
        });
      } else if (item.itemType === "SUPPLY" && item.supplyItemId) {
        const supply = await prisma.supplyItem.findUnique({
          where: { id: item.supplyItemId },
          select: { currentStock: true },
        });
        const current = supply?.currentStock || 0;
        const nextStock = current + item.totalUnits;

        await prisma.supplyItem.update({
          where: { id: item.supplyItemId },
          data: {
            currentStock: nextStock,
            ...(updateCosts && item.costPerUnit > 0 ? { costPerUnit: item.costPerUnit } : {}),
            ...(po.supplierId ? { supplierId: po.supplierId } : {}),
          },
        });
      }
    }

    // Marcar como recibida
    const updatedOrder = await prisma.purchaseOrder.update({
      where: { id: orderId },
      data: {
        status: "RECEIVED",
        receivedAt: new Date(),
      },
      include: {
        items: true,
        supplier: true,
      },
    });

    revalidatePath("/admin");
    return { success: true, purchaseOrder: updatedOrder };
  } catch (error: any) {
    console.error("Error in receivePurchaseOrderAction:", error);
    return { error: error?.message || "Error al recibir mercadería." };
  }
}

export async function cancelPurchaseOrderAction(orderId: string) {
  try {
    await refreshUserSession();
    const po = await prisma.purchaseOrder.findUnique({
      where: { id: orderId },
      select: { id: true, restaurantId: true, status: true },
    });

    if (!po) return { error: "Orden de compra no encontrada." };
    if (po.status === "RECEIVED") {
      return { error: "No se puede cancelar una orden que ya fue recibida en inventario." };
    }

    const auth = await verifyRestaurantOwnership(po.restaurantId);
    if (!auth.authorized) return { error: auth.error };

    await prisma.purchaseOrder.update({
      where: { id: orderId },
      data: { status: "CANCELLED" },
    });

    revalidatePath("/admin");
    return { success: true };
  } catch (error: any) {
    console.error("Error in cancelPurchaseOrderAction:", error);
    return { error: error?.message || "Error al cancelar orden." };
  }
}

// ==========================================
// 7. ACTUALIZACIÓN RÁPIDA DE COSTO, PROVEEDOR Y STOCK DE PLATO/PRODUCTO
// ==========================================
export async function updateDishInventoryAction(
  restaurantId: string,
  dishId: string,
  data: {
    costPrice?: number;
    supplierId?: string | null;
    price?: number;
    stock?: number | null;
    minStock?: number;
    trackStock?: boolean;
    barcode?: string | null;
    sku?: string | null;
  }
) {
  try {
    await refreshUserSession();
    const auth = await verifyRestaurantOwnership(restaurantId);
    if (!auth.authorized) return { error: auth.error };

    const dish = await prisma.dish.findFirst({
      where: { id: dishId, restaurantId },
    });
    if (!dish) return { error: "Producto o plato no encontrado." };

    const updatePayload: any = {};
    if (data.costPrice !== undefined) {
      updatePayload.costPrice = Math.max(0, Number(data.costPrice) || 0);
    }
    if (data.supplierId !== undefined) {
      updatePayload.supplierId = data.supplierId ? data.supplierId : null;
    }
    if (data.price !== undefined && data.price >= 0) {
      updatePayload.price = Number(data.price);
    }
    if (data.stock !== undefined) {
      updatePayload.stock = data.stock !== null ? Math.max(0, Math.round(Number(data.stock))) : null;
      if (data.trackStock === undefined && data.stock !== null) {
        updatePayload.trackStock = true;
      }
      if (data.stock !== null && data.stock <= 0) {
        updatePayload.isAvailable = false;
      } else if (data.stock !== null && data.stock > 0) {
        updatePayload.isAvailable = true;
      }
    }
    if (data.minStock !== undefined) {
      updatePayload.minStock = Math.max(0, Math.round(Number(data.minStock)));
    }
    if (data.trackStock !== undefined) {
      updatePayload.trackStock = Boolean(data.trackStock);
    }
    if (data.barcode !== undefined) {
      updatePayload.barcode = data.barcode ? String(data.barcode).trim() : null;
    }
    if (data.sku !== undefined) {
      updatePayload.sku = data.sku ? String(data.sku).trim() : null;
    }

    const updated = await prisma.dish.update({
      where: { id: dishId },
      data: updatePayload,
      include: {
        category: {
          select: {
            id: true,
            name: true,
            restaurant: { select: { slug: true } },
          },
        },
        supplier: { select: { id: true, name: true, phone: true } },
      },
    });

    revalidatePath("/admin");
    revalidatePath("/caja");
    if (updated.category?.restaurant?.slug) {
      revalidatePath(`/${updated.category.restaurant.slug}`);
    }
    return { success: true, dish: updated };
  } catch (error: any) {
    console.error("Error in updateDishInventoryAction:", error);
    return { error: error?.message || "Error al actualizar información de inventario." };
  }
}

// ==========================================
// 8. IMPORTACIÓN Y ACTUALIZACIÓN POR LOTES (UPSERT)
// ==========================================
export interface BatchInventoryDishInput {
  id?: string;
  name: string;
  categoryName?: string;
  costPrice?: number;
  price?: number;
  stock?: number | null;
  minStock?: number;
  trackStock?: boolean;
  supplierName?: string | null;
  supplierId?: string | null;
  barcode?: string | null;
  sku?: string | null;
  description?: string;
  isAvailable?: boolean;
}

export async function batchImportOrUpdateInventoryAction(
  restaurantId: string,
  items: BatchInventoryDishInput[]
) {
  try {
    await refreshUserSession();
    const auth = await verifyRestaurantOwnership(restaurantId);
    if (!auth.authorized) return { error: auth.error };

    if (!Array.isArray(items) || items.length === 0) {
      return { error: "No se proporcionaron datos para importar o actualizar." };
    }

    // 1. Obtener categorías, proveedores y platos existentes
    const [existingCategories, existingSuppliers, existingDishes] = await Promise.all([
      prisma.category.findMany({ where: { restaurantId }, orderBy: { order: "asc" } }),
      prisma.supplier.findMany({ where: { restaurantId } }),
      prisma.dish.findMany({ where: { restaurantId } }),
    ]);

    const categoryMap = new Map<string, string>();
    existingCategories.forEach((cat) => categoryMap.set(cat.name.trim().toLowerCase(), cat.id));

    const supplierMap = new Map<string, string>();
    existingSuppliers.forEach((sup) => supplierMap.set(sup.name.trim().toLowerCase(), sup.id));

    const dishById = new Map<string, any>();
    const dishByCode = new Map<string, any>();
    const dishByName = new Map<string, any>();

    existingDishes.forEach((d) => {
      dishById.set(d.id, d);
      if (d.sku && d.sku.trim()) dishByCode.set(d.sku.trim().toLowerCase(), d);
      if (d.barcode && d.barcode.trim()) dishByCode.set(d.barcode.trim().toLowerCase(), d);
      dishByName.set(d.name.trim().toLowerCase(), d);
    });

    let nextCatOrder = existingCategories.length > 0
      ? Math.max(...existingCategories.map((c) => c.order)) + 1
      : 0;

    let updatedCount = 0;
    let createdCount = 0;
    let suppliersCreated = 0;

    await prisma.$transaction(async (tx) => {
      // A. Crear proveedores faltantes si vienen nombrados
      for (const it of items) {
        const supName = it.supplierName ? it.supplierName.trim() : "";
        if (supName && !supplierMap.has(supName.toLowerCase()) && !it.supplierId) {
          const createdSup = await tx.supplier.create({
            data: {
              restaurantId,
              name: supName,
              notes: "Registrado automáticamente desde importación Excel de inventario",
            },
          });
          supplierMap.set(supName.toLowerCase(), createdSup.id);
          suppliersCreated++;
        }
      }

      // B. Crear categorías faltantes si vienen nombradas
      for (const it of items) {
        const catName = it.categoryName ? it.categoryName.trim() : "General";
        if (catName && !categoryMap.has(catName.toLowerCase())) {
          const createdCat = await tx.category.create({
            data: {
              restaurantId,
              name: catName,
              order: nextCatOrder++,
            },
          });
          categoryMap.set(catName.toLowerCase(), createdCat.id);
        }
      }

      // C. Procesar cada ítem: Actualizar si ya existe (upsert), o Crear si es nuevo
      for (const it of items) {
        const cleanName = it.name ? it.name.trim() : "";
        if (!cleanName) continue;

        // Resolver proveedor
        let resolvedSupplierId: string | null = null;
        if (it.supplierId) {
          resolvedSupplierId = it.supplierId;
        } else if (it.supplierName && supplierMap.has(it.supplierName.trim().toLowerCase())) {
          resolvedSupplierId = supplierMap.get(it.supplierName.trim().toLowerCase()) || null;
        }

        // Resolver categoría
        const catName = it.categoryName ? it.categoryName.trim() : "General";
        const resolvedCategoryId = categoryMap.get(catName.toLowerCase()) || existingCategories[0]?.id;

        // Buscar coincidencia existente
        let match = it.id ? dishById.get(it.id) : null;
        if (!match && it.sku && dishByCode.has(it.sku.trim().toLowerCase())) {
          match = dishByCode.get(it.sku.trim().toLowerCase());
        }
        if (!match && it.barcode && dishByCode.has(it.barcode.trim().toLowerCase())) {
          match = dishByCode.get(it.barcode.trim().toLowerCase());
        }
        if (!match && dishByName.has(cleanName.toLowerCase())) {
          match = dishByName.get(cleanName.toLowerCase());
        }

        const cleanCost = typeof it.costPrice === "number" ? Math.max(0, it.costPrice) : undefined;
        const cleanPrice = typeof it.price === "number" ? Math.max(0, it.price) : undefined;
        const cleanStock = it.stock !== undefined && it.stock !== null ? Math.max(0, Math.round(Number(it.stock))) : undefined;
        const cleanMinStock = it.minStock !== undefined ? Math.max(0, Math.round(Number(it.minStock))) : undefined;

        if (match) {
          // ACTUALIZACIÓN DE PRODUCTO EXISTENTE
          const updateData: any = {};
          if (cleanCost !== undefined) updateData.costPrice = cleanCost;
          if (resolvedSupplierId !== null) updateData.supplierId = resolvedSupplierId;
          if (cleanPrice !== undefined && cleanPrice >= 0) updateData.price = cleanPrice;
          if (cleanStock !== undefined) {
            updateData.stock = cleanStock;
            updateData.trackStock = true;
            if (cleanStock > 0 && match.isAvailable === false) {
              updateData.isAvailable = true;
            }
          }
          if (cleanMinStock !== undefined) updateData.minStock = cleanMinStock;
          if (it.trackStock !== undefined) updateData.trackStock = it.trackStock;
          if (it.barcode) updateData.barcode = it.barcode.trim();
          if (it.sku) updateData.sku = it.sku.trim();
          if (it.description) updateData.description = it.description.trim();
          if (it.isAvailable !== undefined) updateData.isAvailable = it.isAvailable;

          await tx.dish.update({
            where: { id: match.id },
            data: updateData,
          });
          updatedCount++;
        } else {
          // CREACIÓN DE NUEVO PRODUCTO
          if (!resolvedCategoryId) continue;
          await tx.dish.create({
            data: {
              restaurantId,
              categoryId: resolvedCategoryId,
              name: cleanName,
              description: it.description?.trim() || null,
              price: cleanPrice !== undefined ? cleanPrice : 0,
              costPrice: cleanCost !== undefined ? cleanCost : 0,
              supplierId: resolvedSupplierId,
              stock: cleanStock !== undefined ? cleanStock : 10,
              minStock: cleanMinStock !== undefined ? cleanMinStock : 2,
              trackStock: it.trackStock !== undefined ? it.trackStock : true,
              barcode: it.barcode?.trim() || null,
              sku: it.sku?.trim() || null,
              isAvailable: it.isAvailable !== undefined ? it.isAvailable : true,
            },
          });
          createdCount++;
        }
      }
    });

    revalidatePath("/admin");
    return {
      success: true,
      totalProcessed: items.length,
      updatedCount,
      createdCount,
      suppliersCreated,
    };
  } catch (error: any) {
    console.error("Error in batchImportOrUpdateInventoryAction:", error);
    return { error: error?.message || "Error al procesar la importación en lote." };
  }
}

/**
 * Activa el control estricto de stock en TODO el catálogo del negocio (Opción 1).
 * Convierte todos los productos "Sin límite" a productos controlados con unidades activas,
 * garantizando que ningún ítem quede exento de descuento o bloqueo al agotarse.
 */
export async function enableUniversalStockAction(restaurantId: string) {
  try {
    await refreshUserSession();
    const auth = await verifyRestaurantOwnership(restaurantId);
    if (!auth.authorized) return { error: auth.error };

    const dishes = await prisma.dish.findMany({
      where: { restaurantId },
      select: { id: true, stock: true, trackStock: true, isAvailable: true, name: true },
    });

    let updatedCount = 0;
    await prisma.$transaction(async (tx) => {
      for (const d of dishes) {
        const curStock = typeof d.stock === "number" ? d.stock : 0;
        const isStillAvail = curStock > 0;
        await tx.dish.update({
          where: { id: d.id },
          data: {
            trackStock: true,
            stock: curStock,
            isAvailable: isStillAvail,
          },
        });
        updatedCount++;
      }
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

    return { success: true, updatedCount };
  } catch (error: any) {
    console.error("Error in enableUniversalStockAction:", error);
    return { error: error?.message || "Error al activar el control de stock universal." };
  }
}
