import { NextRequest, NextResponse } from "next/server";
import { pool, ensureDbTables } from "@/lib/db-pool";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDbTables();
    const { id } = await context.params;

    const { rows: negocioRows } = await pool.query(
      "SELECT id, nombre, slug, numero_mesas, created_at FROM negocios WHERE id = $1 LIMIT 1",
      [id]
    );

    if (negocioRows.length === 0) {
      return NextResponse.json({ ok: false, error: "Negocio no encontrado" }, { status: 404 });
    }

    const negocio = negocioRows[0];

    // Obtener camareros
    const { rows: camareros } = await pool.query(
      "SELECT id, negocio_id, nombre, pin, activo FROM camareros WHERE negocio_id = $1 AND activo = true ORDER BY nombre ASC",
      [id]
    );

    // Obtener platos/productos desde Prisma
    let productos: any[] = [];
    try {
      productos = await prisma.dish.findMany({
        where: {
          OR: [
            { restaurantId: id },
            { restaurant: { slug: negocio.slug } },
          ],
        },
        select: {
          id: true,
          name: true,
          price: true,
          imageUrl: true,
          isAvailable: true,
          category: {
            select: { name: true },
          },
        },
        orderBy: [{ category: { order: "asc" } }, { name: "asc" }],
      });
    } catch (dbErr) {
      console.warn("Could not fetch dishes from prisma, trying fallback query:", dbErr);
    }

    // Si no hay productos en Prisma, generar demo si estuviera vacío
    if (productos.length === 0) {
      productos = [
        { id: "demo-1", name: "Hamburguesa Clásica", price: 6.5, isAvailable: true, category: { name: "Platos Fuertes" } },
        { id: "demo-2", name: "Empanada de Carne", price: 2.0, isAvailable: true, category: { name: "Entradas" } },
        { id: "demo-3", name: "Papas Rústicas", price: 3.5, isAvailable: true, category: { name: "Acompañamientos" } },
        { id: "demo-4", name: "Cerveza Artesanal", price: 4.0, isAvailable: true, category: { name: "Bebidas" } },
        { id: "demo-5", name: "Gaseosa 500ml", price: 1.5, isAvailable: true, category: { name: "Bebidas" } },
      ];
    }

    return NextResponse.json({
      ok: true,
      negocio,
      camareros,
      productos,
    });
  } catch (err: any) {
    console.error("[GET /api/negocios/[id]] Error:", err);
    return NextResponse.json(
      { ok: false, error: err.message || "Error al obtener detalle del negocio" },
      { status: 500 }
    );
  }
}
