import { prismaTenant } from "@/lib/db";

export function sanitizeSlug(input: string): string {
  if (!input || typeof input !== "string") return "";
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function findRestaurantBySlugOrHistory(slug: string) {
  if (!slug || typeof slug !== "string") {
    return { restaurant: null, isRedirect: false, targetSlug: null };
  }
  let decodedSlug = slug;
  try {
    decodedSlug = decodeURIComponent(slug);
  } catch {}

  const cleanSlug = decodedSlug.toLowerCase().trim();
  const sanitizedSlug = sanitizeSlug(decodedSlug);

  // 1. Try finding by current active slug (exact match)
  let restaurant = await prismaTenant.restaurant.findUnique({
    where: { slug: cleanSlug },
  });

  if (restaurant) {
    return { restaurant, isRedirect: false, targetSlug: cleanSlug };
  }

  // 1.b If slug had spaces or special chars, check sanitized slug
  if (sanitizedSlug && sanitizedSlug !== cleanSlug) {
    restaurant = await prismaTenant.restaurant.findUnique({
      where: { slug: sanitizedSlug },
    });
    if (restaurant) {
      return { restaurant, isRedirect: true, targetSlug: sanitizedSlug };
    }
  }

  // 2. Try finding in SlugHistory
  const history = await prismaTenant.slugHistory.findFirst({
    where: {
      OR: [
        { oldSlug: cleanSlug },
        ...(sanitizedSlug && sanitizedSlug !== cleanSlug ? [{ oldSlug: sanitizedSlug }] : []),
      ],
    },
    include: {
      restaurant: true,
    },
  });

  if (history && history.restaurant) {
    return {
      restaurant: history.restaurant,
      isRedirect: true,
      targetSlug: history.restaurant.slug,
    };
  }

  return { restaurant: null, isRedirect: false, targetSlug: null };
}

export async function recordSlugChange(restaurantId: string, oldSlug: string, newSlug: string) {
  const normOld = oldSlug.toLowerCase().trim();
  const normNew = newSlug.toLowerCase().trim();

  if (normOld === normNew) return;

  try {
    // Record old slug in SlugHistory if it doesn't exist yet
    await prismaTenant.slugHistory.upsert({
      where: { oldSlug: normOld },
      create: {
        oldSlug: normOld,
        restaurantId,
      },
      update: {
        restaurantId,
      },
    });
  } catch (error) {
    console.warn(`[SlugHistory Warning] Failed to record slug change from '${normOld}' to '${normNew}':`, error);
  }
}
