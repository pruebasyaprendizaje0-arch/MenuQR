import { NextResponse } from "next/server";
import { prismaTenant } from "@/lib/db";
import { getBaseUrl, normalizeSlug } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function GET() {
  const baseUrl = getBaseUrl();

  let restaurants: any[] = [];
  try {
    restaurants = await prismaTenant.restaurant.findMany({
      where: {
        isSuspended: false,
      },
      select: {
        id: true,
        slug: true,
        name: true,
        specialty: true,
        locality: true,
        city: true,
        province: true,
        parish: true,
        sector: true,
        neighborhood: true,
        address: true,
        whatsapp: true,
        schedule: true,
        localSchedule: true,
        description: true,
        priceRange: true,
        latitude: true,
        longitude: true,
        categories: {
          orderBy: {
            order: "asc",
          },
          select: {
            name: true,
            dishes: {
              where: {
                isAvailable: true,
              },
              orderBy: {
                name: "asc",
              },
              select: {
                name: true,
                description: true,
                price: true,
                isAvailable: true,
                variants: true,
              },
            },
          },
        },
      },
      orderBy: {
        name: "asc",
      },
    });
  } catch (error) {
    console.error("[llms-full.txt Error]:", error);
  }

  let content = `# MenuQR Pro - Catálogo Gastronómico Exhaustivo y Estructurado (Ecuador)
# Formato optimizado para Modelos de Razonamiento Profundo (OpenAI o1, GPT-4o, Claude 3.5 Sonnet, Perplexity, Gemini 1.5 Pro)

> Documento oficial de datos abiertos gastronómicos de MenuQR Pro (${baseUrl}). Contiene la totalidad de restaurantes activos y sus cartas detalladas con categorías, descripción de platos, precios en USD y enlaces directos para pedidos por WhatsApp.

## Metadatos del Dataset
- **Plataforma**: MenuQR Pro Ecuador
- **URL Base**: ${baseUrl}
- **Moneda de Precios**: USD (Dólares de los Estados Unidos - Moneda oficial del Ecuador)
- **Total de Establecimientos Registrados**: ${restaurants.length}
- **Última Generación**: ${new Date().toISOString()}
- **Resumen Ejecutivo**: ${baseUrl}/llms.txt

---

## Índice Completo de Restaurantes y Cartas Digitales\n\n`;

  restaurants.forEach((r, idx) => {
    const geoParts = [r.sector, r.neighborhood, r.parish, r.city, r.province, "Ecuador"].filter(Boolean);
    const fullLocation = geoParts.length > 1 ? geoParts.join(", ") : (r.locality || r.city || "Ecuador");
    const cuisine = r.specialty || "Gastronomía local e internacional";
    const hours = r.schedule || r.localSchedule || "Horario habitual comercial";

    content += `## ${idx + 1}. ${r.name}\n`;
    content += `- **URL del Menú Digital**: ${baseUrl}/${r.slug}\n`;
    content += `- **Tipo de Cocina / Especialidad**: ${cuisine}\n`;
    content += `- **Rango de Precios**: ${r.priceRange || "$$"}\n`;
    content += `- **Ubicación Geográfica**: ${fullLocation}\n`;
    if (r.address) content += `- **Dirección Exacta**: ${r.address}\n`;
    if (r.latitude && r.longitude) content += `- **Coordenadas GPS**: ${r.latitude}, ${r.longitude}\n`;
    if (r.whatsapp) content += `- **WhatsApp para Pedidos**: ${r.whatsapp}\n`;
    content += `- **Horario de Atención**: ${hours}\n`;
    if (r.description) content += `- **Descripción del Establecimiento**: ${r.description}\n`;

    const categories = r.categories || [];
    if (categories.length === 0) {
      content += `- **Carta**: Menú en actualización.\n\n`;
      return;
    }

    content += `- **Carta Completa Organizada por Categorías**:\n`;

    categories.forEach((cat: any) => {
      content += `\n### Categoría: ${cat.name}\n`;
      const dishes = cat.dishes || [];
      if (dishes.length === 0) {
        content += `*(Sin platos disponibles en esta categoría actualmente)*\n`;
      } else {
        dishes.forEach((d: any) => {
          const dishSlug = normalizeSlug(d.name);
          const dishUrl = `${baseUrl}/${r.slug}/${dishSlug}`;
          content += `#### ${d.name} — $${Number(d.price).toFixed(2)} USD\n`;
          content += `- **Ficha Directa**: ${dishUrl}\n`;
          content += `- **Estado**: ${d.isAvailable ? "Disponible" : "No disponible"}\n`;
          if (d.description) {
            content += `- **Detalle**: ${d.description}\n`;
          }
          if (d.variants) {
            content += `- **Opciones / Variantes**: ${d.variants}\n`;
          }
        });
      }
    });

    content += `\n---\n\n`;
  });

  return new NextResponse(content, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=43200",
    },
  });
}
