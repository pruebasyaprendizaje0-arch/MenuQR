"use server";

import { prisma } from "./prisma";

const SETTING_PREFIX = "suggested_dishes_";

/**
 * Obtiene la lista de IDs de platos marcados como sugeridos / plato del día para un restaurante.
 */
export async function getSuggestedDishIdsAction(restaurantId: string): Promise<string[]> {
  try {
    if (!restaurantId) return [];
    const setting = await prisma.systemSetting.findUnique({
      where: { key: `${SETTING_PREFIX}${restaurantId}` },
    });
    if (!setting || !setting.value) return [];
    const parsed = JSON.parse(setting.value);
    if (Array.isArray(parsed)) {
      return parsed.filter((id) => typeof id === "string");
    }
    return [];
  } catch (err) {
    console.error("Error al obtener platos sugeridos:", err);
    return [];
  }
}

/**
 * Alterna (marca o desmarca) un plato como sugerido / plato del día.
 */
export async function toggleSuggestedDishAction(
  restaurantId: string,
  dishId: string
): Promise<{ success: boolean; isSuggested: boolean; count: number }> {
  try {
    if (!restaurantId || !dishId) {
      return { success: false, isSuggested: false, count: 0 };
    }

    const currentIds = await getSuggestedDishIdsAction(restaurantId);
    let nextIds: string[];
    let isSuggested: boolean;

    if (currentIds.includes(dishId)) {
      nextIds = currentIds.filter((id) => id !== dishId);
      isSuggested = false;
    } else {
      nextIds = [...currentIds, dishId];
      isSuggested = true;
    }

    await prisma.systemSetting.upsert({
      where: { key: `${SETTING_PREFIX}${restaurantId}` },
      update: { value: JSON.stringify(nextIds) },
      create: {
        key: `${SETTING_PREFIX}${restaurantId}`,
        value: JSON.stringify(nextIds),
      },
    });

    return { success: true, isSuggested, count: nextIds.length };
  } catch (err) {
    console.error("Error al alternar plato sugerido:", err);
    return { success: false, isSuggested: false, count: 0 };
  }
}
