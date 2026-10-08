import { NextRequest, NextResponse } from "next/server";
import { pool, ensureDbTables } from "@/lib/db-pool";
import { getUserSession, getSuperAdminSession } from "@/lib/auth";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    await ensureDbTables();

    const { searchParams } = new URL(req.url);
    const slug = searchParams.get("slug");
    const negocioId = searchParams.get("negocio_id");

    // 1. Si se consulta por slug específico (ej: /[slug]/cocina, /cocina?slug=pigro)
    if (slug) {
      const { rows } = await pool.query(
        "SELECT id, nombre, slug, numero_mesas, created_at FROM negocios WHERE slug = $1 LIMIT 1",
        [slug]
      );
      if (rows.length > 0) {
        return NextResponse.json({
          ok: true,
          negocios: rows,
          active_id: rows[0].id,
          single_business: true,
        });
      }
    }

    // 2. Si se consulta por ID específico
    if (negocioId) {
      const { rows } = await pool.query(
        "SELECT id, nombre, slug, numero_mesas, created_at FROM negocios WHERE id = $1 LIMIT 1",
        [negocioId]
      );
      if (rows.length > 0) {
        return NextResponse.json({
          ok: true,
          negocios: rows,
          active_id: rows[0].id,
          single_business: true,
        });
      }
    }

    const session = await getUserSession();
    const isSuperAdmin = await getSuperAdminSession();
    const cookieStore = await cookies();
    const activeRestId = cookieStore.get("active_restaurant_id")?.value;

    // 3. Super Admin: puede auditar todos los negocios
    if (isSuperAdmin) {
      const { rows: allNegocios } = await pool.query(
        "SELECT id, nombre, slug, numero_mesas, created_at FROM negocios ORDER BY nombre ASC"
      );
      return NextResponse.json({
        ok: true,
        negocios: allNegocios,
        active_id: activeRestId || (allNegocios[0]?.id ?? null),
        is_superadmin: true,
      });
    }

    // 4. Usuario dueño de restaurante autenticado: AISLAMIENTO ESTRICTO
    // Solo puede ver el negocio o sucursales vinculadas a su propio userId
    if (session?.userId) {
      const { rows: userNegocios } = await pool.query(
        `SELECT n.id, n.nombre, n.slug, n.numero_mesas, n.created_at 
         FROM negocios n
         WHERE n.id::text IN (SELECT id FROM "Restaurant" WHERE "userId" = $1)
            OR n.slug IN (SELECT slug FROM "Restaurant" WHERE "userId" = $1)
         ORDER BY n.nombre ASC`,
        [session.userId]
      );

      if (userNegocios.length > 0) {
        return NextResponse.json({
          ok: true,
          negocios: userNegocios,
          active_id:
            userNegocios.find((n) => n.id === activeRestId)?.id ||
            userNegocios[0].id,
          single_business: userNegocios.length === 1,
        });
      }
    }

    // 5. Si existe cookie de restaurante activo
    if (activeRestId) {
      const { rows: cookieNegocios } = await pool.query(
        "SELECT id, nombre, slug, numero_mesas, created_at FROM negocios WHERE id = $1 LIMIT 1",
        [activeRestId]
      );
      if (cookieNegocios.length > 0) {
        return NextResponse.json({
          ok: true,
          negocios: cookieNegocios,
          active_id: cookieNegocios[0].id,
          single_business: true,
        });
      }
    }

    // 6. Sin sesión ni slug: retornar el primer negocio como demo o vacío, pero nunca exponer la lista completa de competidores
    const { rows: fallbackNegocio } = await pool.query(
      "SELECT id, nombre, slug, numero_mesas, created_at FROM negocios ORDER BY created_at ASC LIMIT 1"
    );

    return NextResponse.json({
      ok: true,
      negocios: fallbackNegocio,
      active_id: fallbackNegocio[0]?.id ?? null,
      single_business: true,
    });
  } catch (err: any) {
    console.error("[GET /api/negocios] Error:", err);
    return NextResponse.json(
      { ok: false, error: err.message || "Error al obtener negocios" },
      { status: 500 }
    );
  }
}
