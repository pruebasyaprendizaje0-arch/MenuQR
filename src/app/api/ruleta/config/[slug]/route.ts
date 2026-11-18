import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getOrCreateRuletaConfig } from "@/lib/ruleta-actions";
import { RuletaPremioItem, RuletaPublicSector } from "@/lib/ruleta-types";
import { findRestaurantBySlugOrHistory } from "@/lib/slugs";
import { getMockDemoRestaurant } from "@/lib/demo-data";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const resolvedParams = await context.params;
    const slug = resolvedParams?.slug || "";
    const cleanSlug = slug.toLowerCase().trim();

    if (cleanSlug === "demo") {
      const demoRest = getMockDemoRestaurant();
      const publicSectors: RuletaPublicSector[] = [
        { id: "1", label: "10% de Descuento", tipo: "porcentaje", color_hex: "#ef4444", sectorIndex: 0 },
        { id: "2", label: "Bebida Gratis", tipo: "regalo", color_hex: "#f97316", sectorIndex: 1 },
        { id: "3", label: "Postre Gratis", tipo: "regalo", color_hex: "#eab308", sectorIndex: 2 },
        { id: "4", label: "Papas Rústicas Gratis", tipo: "regalo", color_hex: "#10b981", sectorIndex: 3 },
        { id: "5", label: "$5.00 de Descuento", tipo: "monto", color_hex: "#3b82f6", sectorIndex: 4 },
        { id: "6", label: "Sigue Participando", tipo: "nada", color_hex: "#6b7280", sectorIndex: 5 },
      ];
      return NextResponse.json({
        success: true,
        activa: true,
        restaurant: {
          id: demoRest.id,
          name: demoRest.name,
          slug: "demo",
          logoUrl: demoRest.logoUrl,
          whatsapp: demoRest.whatsapp,
        },
        config: {
          titulo: "¡Gira y Gana con La Parrilla Criolla!",
          descripcion: "Prueba tu suerte y reclama tu premio en tu mesa o pedido.",
          colorPrimario: "#ef4444",
          colorSecundario: "#ffffff",
          colorFondo: "#1e1e2d",
          limiteDiasReGiro: 1,
          expiracionHoras: 24,
          sectores: publicSectors,
        },
      }, {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      });
    }

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

    const { searchParams } = new URL(request.url);
    const modo = (searchParams.get("modo") || searchParams.get("tablet") || searchParams.get("kiosk") || "").toLowerCase();
    const isTabletMode = ["tablet", "caja", "kiosco", "true", "1"].includes(modo);

    const config = await getOrCreateRuletaConfig(restaurant.id);

    if (!config.activa && !isTabletMode) {
      return NextResponse.json({
        success: true,
        activa: false,
        isTabletMode: false,
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
      }, {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
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
    }, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
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
