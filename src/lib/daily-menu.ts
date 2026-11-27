import type { Prisma } from "@prisma/client";
import { resolveBusinessVertical } from "@/lib/business-labels";

export const MAX_VISIBLE_DAILY_MENU_DISHES = 4;

/**
 * Determina si una categoría corresponde al Menú / Almuerzo del Día.
 */
export function isDailyMenuCategoryName(name: string | null | undefined): boolean {
  if (!name || typeof name !== "string") return false;
  const lower = name.trim().toLowerCase();
  return (
    lower.includes("menú del día") ||
    lower.includes("menu del dia") ||
    lower.includes("almuerzo") ||
    lower.includes("plato del día") ||
    lower.includes("plato del dia")
  );
}

/**
 * El límite de 4 platos visibles en Menú del Día aplica únicamente a negocios
 * de Menú QR (restaurante / gastronomía), nunca a Catálogo Retail, Servicios ni otras verticales.
 */
export function isDailyMenuEligibleRestaurant(restaurant: {
  businessType?: string | null;
  catalogMode?: string | null;
  customLabels?: string | null;
  name?: string | null;
  specialty?: string | null;
  description?: string | null;
}): boolean {
  if (!restaurant) return false;
  if (restaurant.catalogMode === "CATALOG") return false;
  if (
    restaurant.businessType === "RETAIL" ||
    restaurant.businessType === "GENERAL_CATALOG" ||
    restaurant.businessType === "SERVICES"
  ) {
    return false;
  }
  return resolveBusinessVertical(restaurant) === "restaurante";
}

export const CONCURRENT_CATEGORY_CHANGE_ERR = "__CONCURRENT_CATEGORY_CHANGE__";

/**
 * Bloquea un conjunto de platos del mismo restaurante en orden determinístico (ORDER BY id)
 * SIEMPRE después de haber adquirido los bloqueos de Category.
 */
export async function lockDishesInOrderTx(
  tx: Prisma.TransactionClient,
  restaurantId: string,
  dishIds: string[]
): Promise<Map<string, { id: string; categoryId: string; isVisible: boolean; isAvailable: boolean; imageUrl: string | null; name: string }>> {
  const uniqueSorted = Array.from(new Set(dishIds.filter(Boolean))).sort();
  if (uniqueSorted.length === 0) return new Map();

  const rows = await tx.$queryRaw<
    Array<{ id: string; categoryId: string; isVisible: boolean; isAvailable: boolean; imageUrl: string | null; name: string }>
  >`
    SELECT id, "categoryId", "isVisible", "isAvailable", "imageUrl", name
    FROM "Dish"
    WHERE "restaurantId" = ${restaurantId} AND id = ANY(${uniqueSorted}::text[])
    ORDER BY id ASC
    FOR UPDATE
  `;

  return new Map(rows.map((r) => [r.id, r]));
}

/**
 * Reintenta de forma acotada únicamente cuando una revalidación bajo bloqueo detecta
 * cambio concurrente de categoría entre la prelectura y la adquisición Category -> Dish,
 * o ante un error transitorio de serialización/deadlock en PostgreSQL (40P01/40001).
 */
export async function runWithLockRetry<T>(fn: () => Promise<T>, maxAttempts = 4): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastErr = err;
      const msg = String(err?.message || "");
      const code = String(err?.code || err?.meta?.code || "");
      const isRetryable =
        msg === CONCURRENT_CATEGORY_CHANGE_ERR ||
        code === "40P01" ||
        code === "40001" ||
        msg.includes("40P01") ||
        msg.includes("40001");
      if (!isRetryable) {
        throw err;
      }
      if (attempt === maxAttempts) {
        throw new Error(
          "Conflicto de concurrencia al actualizar categorías o platos. Por favor, inténtalo de nuevo."
        );
      }
      await new Promise((r) => setTimeout(r, 15 * attempt));
    }
  }
  throw lastErr;
}

/**
 * Bloquea un conjunto de categorías del mismo restaurante en orden determinístico (ORDER BY id)
 * para evitar deadlocks cuando intervienen varias categorías simultáneamente.
 */
