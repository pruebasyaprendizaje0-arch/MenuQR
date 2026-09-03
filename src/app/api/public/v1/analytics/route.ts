import { NextResponse } from "next/server";
import { trackAnalyticsEvent, EventType } from "@/lib/analytics";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { eventType, restaurantId, metadata } = body;

    if (!eventType) {
      return NextResponse.json({ success: false, error: "Missing eventType" }, { status: 400 });
    }

    await trackAnalyticsEvent(eventType as EventType, restaurantId, metadata);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: "Failed to record analytics" }, { status: 500 });
  }
}
