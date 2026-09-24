import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getOrCreateRuletaConfig } from "@/lib/ruleta-actions";
import { RuletaPremioItem, RuletaPublicSector } from "@/lib/ruleta-types";
import { findRestaurantBySlugOrHistory } from "@/lib/slugs";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> | { slug: string } }
) {
  try {
    const resolvedParams = await Promise.resolve(context.params);
    const slug = resolvedParams?.slug || "";
    const cleanSlug = slug.toLowerCase().trim();

    const slugCheck = await findRestaurantBySlugOrHistory(cleanSlug);
    const targetSlug = slugCheck.targetSlug || cleanSlug;

    const restaurant = await prisma.restaurant.findUnique({
      where: { slug: targetSlug },
      select: {
        id: true,
        name: true,
        slug: true,
        logoUrl: true,
        themeColor: true,
        whatsapp: true,
      },
    });

    if (!restaurant) {
      return NextResponse.json(
        { success: false, error: "Restaurante no encontrado" },
        { status: 404 }
      );
    }

    const config = await getOrCreateRuletaConfig(restaurant.id);

    if (!config.activa) {
      return NextResponse.json({
        success: true,
        activa: false,
        restaurant: {
          id: restaurant.id,
          name: restaurant.name,
          slug: restaurant.slug,
          logoUrl: restaurant.logoUrl,
          whatsapp: restaurant.whatsapp,
        },
        config: {
          titulo: config.titulo,
          descripcion: config.descripcion,
          colorPrimario: config.colorPrimario || restaurant.themeColor,
          colorSecundario: config.colorSecundario,
          colorFondo: config.colorFondo,
          limiteDiasReGiro: config.limiteDiasReGiro,
          expiracionHoras: config.expiracionHoras,
          sectores: [],
        },
      });
    }

    // Ofuscar probabilidades y stock sensible para el cliente frontend
    const publicSectors: RuletaPublicSector[] = (config.premiosList || []).map(
      (p: RuletaPremioItem, idx: number) => ({
        id: p.id,
        label: p.label,
        tipo: p.tipo,
        color_hex: p.color_hex,
        sectorIndex: idx,
      })
    );

    return NextResponse.json({
      success: true,
      activa: true,
      restaurant: {
        id: restaurant.id,
        name: restaurant.name,
        slug: restaurant.slug,
        logoUrl: restaurant.logoUrl,
        whatsapp: restaurant.whatsapp,
      },
      config: {
        titulo: config.titulo,
        descripcion: config.descripcion,
        colorPrimario: config.colorPrimario || restaurant.themeColor,
        colorSecundario: config.colorSecundario,
        colorFondo: config.colorFondo,
        limiteDiasReGiro: config.limiteDiasReGiro,
        expiracionHoras: config.expiracionHoras,
        sectores: publicSectors,
      },
    });
  } catch (error: any) {
    console.error("[API Ruleta Config Error]:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Error al obtener configuración" },
      { status: 500 }
    );
  }
}
