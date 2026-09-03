import { prismaTenant } from "@/lib/db";

export async function findRestaurantBySlugOrHistory(slug: string) {
  const cleanSlug = slug.toLowerCase().trim();

  // 1. Try finding by current active slug
  const restaurant = await prismaTenant.restaurant.findUnique({
    where: { slug: cleanSlug },
  });

  if (restaurant) {
    return { restaurant, isRedirect: false, targetSlug: cleanSlug };
  }

  // 2. Try finding in SlugHistory
  const history = await prismaTenant.slugHistory.findUnique({
    where: { oldSlug: cleanSlug },
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
