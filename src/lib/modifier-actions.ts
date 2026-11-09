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
    return { authorized: false, error: "Negocio no encontrado." };
  }

  if (restaurant.userId !== session.userId) {
    return { authorized: false, error: "No tiene permisos para modificar este negocio." };
  }

  return { authorized: true };
}

function formatOption(opt: any) {
  return {
    id: opt.id,
    groupId: opt.groupId,
    name: opt.name,
    extraPrice: Number(opt.extraPrice) || 0,
    createdAt: opt.createdAt ? opt.createdAt.toISOString() : new Date().toISOString(),
    updatedAt: opt.updatedAt ? opt.updatedAt.toISOString() : new Date().toISOString(),
  };
}

function formatGroup(group: any) {
  return {
    id: group.id,
    dishId: group.dishId,
    name: group.name,
    minSelect: group.minSelect,
    maxSelect: group.maxSelect,
    isRequired: group.minSelect > 0,
    options: (group.options || []).map(formatOption),
    createdAt: group.createdAt ? group.createdAt.toISOString() : new Date().toISOString(),
    updatedAt: group.updatedAt ? group.updatedAt.toISOString() : new Date().toISOString(),
  };
}

/**
 * Consulta todos los grupos de modificadores de un plato junto con sus opciones.
 */
export async function getDishModifierGroupsAction(dishId: string) {
  try {
    await refreshUserSession();
    const dish = await prisma.dish.findUnique({
      where: { id: dishId },
      select: { id: true, restaurantId: true },
    });

    if (!dish) return { success: false, error: "Plato no encontrado." };

    const auth = await verifyRestaurantOwnership(dish.restaurantId);
    if (!auth.authorized) return { success: false, error: auth.error };

    const groups = await prisma.dishModifierGroup.findMany({
      where: { dishId },
      include: {
        options: {
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return { success: true, groups: groups.map(formatGroup) };
  } catch (error: any) {
    console.error("Error fetching dish modifier groups:", error);
    return { success: false, error: "Error al cargar modificadores." };
  }
}

/**
 * Crea un nuevo grupo de modificadores (ej. 'Término de Carne', 'Salsas', 'Guarniciones').
 */
export async function createModifierGroupAction(
  dishId: string,
  data: {
    name: string;
    minSelect?: number;
    maxSelect?: number;
    isRequired?: boolean;
  }
) {
  try {
    await refreshUserSession();
    const dish = await prisma.dish.findUnique({
      where: { id: dishId },
      select: { id: true, restaurantId: true, restaurant: { select: { slug: true } } },
    });

    if (!dish) return { success: false, error: "Plato no encontrado." };

    const auth = await verifyRestaurantOwnership(dish.restaurantId);
    if (!auth.authorized) return { success: false, error: auth.error };

    const cleanName = (data.name || "").trim();
    if (!cleanName) return { success: false, error: "El nombre del grupo es obligatorio." };

    let minSelect = Math.max(0, parseInt(String(data.minSelect || 0), 10));
    if (data.isRequired && minSelect === 0) {
      minSelect = 1;
    }
    const maxSelect = Math.max(1, parseInt(String(data.maxSelect || 1), 10));

    const group = await prisma.dishModifierGroup.create({
      data: {
        dishId,
        name: cleanName,
        minSelect,
        maxSelect,
      },
      include: {
        options: true,
      },
    });

    revalidatePath("/admin");
    if (dish.restaurant?.slug) {
      revalidatePath(`/${dish.restaurant.slug}`);
    }

    return { success: true, group: formatGroup(group) };
  } catch (error: any) {
    console.error("Error creating modifier group:", error);
    return { success: false, error: "Error al crear grupo de modificadores." };
  }
}

/**
 * Actualiza un grupo de modificadores.
 */
export async function updateModifierGroupAction(
  groupId: string,
  data: {
    name?: string;
    minSelect?: number;
    maxSelect?: number;
    isRequired?: boolean;
  }
) {
  try {
    await refreshUserSession();
    const group = await prisma.dishModifierGroup.findUnique({
      where: { id: groupId },
      include: { dish: { select: { restaurantId: true, restaurant: { select: { slug: true } } } } },
    });

    if (!group) return { success: false, error: "Grupo no encontrado." };

    const auth = await verifyRestaurantOwnership(group.dish.restaurantId);
    if (!auth.authorized) return { success: false, error: auth.error };

    let minSelect = data.minSelect !== undefined ? Math.max(0, parseInt(String(data.minSelect), 10)) : undefined;
    if (data.isRequired && (minSelect === 0 || (minSelect === undefined && group.minSelect === 0))) {
      minSelect = 1;
    }

    const updated = await prisma.dishModifierGroup.update({
      where: { id: groupId },
      data: {
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(minSelect !== undefined ? { minSelect } : {}),
        ...(data.maxSelect !== undefined ? { maxSelect: Math.max(1, parseInt(String(data.maxSelect), 10)) } : {}),
      },
      include: { options: true },
    });

    revalidatePath("/admin");
    if (group.dish.restaurant?.slug) {
      revalidatePath(`/${group.dish.restaurant.slug}`);
    }

    return { success: true, group: formatGroup(updated) };
  } catch (error: any) {
    console.error("Error updating modifier group:", error);
    return { success: false, error: "Error al actualizar grupo de modificadores." };
  }
}

/**
 * Elimina un grupo de modificadores y sus opciones en cascada.
 */
export async function deleteModifierGroupAction(groupId: string) {
  try {
    await refreshUserSession();
    const group = await prisma.dishModifierGroup.findUnique({
      where: { id: groupId },
      include: { dish: { select: { restaurantId: true, restaurant: { select: { slug: true } } } } },
    });

    if (!group) return { success: false, error: "Grupo no encontrado." };

    const auth = await verifyRestaurantOwnership(group.dish.restaurantId);
    if (!auth.authorized) return { success: false, error: auth.error };

    await prisma.dishModifierGroup.delete({
      where: { id: groupId },
    });

    revalidatePath("/admin");
    if (group.dish.restaurant?.slug) {
      revalidatePath(`/${group.dish.restaurant.slug}`);
    }

    return { success: true };
  } catch (error: any) {
    console.error("Error deleting modifier group:", error);
    return { success: false, error: "Error al eliminar grupo de modificadores." };
  }
}

/**
 * Agrega una opción individual dentro de un grupo (ej. 'Término Medio', '+$1.50').
 */
export async function createModifierOptionAction(
  groupId: string,
  data: {
    name: string;
    extraPrice?: number;
  }
) {
  try {
    await refreshUserSession();
    const group = await prisma.dishModifierGroup.findUnique({
      where: { id: groupId },
      include: { dish: { select: { restaurantId: true, restaurant: { select: { slug: true } } } } },
    });

    if (!group) return { success: false, error: "Grupo no encontrado." };

    const auth = await verifyRestaurantOwnership(group.dish.restaurantId);
    if (!auth.authorized) return { success: false, error: auth.error };

    const cleanName = (data.name || "").trim();
    if (!cleanName) return { success: false, error: "El nombre de la opción es obligatorio." };

    const extraPrice = Math.max(0, Math.round((Number(data.extraPrice) || 0) * 100) / 100);

    const option = await prisma.dishModifierOption.create({
      data: {
        groupId,
        name: cleanName,
        extraPrice,
      },
    });

    revalidatePath("/admin");
    if (group.dish.restaurant?.slug) {
      revalidatePath(`/${group.dish.restaurant.slug}`);
    }

    return { success: true, option: formatOption(option) };
  } catch (error: any) {
    console.error("Error creating modifier option:", error);
    return { success: false, error: "Error al crear opción de modificador." };
  }
}

/**
 * Actualiza una opción de modificador.
 */
export async function updateModifierOptionAction(
  optionId: string,
  data: {
    name?: string;
    extraPrice?: number;
  }
) {
  try {
    await refreshUserSession();
    const option = await prisma.dishModifierOption.findUnique({
      where: { id: optionId },
      include: {
        group: {
          include: {
            dish: { select: { restaurantId: true, restaurant: { select: { slug: true } } } },
          },
        },
      },
    });

    if (!option) return { success: false, error: "Opción no encontrada." };

    const auth = await verifyRestaurantOwnership(option.group.dish.restaurantId);
    if (!auth.authorized) return { success: false, error: auth.error };

    const updated = await prisma.dishModifierOption.update({
      where: { id: optionId },
      data: {
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.extraPrice !== undefined ? { extraPrice: Math.max(0, Math.round(Number(data.extraPrice) * 100) / 100) } : {}),
      },
    });

    revalidatePath("/admin");
    if (option.group.dish.restaurant?.slug) {
      revalidatePath(`/${option.group.dish.restaurant.slug}`);
    }

    return { success: true, option: formatOption(updated) };
  } catch (error: any) {
    console.error("Error updating modifier option:", error);
    return { success: false, error: "Error al actualizar opción." };
  }
}

/**
 * Elimina una opción de modificador.
 */
export async function deleteModifierOptionAction(optionId: string) {
  try {
    await refreshUserSession();
    const option = await prisma.dishModifierOption.findUnique({
      where: { id: optionId },
      include: {
        group: {
          include: {
            dish: { select: { restaurantId: true, restaurant: { select: { slug: true } } } },
          },
        },
      },
    });

    if (!option) return { success: false, error: "Opción no encontrada." };

    const auth = await verifyRestaurantOwnership(option.group.dish.restaurantId);
    if (!auth.authorized) return { success: false, error: auth.error };

    await prisma.dishModifierOption.delete({
      where: { id: optionId },
    });

    revalidatePath("/admin");
    if (option.group.dish.restaurant?.slug) {
      revalidatePath(`/${option.group.dish.restaurant.slug}`);
    }

    return { success: true };
  } catch (error: any) {
    console.error("Error deleting modifier option:", error);
    return { success: false, error: "Error al eliminar opción." };
  }
}
