import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getElementFiltersConfigAction } from "@/lib/element-filters-actions";
import { findRestaurantBySlugOrHistory } from "@/lib/slugs";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> | { slug: string } }
) {
  try {
    const resolvedParams = await Promise.resolve(context.params);
    const slug = (resolvedParams?.slug || "").toLowerCase().trim();

    const slugCheck = await findRestaurantBySlugOrHistory(slug);
    const targetSlug = slugCheck.targetSlug || slug;

    const restaurant = await prisma.restaurant.findUnique({
      where: { slug: targetSlug },
      select: { id: true, name: true, slug: true, themeColor: true },
    });

    if (!restaurant) {
      return NextResponse.json({ success: false, error: "Restaurante no encontrado" }, { status: 404 });
    }

    const config = await getElementFiltersConfigAction(restaurant.id);

    return NextResponse.json({
      success: true,
      config,
    });
  } catch (error: any) {
    console.error("Error en API de configuración de filtros:", error);
    return NextResponse.json({ success: false, error: error?.message || "Error interno" }, { status: 500 });
  }
}