export async function lockCategoriesInOrderTx(
  tx: Prisma.TransactionClient,
  restaurantId: string,
  categoryIds: string[]
): Promise<Map<string, { id: string; name: string }>> {
  const uniqueSorted = Array.from(new Set(categoryIds.filter(Boolean))).sort();
  if (uniqueSorted.length === 0) return new Map();

  const rows = await tx.$queryRaw<Array<{ id: string; name: string }>>`
    SELECT id, name
    FROM "Category"
    WHERE "restaurantId" = ${restaurantId} AND id = ANY(${uniqueSorted}::text[])
    ORDER BY id ASC
    FOR UPDATE
  `;

  return new Map(rows.map((r) => [r.id, r]));
}

/**
 * Valida atómicamente dentro de una transacción el límite máximo de 4 platos visibles
 * en una categoría de Menú del Día de Menú QR (restaurante), adquiriendo bloqueos en orden fijo.
 */
export async function assertDailyMenuVisibleLimitTx(
  tx: Prisma.TransactionClient,
  params: {
    categoryId: string;
    restaurantId: string;
    additionalLockCategoryIds?: string[];
    excludeDishIds?: string[];
    incomingVisibleCount?: number;
    enforceCurrentCount?: boolean;
    overrideCategoryName?: string;
  }
): Promise<{
  isDailyMenu: boolean;
  isEligibleRestaurant: boolean;
  categoryName: string;
  currentVisibleCount: number;
}> {
  const {
    categoryId,
    restaurantId,
    additionalLockCategoryIds = [],
    excludeDishIds = [],
    incomingVisibleCount = 1,
    enforceCurrentCount = false,
    overrideCategoryName,
  } = params;

  const restaurant = await tx.restaurant.findUnique({
    where: { id: restaurantId },
    select: {
      businessType: true,
      catalogMode: true,
      customLabels: true,
      name: true,
      specialty: true,
      description: true,
    },
  });

  if (!restaurant) {
    throw new Error("Restaurante no encontrado.");
  }

  const lockedMap = await lockCategoriesInOrderTx(tx, restaurantId, [
    categoryId,
    ...additionalLockCategoryIds,
  ]);
  const category = lockedMap.get(categoryId);
  if (!category) {
    throw new Error("Categoría no encontrada o no pertenece al restaurante.");
  }

  const effectiveName = overrideCategoryName ?? category.name;
  const isDailyMenu = isDailyMenuCategoryName(effectiveName);
  const isEligibleRestaurant = isDailyMenuEligibleRestaurant(restaurant);

  if (!isDailyMenu || !isEligibleRestaurant) {
    return {
      isDailyMenu,
      isEligibleRestaurant,
      categoryName: effectiveName,
      currentVisibleCount: 0,
    };
  }

  if (incomingVisibleCount <= 0 && !enforceCurrentCount) {
    return {
      isDailyMenu,
      isEligibleRestaurant,
      categoryName: effectiveName,
      currentVisibleCount: 0,
    };
  }

  const countWhere: Prisma.DishWhereInput = {
    categoryId,
    restaurantId,
    isVisible: true,
    ...(excludeDishIds.length > 0 ? { id: { notIn: excludeDishIds } } : {}),
  };

  const currentVisibleCount = await tx.dish.count({ where: countWhere });

  if (currentVisibleCount + incomingVisibleCount > MAX_VISIBLE_DAILY_MENU_DISHES) {
    throw new Error(
      enforceCurrentCount
        ? `No se puede renombrar esta categoría a Menú del Día porque tiene ${currentVisibleCount} platos visibles (máximo ${MAX_VISIBLE_DAILY_MENU_DISHES}). Oculta otros platos manualmente antes de renombrarla.`
        : `Límite alcanzado: solo se permiten hasta ${MAX_VISIBLE_DAILY_MENU_DISHES} platos visibles en el Menú del Día. Oculta otro plato antes de mostrar este.`
    );
  }

  return {
    isDailyMenu,
    isEligibleRestaurant,
    categoryName: effectiveName,
    currentVisibleCount,
  };
}
