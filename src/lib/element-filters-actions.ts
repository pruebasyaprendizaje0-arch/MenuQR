"use server";

import { prisma } from "@/lib/db";
import { getUserSession, getSuperAdminSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { ElementFiltersConfig, DEFAULT_ELEMENT_FILTERS_CONFIG } from "./element-filters-types";

const getSettingKey = (restaurantId: string) => `element_filters_${restaurantId}`;

/**
 * Multi-tenant permission verification helper
 */
async function verifyOwnership(restaurantId: string): Promise<boolean> {
  const isSuperAdmin = await getSuperAdminSession();
  if (isSuperAdmin) return true;

  const session = await getUserSession();
  if (!session || !session.userId) return false;

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { userId: true },
  });

  return restaurant?.userId === session.userId;
}

/**
 * Obtener la configuración del filtro de elementos para un restaurante
 */
export async function getElementFiltersConfigAction(restaurantId: string): Promise<ElementFiltersConfig> {
  try {
    if (!restaurantId) return DEFAULT_ELEMENT_FILTERS_CONFIG;

    const setting = await prisma.systemSetting.findUnique({
      where: { key: getSettingKey(restaurantId) },
    });

    if (!setting || !setting.value) {
      return DEFAULT_ELEMENT_FILTERS_CONFIG;
    }

    const parsed = JSON.parse(setting.value);
    return {
      ...DEFAULT_ELEMENT_FILTERS_CONFIG,
      ...parsed,
      dailySpecialDishIds: Array.isArray(parsed.dailySpecialDishIds) ? parsed.dailySpecialDishIds : [],
    };
  } catch (error) {
    console.error("Error al obtener configuración de filtros de elementos:", error);
    return DEFAULT_ELEMENT_FILTERS_CONFIG;
  }
}

/**
 * Guardar o actualizar la configuración del filtro de elementos
 */
export async function saveElementFiltersConfigAction(
  restaurantId: string,
  config: ElementFiltersConfig
): Promise<{ success: boolean; error?: string; config?: ElementFiltersConfig }> {
  try {
    const isAuthorized = await verifyOwnership(restaurantId);
    if (!isAuthorized) {
      return { success: false, error: "No tienes autorización para modificar este negocio." };
    }

    const jsonValue = JSON.stringify(config);
    const key = getSettingKey(restaurantId);

    await prisma.systemSetting.upsert({
      where: { key },
      update: { value: jsonValue },
      create: { key, value: jsonValue },
    });

    // Revalidar rutas del restaurante para aplicar cambios de inmediato
    const rest = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { slug: true },
    });

    if (rest?.slug) {
      revalidatePath(`/${rest.slug}`);
      revalidatePath(`/admin`);
    }

    return { success: true, config };
  } catch (error: any) {
    console.error("Error al guardar configuración de filtros de elementos:", error);
    return { success: false, error: error?.message || "Error interno al guardar la configuración." };
  }
}

/**
 * Alternar un plato como "Plato del Día" directamente desde la ventana de platos
 */
export async function toggleDishDailySpecialAction(
  restaurantId: string,
  dishId: string
): Promise<{ success: boolean; isSpecial?: boolean; error?: string }> {
  try {
    const isAuthorized = await verifyOwnership(restaurantId);
    if (!isAuthorized) {
      return { success: false, error: "No tienes autorización." };
    }

    const currentConfig = await getElementFiltersConfigAction(restaurantId);
    const currentList = currentConfig.dailySpecialDishIds || [];
    const exists = currentList.includes(dishId);

    const updatedList = exists
      ? currentList.filter((id) => id !== dishId)
      : [...currentList, dishId];

    const updatedConfig: ElementFiltersConfig = {
      ...currentConfig,
      dailySpecialDishIds: updatedList,
    };

    const saveResult = await saveElementFiltersConfigAction(restaurantId, updatedConfig);
    if (!saveResult.success) {
      return { success: false, error: saveResult.error };
    }

    return { success: true, isSpecial: !exists };
  } catch (error: any) {
    console.error("Error al alternar plato del día:", error);
    return { success: false, error: error?.message || "Error al actualizar plato del día." };
  }
}
