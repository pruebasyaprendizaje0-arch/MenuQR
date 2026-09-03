import { prismaTenant } from "@/lib/db";
import { parseSearchQuery, ParsedSearchQuery } from "./search-parser";
import { trackAnalyticsEvent } from "./analytics";

export interface SearchOptions {
  query?: string;
  province?: string;
  city?: string;
  locality?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  lat?: number;
  lng?: number;
  page?: number;
  limit?: number;
}

export interface DishSearchResult {
  id: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  categoryName: string;
  restaurantId: string;
  restaurantName: string;
  restaurantSlug: string;
  locality: string | null;
}

export interface RestaurantSearchResult {
  id: string;
  slug: string;
  name: string;
  specialty: string | null;
  description: string | null;
  address: string | null;
  locality: string | null;
  province: string | null;
  city: string | null;
  sector: string | null;
  whatsapp: string | null;
  logoUrl: string | null;
  coverUrl: string | null;
  schedule: string | null;
  deliveryEnabled: boolean;
  deliveryCost: number;
  latitude: number | null;
  longitude: number | null;
  distanceKm?: number | null;
  relevanceScore: number;
  categories: { id: string; name: string }[];
  matchedDishesCount: number;
}

export interface SearchEngineResponse {
  success: boolean;
  parsedIntent: ParsedSearchQuery;
  totalRestaurants: number;
  totalDishes: number;
  restaurants: RestaurantSearchResult[];
  matchedDishes: DishSearchResult[];
  suggestions?: {
    availableCategories: string[];
    availableCities: string[];
  };
  pagination: {
    page: number;
    limit: number;
    totalPages: number;
  };
}

function calculateHaversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

function getVariants(text: string): string[] {
  if (!text) return [];
  const norm = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const set = new Set<string>([text, norm]);
  return Array.from(set).filter(Boolean);
}

