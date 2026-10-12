import { NextRequest, NextResponse } from "next/server";
import { getMarketplaceDishesAction } from "@/lib/suggested-dishes-actions";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = (searchParams.get("type") as "all" | "restaurant" | "store") || "all";
    const search = searchParams.get("search") || searchParams.get("q") || "";
    const province = searchParams.get("province") || "TODAS";
    const canton = searchParams.get("canton") || "TODAS";
    const parish = searchParams.get("parish") || "TODAS";
    const sector = searchParams.get("sector") || "TODAS";
    const onlySuggested = searchParams.get("onlySuggested") !== "false";
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    const result = await getMarketplaceDishesAction({
      type,
      search,
      province,
      canton,
      parish,
      sector,
      onlySuggested,
      limit,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("[API Marketplace GET Error]:", error);
    return NextResponse.json(
      { success: false, error: "Error consultando marketplace", dishes: [], total: 0, restaurantCount: 0, storeCount: 0 },
      { status: 500 }
    );
  }
}
