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

    if (itemType === "DISH") {
      const dish = await prisma.dish.findUnique({
        where: { id: itemId },
        select: { id: true, restaurantId: true, stock: true },
      });
      if (!dish) return { error: "Producto no encontrado." };

      const auth = await verifyRestaurantOwnership(dish.restaurantId);
      if (!auth.authorized) return { error: auth.error };

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
        select: { id: true, restaurantId: true, currentStock: true },
      });
      if (!supply) return { error: "Insumo no encontrado." };

      const auth = await verifyRestaurantOwnership(supply.restaurantId);
      if (!auth.authorized) return { error: auth.error };

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

    if (itemType === "DISH") {
      const dish = await prisma.dish.findUnique({
        where: { id: itemId },
        select: { id: true, restaurantId: true },
      });
      if (!dish) return { error: "Producto no encontrado." };

      const auth = await verifyRestaurantOwnership(dish.restaurantId);
      if (!auth.authorized) return { error: auth.error };

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
        select: { id: true, restaurantId: true },
      });
      if (!supply) return { error: "Insumo no encontrado." };

      const auth = await verifyRestaurantOwnership(supply.restaurantId);
      if (!auth.authorized) return { error: auth.error };

      await prisma.supplyItem.update({
        where: { id: itemId },
        data: {
          currentStock: sanitizedStock,
        },
      });
    }

    revalidatePath("/admin");
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
