import { prismaTenant } from "@/lib/db";

export type EventType =
  | "SEARCH"
  | "RESTAURANT_VIEW"
  | "MENU_VIEW"
  | "DISH_VIEW"
  | "QR_SCAN"
  | "WHATSAPP_CLICK"
  | "LOCATION_CLICK";

export async function trackAnalyticsEvent(
  eventType: EventType,
  restaurantId?: string | null,
  metadata?: Record<string, any>
) {
  try {
    const metaString = metadata ? JSON.stringify(metadata) : null;
    let isTest = false;
    if (restaurantId) {
      try {
        const rest = await prismaTenant.restaurant.findUnique({
          where: { id: restaurantId },
          select: { testMode: true },
        });
        if (rest?.testMode) isTest = true;
      } catch {}
    }

    await prismaTenant.analyticsEvent.create({
      data: {
        eventType,
        restaurantId: restaurantId || null,
        metadata: metaString,
        isTest,
      },
    });
  } catch (err) {
    // Non-blocking log to ensure user flows never fail
    console.warn(`[Analytics Warning] Failed to log event ${eventType}:`, err);
  }
}