export async function executeGastronomicSearch(options: SearchOptions): Promise<SearchEngineResponse> {
  const page = Math.max(1, options.page || 1);
  const limit = Math.min(50, Math.max(1, options.limit || 20));
  const rawQuery = options.query || "";
  const parsedIntent = parseSearchQuery(rawQuery);

  const targetLocation = options.city || options.province || options.locality || parsedIntent.locationToken;
  const targetCategory = options.category || parsedIntent.categoryToken;
  const maxPrice = options.maxPrice || parsedIntent.maxPrice;
  const minPrice = options.minPrice || null;

  // Build Prisma filter
  const whereConditions: any[] = [];

  if (targetLocation) {
    const locVariants = getVariants(targetLocation);
    const locOrs: any[] = [];
    locVariants.forEach((locVal) => {
      locOrs.push(
        { province: { contains: locVal, mode: "insensitive" } },
        { city: { contains: locVal, mode: "insensitive" } },
        { parish: { contains: locVal, mode: "insensitive" } },
        { sector: { contains: locVal, mode: "insensitive" } },
        { locality: { contains: locVal, mode: "insensitive" } },
        { address: { contains: locVal, mode: "insensitive" } }
      );
    });
    whereConditions.push({ OR: locOrs });
  }

  if (targetCategory) {
    const catVariants = getVariants(targetCategory);
    const catOrs: any[] = [];
    catVariants.forEach((catVal) => {
      catOrs.push(
        { specialty: { contains: catVal, mode: "insensitive" } },
        { categories: { some: { name: { contains: catVal, mode: "insensitive" } } } },
        { dishes: { some: { name: { contains: catVal, mode: "insensitive" } } } }
      );
    });
    whereConditions.push({ OR: catOrs });
  }

  // Text tokens matching
  if (parsedIntent.textTokens.length > 0) {
    const tokenOrs = parsedIntent.textTokens.map((token) => {
      const tokenVariants = getVariants(token);
      const subOrs: any[] = [];
      tokenVariants.forEach((tv) => {
        subOrs.push(
          { name: { contains: tv, mode: "insensitive" as const } },
          { specialty: { contains: tv, mode: "insensitive" as const } },
          { description: { contains: tv, mode: "insensitive" as const } },
          { categories: { some: { name: { contains: tv, mode: "insensitive" as const } } } },
          { dishes: { some: { name: { contains: tv, mode: "insensitive" as const } } } }
        );
      });
      return { OR: subOrs };
    });
    whereConditions.push(...tokenOrs);
  }

  const whereClause = whereConditions.length > 0 ? { AND: whereConditions } : {};

  // Execute Prisma query
  const allMatchingRestaurants = await prismaTenant.restaurant.findMany({
    where: whereClause,
    select: {
      id: true,
      slug: true,
      name: true,
      specialty: true,
      description: true,
      address: true,
      locality: true,
      province: true,
      city: true,
      sector: true,
      whatsapp: true,
      logoUrl: true,
      coverUrl: true,
      schedule: true,
      deliveryEnabled: true,
      deliveryCost: true,
      latitude: true,
      longitude: true,
      categories: {
        select: {
          id: true,
          name: true,
          dishes: {
            where: {
              isAvailable: true,
              ...(maxPrice ? { price: { lte: maxPrice } } : {}),
              ...(minPrice ? { price: { gte: minPrice } } : {}),
            },
            select: {
              id: true,
              name: true,
              description: true,
              price: true,
              imageUrl: true,
            },
          },
        },
      },
    },
  });

  const matchedDishes: DishSearchResult[] = [];
  const rankedRestaurants: RestaurantSearchResult[] = [];

  allMatchingRestaurants.forEach((r) => {
    let score = 0;
    const cleanName = r.name.toLowerCase();
    const cleanSpec = (r.specialty || "").toLowerCase();
    const cleanDesc = (r.description || "").toLowerCase();
    const cleanLoc = (r.locality || "").toLowerCase();

    // 1. Name score (+100)
    if (parsedIntent.cleanQuery && cleanName.includes(parsedIntent.cleanQuery)) {
      score += 100;
    }

    // 2. Location score (+100)
    if (targetLocation && cleanLoc.normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(targetLocation.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase())) {
      score += 100;
    }

    // 3. Category & Specialty score (+80 & +70)
    if (targetCategory && (cleanSpec.includes(targetCategory.toLowerCase()) || r.categories.some((c) => c.name.toLowerCase().includes(targetCategory.toLowerCase())))) {
      score += 80;
    }

    let matchedDishesCount = 0;

    r.categories.forEach((cat) => {
      cat.dishes.forEach((dish) => {
        const dishNameClean = dish.name.toLowerCase();
        let isDishMatch = false;

        if (parsedIntent.textTokens.length > 0 && parsedIntent.textTokens.some((t) => dishNameClean.includes(t))) {
          isDishMatch = true;
        } else if (targetCategory && dishNameClean.includes(targetCategory.toLowerCase())) {
          isDishMatch = true;
        } else if (parsedIntent.cleanQuery && dishNameClean.includes(parsedIntent.cleanQuery)) {
          isDishMatch = true;
        }

        if (isDishMatch) {
          score += 90;
          matchedDishesCount++;
          matchedDishes.push({
            id: dish.id,
            name: dish.name,
            description: dish.description,
            price: dish.price,
            imageUrl: dish.imageUrl,
            categoryName: cat.name,
            restaurantId: r.id,
            restaurantName: r.name,
            restaurantSlug: r.slug,
            locality: r.locality,
          });
        }
      });
    });

    if (cleanDesc && parsedIntent.textTokens.some((t) => cleanDesc.includes(t))) {
      score += 40;
    }

    // GPS distance calculation
    let distanceKm: number | null = null;
    if (options.lat && options.lng && r.latitude && r.longitude) {
      distanceKm = calculateHaversineDistanceKm(options.lat, options.lng, r.latitude, r.longitude);
    }

    rankedRestaurants.push({
      id: r.id,
      slug: r.slug,
      name: r.name,
      specialty: r.specialty,
      description: r.description,
      address: r.address,
      locality: r.locality,
      province: r.province,
      city: r.city,
      sector: r.sector,
      whatsapp: r.whatsapp,
      logoUrl: r.logoUrl,
      coverUrl: r.coverUrl,
      schedule: r.schedule,
      deliveryEnabled: r.deliveryEnabled,
      deliveryCost: r.deliveryCost,
      latitude: r.latitude,
      longitude: r.longitude,
      distanceKm,
      relevanceScore: score,
      categories: r.categories.map((c) => ({ id: c.id, name: c.name })),
      matchedDishesCount,
    });
  });

  // Sort by relevance score descending (or by GPS distance if provided)
  rankedRestaurants.sort((a, b) => {
    if (options.lat && options.lng && a.distanceKm !== null && b.distanceKm !== null) {
      return a.distanceKm - b.distanceKm;
    }
    return b.relevanceScore - a.relevanceScore;
  });

  // Pagination slice
  const totalRestaurants = rankedRestaurants.length;
  const startIndex = (page - 1) * limit;
  const paginatedRestaurants = rankedRestaurants.slice(startIndex, startIndex + limit);
  const totalPages = Math.ceil(totalRestaurants / limit) || 1;

  // Build suggestions if 0 results
  let suggestions: SearchEngineResponse["suggestions"] = undefined;
  if (totalRestaurants === 0) {
    const activeCats = await prismaTenant.category.findMany({
      select: { name: true },
      distinct: ["name"],
      take: 6,
    });
    const activeLocs = await prismaTenant.restaurant.findMany({
      select: { city: true, sector: true, locality: true },
      take: 6,
    });

    const citiesSet = new Set<string>();
    activeLocs.forEach((l) => {
      if (l.sector) citiesSet.add(l.sector);
      else if (l.city) citiesSet.add(l.city);
    });

    suggestions = {
      availableCategories: activeCats.map((c) => c.name),
      availableCities: Array.from(citiesSet),
    };
  }

  // Non-blocking analytics logging
  if (rawQuery.trim().length > 0) {
    trackAnalyticsEvent("SEARCH", null, {
      query: rawQuery,
      location: targetLocation,
      category: targetCategory,
      resultsCount: totalRestaurants,
    });
  }

  return {
    success: true,
    parsedIntent,
    totalRestaurants,
    totalDishes: matchedDishes.length,
    restaurants: paginatedRestaurants,
    matchedDishes: matchedDishes.slice(0, 10),
    suggestions,
    pagination: {
      page,
      limit,
      totalPages,
    },
  };
}
