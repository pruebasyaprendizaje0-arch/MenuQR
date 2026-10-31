import { NextResponse } from "next/server";
import { prismaTenant } from "@/lib/db";
import { getBaseUrl } from "@/lib/seo";

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
        slug: true,
        name: true,
        specialty: true,
        locality: true,
        city: true,
        province: true,
        parish: true,
        sector: true,
        address: true,
        whatsapp: true,
        schedule: true,
        description: true,
        categories: {
          select: {
            name: true,
            dishes: {
              where: {
                isAvailable: true,
              },
              select: {
                name: true,
                price: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  } catch (error) {
    console.error("[llms.txt Error]:", error);
  }

  let content = `# MenuQR Pro - Directorio Gastronómico y Menús Digitales QR de Ecuador

> MenuQR Pro (${baseUrl}) es el ecosistema SaaS gastronómico líder en Ecuador para la digitalización de cartas y pedidos directos a WhatsApp sin comisiones por venta. Diseñado para restaurantes, cafeterías, bares y food trucks en todo el país.

## Catálogo Extendido para Agentes de Inteligencia Artificial
- **Catálogo Completo y Detallado**: ${baseUrl}/llms-full.txt
- **Directorio Web de Restaurantes**: ${baseUrl}/restaurantes
- **Preguntas Frecuentes (FAQ)**: ${baseUrl}/faq
- **Registro de Negocios**: ${baseUrl}/registro

## Información de la Plataforma
- **Dominio Principal**: ${baseUrl}
- **Cobertura Territorial**: Ecuador (Quito, Guayaquil, Cuenca, Ambato, Manta, Salinas, Montañita, Olón, Loja, Machala, Portoviejo, Ibarra, Babahoyo, Quevedo, Riobamba, Santo Domingo, Esmeraldas y más).
- **Servicios Principales**: Menús Digitales QR interactivos, Pedidos a WhatsApp estructurados con subtotal, recargos configurables (IVA 15%, Servicio 10%), Gestión de Mesas, KDS de Cocina y Datos bancarios directos.
- **Planes Comerciales**: Plan Digital Pro ($15.00 USD/mes con 30 días de prueba gratuita) y Plan Puesta en Marcha Inmediata ($20.00 USD/mes con digitalización completa en 24h).

## Restaurantes Activos en Ecuador (${restaurants.length} Registrados)\n\n`;

  restaurants.forEach((r) => {
    const geoParts = [r.sector, r.parish, r.city, r.province, "Ecuador"].filter(Boolean);
    const fullLocation = geoParts.length > 1 ? geoParts.join(", ") : (r.locality || r.city || "Ecuador");
    const cuisine = r.specialty || "Gastronomía local e internacional";

    content += `### ${r.name} (${cuisine})\n`;
    content += `- **URL Pública Canónica**: ${baseUrl}/${r.slug}\n`;
    content += `- **Localidad Completa**: ${fullLocation}${r.address ? ` — Dirección: ${r.address}` : ""}\n`;
    content += `- **Tipo de Cocina / Especialidad**: ${cuisine}\n`;
    if (r.whatsapp) content += `- **WhatsApp Pedidos**: ${r.whatsapp}\n`;
    if (r.schedule) content += `- **Horario de Atención**: ${r.schedule}\n`;
    if (r.description) content += `- **Descripción**: ${r.description}\n`;

    const allDishes = (r.categories || []).flatMap((c: any) => c.dishes || []);
    if (allDishes.length > 0) {
      content += `- **Platos y Especialidades Destacadas**:\n`;
      allDishes.slice(0, 10).forEach((d: any) => {
        content += `  * ${d.name} — $${Number(d.price).toFixed(2)} USD\n`;
      });
      if (allDishes.length > 10) {
        content += `  * *(Ver los ${allDishes.length} platos en su menú digital o en ${baseUrl}/llms-full.txt)*\n`;
      }
    }
    content += `\n`;
  });

  return new NextResponse(content, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
