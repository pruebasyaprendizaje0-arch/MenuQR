import { NextResponse } from "next/server";
import { executeGastronomicSearch, SearchOptions } from "@/lib/search-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const q = searchParams.get("q") || searchParams.get("query") || "";
    const province = searchParams.get("province") || searchParams.get("provincia") || undefined;
    const city = searchParams.get("city") || searchParams.get("ciudad") || undefined;
    const locality = searchParams.get("locality") || searchParams.get("sector") || undefined;
    const category = searchParams.get("category") || searchParams.get("categoria") || undefined;

    const minPriceParam = searchParams.get("minPrice");
    const maxPriceParam = searchParams.get("maxPrice");
    const minPrice = minPriceParam ? parseFloat(minPriceParam) : undefined;
    const maxPrice = maxPriceParam ? parseFloat(maxPriceParam) : undefined;

    const latParam = searchParams.get("lat");
    const lngParam = searchParams.get("lng");
    const lat = latParam ? parseFloat(latParam) : undefined;
    const lng = lngParam ? parseFloat(lngParam) : undefined;

    const pageParam = searchParams.get("page");
    const limitParam = searchParams.get("limit");
    const page = pageParam ? parseInt(pageParam, 10) : 1;
    const limit = limitParam ? parseInt(limitParam, 10) : 20;

    const searchOptions: SearchOptions = {
      query: q,
      province,
      city,
      locality,
      category,
      minPrice,
      maxPrice,
      lat,
      lng,
      page,
      limit,
    };

    const searchResult = await executeGastronomicSearch(searchOptions);

    return NextResponse.json(searchResult);
  } catch (error: any) {
    console.error("[Public Search API Error]:", error);
    return NextResponse.json(
      { success: false, error: "Error al procesar la búsqueda gastronómica." },
      { status: 500 }
    );
  }
}
