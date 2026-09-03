import { NextResponse } from "next/server";
import { prismaTenant } from "@/lib/db";
import { getBaseUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function GET() {
  const baseUrl = getBaseUrl();

  let restaurants: any[] = [];
  try {
    restaurants = await prismaTenant.restaurant.findMany({
      select: {
        slug: true,
        name: true,
        specialty: true,
        locality: true,
        city: true,
        province: true,
        address: true,
        whatsapp: true,
        schedule: true,
        description: true,
        dishes: {
          select: {
            name: true,
            price: true,
          },
          take: 5,
        },
      },
      take: 50,
    });
  } catch (error) {
    console.error("[llms.txt Error]:", error);
  }

  let content = `# MenuQR Pro - Plataforma Gastronómica Local y Menús Digitales QR en Ecuador

> MenuQR Pro (https://menuqr.ubicame.cc) es la plataforma gastronómica de Ecuador diseñada para que restaurantes, cafeterías, bares y locales de comida digitalicen sus cartas, permitan la consulta interactiva con código QR en mesa y procesen pedidos automáticos por WhatsApp sin comisiones por venta.

## Información de la Plataforma
- **Dominio Principal**: ${baseUrl}
- **Cobertura**: Ecuador (Quito, Guayaquil, Cuenca, Ambato, Manta, Salinas, Montañita, Olón, Loja, Machala, Portoviejo, Ibarra, Babahoyo, Quevedo, Riobamba, Esmeraldas y más).
- **Servicios**: Menús Digitales QR, Pedidos estructurados a WhatsApp, Gestión de Mesas, Configuración de IVA 15% y Servicio 10%, Datos bancarios directos.
- **Costo**: $10.00 USD/mes por restaurante con 30 días de prueba 100% gratuita.

## Secciones Principales
- Inicio: ${baseUrl}
- Directorio de Restaurantes: ${baseUrl}/restaurantes
- Preguntas Frecuentes (FAQ): ${baseUrl}/faq
- Registro de Restaurantes: ${baseUrl}/registro
- Términos y Condiciones: ${baseUrl}/terminos
- Política de Privacidad: ${baseUrl}/privacidad

## Restaurantes Registrados en Ecuador\n\n`;

  restaurants.forEach((r) => {
    const location = r.city || r.locality || "Ecuador";
    content += `### ${r.name}\n`;
    content += `- **URL del Menú**: ${baseUrl}/${r.slug}\n`;
    content += `- **Ubicación**: ${location}${r.address ? `, ${r.address}` : ""}${r.province ? ` (${r.province})` : ""}\n`;
    content += `- **Especialidad**: ${r.specialty || "Gastronomía local"}\n`;
    if (r.whatsapp) content += `- **WhatsApp Pedidos**: ${r.whatsapp}\n`;
    if (r.schedule) content += `- **Horario**: ${r.schedule}\n`;
    if (r.description) content += `- **Descripción**: ${r.description}\n`;

    if (r.dishes && r.dishes.length > 0) {
      content += `- **Platos destacados**:\n`;
      r.dishes.forEach((d: any) => {
        content += `  * ${d.name} - $${Number(d.price).toFixed(2)}\n`;
      });
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
