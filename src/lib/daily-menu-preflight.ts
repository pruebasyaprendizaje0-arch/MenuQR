import type { PrismaClient } from "@prisma/client";
import {
  isDailyMenuCategoryName,
  isDailyMenuEligibleRestaurant,
  MAX_VISIBLE_DAILY_MENU_DISHES,
} from "@/lib/daily-menu";

export interface DailyMenuConflict {
  restaurantId: string;
  slug: string;
  restaurantName: string;
  categoryId: string;
  categoryName: string;
  visibleOrProjectedCount: number;
  maxAllowed: number;
}

export interface DailyMenuPreflightReport {
  phase: "PRE_MIGRATION" | "POST_MIGRATION";
  schemaName: string;
  hasIsVisibleColumn: boolean;
  checkedEligibleCategories: number;
  shouldStop: boolean;
  conflicts: DailyMenuConflict[];
}

/**
 * Inspector de solo lectura fiel a isDailyMenuEligibleRestaurant y isDailyMenuCategoryName.
 * Detecta si la columna "Dish"."isVisible" existe:
 * - PRE_MIGRATION: cuenta todos los platos existentes (que pasarán a isVisible = true por DEFAULT true).
 * - POST_MIGRATION: cuenta únicamente los platos con isVisible = true.
 * Nunca aproxima la elegibilidad con SQL separado ni oculta platos; si no puede determinar el estado, aborta.
 */
export async function inspectDailyMenuConflicts(
  prismaClient: PrismaClient,
  options?: { schemaName?: string }
): Promise<DailyMenuPreflightReport> {
  const schemaName = options?.schemaName?.trim() || "public";
  if (!/^[a-zA-Z0-9_]+$/.test(schemaName)) {
    throw new Error("ABORTED: Nombre de esquema inválido para inspección.");
  }

  const tables = await prismaClient.$queryRaw<Array<{ table_name: string }>>`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = ${schemaName}
      AND table_name IN ('Restaurant', 'Category', 'Dish')
  `;
  const tableSet = new Set(tables.map((t) => t.table_name));
  if (!tableSet.has("Restaurant") || !tableSet.has("Category") || !tableSet.has("Dish")) {
    throw new Error(
      `ABORTED: No se pudo determinar el estado completo del esquema "${schemaName}" (faltan tablas requeridas).`
    );
  }

  const colRows = await prismaClient.$queryRaw<Array<{ column_name: string }>>`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = ${schemaName}
      AND table_name = 'Dish'
      AND column_name = 'isVisible'
  `;
  const hasIsVisibleColumn = colRows.length > 0;
  const phase: "PRE_MIGRATION" | "POST_MIGRATION" = hasIsVisibleColumn
    ? "POST_MIGRATION"
    : "PRE_MIGRATION";

  const restaurants = await prismaClient.$queryRawUnsafe<
    Array<{
      id: string;
      slug: string;
      name: string;
      businessType: string | null;
      catalogMode: string | null;
      customLabels: string | null;
      specialty: string | null;
      description: string | null;
    }>
  >(
    `SELECT id, slug, name, "businessType"::text AS "businessType", "catalogMode"::text AS "catalogMode", "customLabels", specialty, description FROM "${schemaName}"."Restaurant"`
  );

  const categories = await prismaClient.$queryRawUnsafe<
    Array<{ id: string; name: string; restaurantId: string }>
  >(`SELECT id, name, "restaurantId" FROM "${schemaName}"."Category"`);

  const eligibleRestaurants = new Map(
    restaurants.filter((r) => isDailyMenuEligibleRestaurant(r)).map((r) => [r.id, r])
  );

  const eligibleCategories = categories.filter(
    (c) => eligibleRestaurants.has(c.restaurantId) && isDailyMenuCategoryName(c.name)
  );

  if (eligibleCategories.length === 0) {
    return {
      phase,
      schemaName,
      hasIsVisibleColumn,
      checkedEligibleCategories: 0,
      shouldStop: false,
      conflicts: [],
    };
  }

  const eligibleCatIds = eligibleCategories.map((c) => c.id);
  const counts = hasIsVisibleColumn
    ? await prismaClient.$queryRawUnsafe<Array<{ categoryId: string; cnt: number }>>(
        `SELECT "categoryId", COUNT(*)::int AS cnt FROM "${schemaName}"."Dish" WHERE "categoryId" = ANY($1::text[]) AND "isVisible" = true GROUP BY "categoryId"`,
        eligibleCatIds
      )
    : await prismaClient.$queryRawUnsafe<Array<{ categoryId: string; cnt: number }>>(
        `SELECT "categoryId", COUNT(*)::int AS cnt FROM "${schemaName}"."Dish" WHERE "categoryId" = ANY($1::text[]) GROUP BY "categoryId"`,
        eligibleCatIds
      );

  const countMap = new Map(counts.map((r) => [r.categoryId, Number(r.cnt)]));
  const conflicts: DailyMenuConflict[] = [];

  for (const cat of eligibleCategories) {
    const cnt = countMap.get(cat.id) || 0;
    if (cnt > MAX_VISIBLE_DAILY_MENU_DISHES) {
      const rest = eligibleRestaurants.get(cat.restaurantId)!;
      conflicts.push({
        restaurantId: rest.id,
        slug: rest.slug,
        restaurantName: rest.name,
        categoryId: cat.id,
        categoryName: cat.name,
        visibleOrProjectedCount: cnt,
        maxAllowed: MAX_VISIBLE_DAILY_MENU_DISHES,
      });
    }
  }

  return {
    phase,
    schemaName,
    hasIsVisibleColumn,
    checkedEligibleCategories: eligibleCategories.length,
    shouldStop: conflicts.length > 0,
    conflicts,
  };
}
