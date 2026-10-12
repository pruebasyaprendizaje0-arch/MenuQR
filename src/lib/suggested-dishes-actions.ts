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

    // Sincronizar en el modelo Dish nativo en PostgreSQL
    try {
      await prisma.dish.update({
        where: { id: dishId },
        data: { isSuggested },
      });
    } catch (dishErr) {
      console.warn("Could not sync isSuggested directly on Dish:", dishErr);
    }

    return { success: true, isSuggested, count: nextIds.length };
  } catch (err) {
    console.error("Error al alternar plato sugerido:", err);
    return { success: false, isSuggested: false, count: 0 };
  }
}

export interface MarketplaceItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  isAvailable: boolean;
  stock: number | null;
  trackStock: boolean;
  isService: boolean;
  isSuggested: boolean;
  itemType: "restaurant" | "store"; // 'restaurant' (Gastronomía) o 'store' (Tiendas & Comercios)
  categoryName: string;
  restaurant: {
    id: string;
    name: string;
    slug: string;
    logoUrl: string | null;
    specialty: string | null;
    businessType: string;
    catalogMode: string;
    locality: string | null;
    city: string | null;
    province: string | null;
    parish: string | null;
    sector: string | null;
    latitude: number | null;
    longitude: number | null;
    themeColor: string;
    whatsapp: string | null;
  };
}

export interface MarketplaceQueryParams {
  type?: "all" | "restaurant" | "store";
  search?: string;
  province?: string;
  canton?: string;
  parish?: string;
  sector?: string;
  onlySuggested?: boolean;
  limit?: number;
}

/**
 * Consulta global de productos y platos sugeridos para el Marketplace.
 * Clasifica automáticamente en 'restaurant' (Gastronomía) o 'store' (Tiendas y Comercio).
 */
export async function getMarketplaceDishesAction(params: MarketplaceQueryParams = {}): Promise<{
  success: boolean;
  dishes: MarketplaceItem[];
  total: number;
  restaurantCount: number;
  storeCount: number;
}> {
  try {
    const {
      type = "all",
      search = "",
      province = "TODAS",
      canton = "TODAS",
      parish = "TODAS",
      sector = "TODAS",
      onlySuggested = true,
      limit = 50,
    } = params;

    const whereClause: any = {
      isAvailable: true,
    };

    if (onlySuggested) {
      whereClause.isSuggested = true;
    }

    if (search && search.trim()) {
      const q = search.trim();
      whereClause.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { restaurant: { name: { contains: q, mode: "insensitive" } } },
        { restaurant: { specialty: { contains: q, mode: "insensitive" } } },
      ];
    }

    if (province && province !== "TODAS") {
      whereClause.restaurant = {
        ...whereClause.restaurant,
        province: { equals: province, mode: "insensitive" },
      };
    }

    if (canton && canton !== "TODAS") {
      whereClause.restaurant = {
        ...whereClause.restaurant,
        city: { equals: canton, mode: "insensitive" },
      };
    }

    if (parish && parish !== "TODAS") {
      whereClause.restaurant = {
        ...whereClause.restaurant,
        OR: [
          { parish: { equals: parish, mode: "insensitive" } },
          { locality: { contains: parish, mode: "insensitive" } },
        ],
      };
    }

    if (sector && sector !== "TODAS") {
      whereClause.restaurant = {
        ...whereClause.restaurant,
        OR: [
          { sector: { equals: sector, mode: "insensitive" } },
          { locality: { contains: sector, mode: "insensitive" } },
        ],
      };
    }

    const rawDishes = await prisma.dish.findMany({
      where: whereClause,
      include: {
        category: {
          select: { name: true },
        },
        restaurant: {
          select: {
            id: true,
            name: true,
            slug: true,
            logoUrl: true,
            specialty: true,
            businessType: true,
            catalogMode: true,
            locality: true,
            city: true,
            province: true,
            parish: true,
            sector: true,
            latitude: true,
            longitude: true,
            themeColor: true,
            whatsapp: true,
          },
        },
      },
      orderBy: [
        { updatedAt: "desc" },
        { name: "asc" },
      ],
      take: limit,
    });

    const mapped: MarketplaceItem[] = rawDishes.map((d) => {
      const bType = d.restaurant.businessType;
      const cMode = d.restaurant.catalogMode;
      const isStore =
        bType === "RETAIL" ||
        bType === "SERVICES" ||
        bType === "GENERAL_CATALOG" ||
        cMode === "CATALOG";

      return {
        id: d.id,
        name: d.name,
        description: d.description,
        price: Number(d.price),
        imageUrl: d.imageUrl,
        isAvailable: d.isAvailable,
        stock: d.stock,
        trackStock: d.trackStock,
        isService: d.isService,
        isSuggested: d.isSuggested,
        itemType: isStore ? "store" : "restaurant",
        categoryName: d.category.name,
        restaurant: {
          id: d.restaurant.id,
          name: d.restaurant.name,
          slug: d.restaurant.slug,
          logoUrl: d.restaurant.logoUrl,
          specialty: d.restaurant.specialty,
          businessType: d.restaurant.businessType,
          catalogMode: d.restaurant.catalogMode,
          locality: d.restaurant.locality,
          city: d.restaurant.city,
          province: d.restaurant.province,
          parish: d.restaurant.parish,
          sector: d.restaurant.sector,
          latitude: d.restaurant.latitude,
          longitude: d.restaurant.longitude,
          themeColor: d.restaurant.themeColor,
          whatsapp: d.restaurant.whatsapp,
        },
      };
    });

    const restaurantCount = mapped.filter((i) => i.itemType === "restaurant").length;
    const storeCount = mapped.filter((i) => i.itemType === "store").length;

    const filtered =
      type === "restaurant"
        ? mapped.filter((i) => i.itemType === "restaurant")
        : type === "store"
        ? mapped.filter((i) => i.itemType === "store")
        : mapped;

    return {
      success: true,
      dishes: filtered,
      total: filtered.length,
      restaurantCount,
      storeCount,
    };
  } catch (error) {
    console.error("Error al obtener platos de marketplace:", error);
    return {
      success: false,
      dishes: [],
      total: 0,
      restaurantCount: 0,
      storeCount: 0,
    };
  }
}
