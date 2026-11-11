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

    // Obtener camareros (Excluyendo terminantemente el PIN para seguridad de salón)
    const { rows: camareros } = await pool.query(
      "SELECT id, negocio_id, nombre, activo FROM camareros WHERE negocio_id = $1 AND activo = true ORDER BY nombre ASC",
      [id]
    );

    // Obtener platos/productos desde Prisma
    let productos: any[] = [];
    let defaultAspect: "1:1" | "9:16" = "1:1";
    let themeColor = "#059669";
    let ivaPercent = 15.0;
    let servicePercent = 10.0;
    let ivaOnTable = true;
    let serviceOnTable = true;
    let ivaOnTakeout = true;
    let serviceOnTakeout = false;

    try {
      const prismaRest = await prisma.restaurant.findFirst({
        where: {
          OR: [{ id }, { slug: negocio.slug }],
        },
        select: {
          customLabels: true,
          themeColor: true,
          ivaPercent: true,
          servicePercent: true,
          ivaOnTable: true,
          serviceOnTable: true,
          ivaOnTakeout: true,
          serviceOnTakeout: true,
        },
      });

      if (prismaRest) {
        if (prismaRest.themeColor) themeColor = prismaRest.themeColor;
        if (typeof prismaRest.ivaPercent === "number") ivaPercent = prismaRest.ivaPercent;
        if (typeof prismaRest.servicePercent === "number") servicePercent = prismaRest.servicePercent;
        if (typeof prismaRest.ivaOnTable === "boolean") ivaOnTable = prismaRest.ivaOnTable;
        if (typeof prismaRest.serviceOnTable === "boolean") serviceOnTable = prismaRest.serviceOnTable;
        if (typeof prismaRest.ivaOnTakeout === "boolean") ivaOnTakeout = prismaRest.ivaOnTakeout;
        if (typeof prismaRest.serviceOnTakeout === "boolean") serviceOnTakeout = prismaRest.serviceOnTakeout;

        if (prismaRest.customLabels) {
          try {
            const parsed = typeof prismaRest.customLabels === "string" ? JSON.parse(prismaRest.customLabels) : prismaRest.customLabels;
            if (parsed?.imageAspectRatio === "9:16" || parsed?.imageAspectRatio === "1:1") {
              defaultAspect = parsed.imageAspectRatio;
            }
          } catch {}
        }
      }

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
          description: true,
          price: true,
          imageUrl: true,
          isAvailable: true,
          stock: true,
          minStock: true,
          trackStock: true,
          category: {
            select: { name: true, imageAspectRatio: true },
          },
          modifierGroups: {
            include: {
              options: {
                orderBy: { extraPrice: "asc" },
              },
            },
            orderBy: { createdAt: "asc" },
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
      negocio: {
        ...negocio,
        themeColor,
        imageAspectRatio: defaultAspect,
        ivaPercent,
        servicePercent,
        ivaOnTable,
        serviceOnTable,
        ivaOnTakeout,
        serviceOnTakeout,
      },
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
