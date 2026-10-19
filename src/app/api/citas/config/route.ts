import { NextRequest, NextResponse } from "next/server";
import { pool, ensureDbTables } from "@/lib/db-pool";

export const dynamic = "force-dynamic";

// GET /api/citas/config?negocio_id=...&slug=...
export async function GET(req: NextRequest) {
  try {
    await ensureDbTables();

    const { searchParams } = new URL(req.url);
    const negocioId = searchParams.get("negocio_id");
    const slug = searchParams.get("slug");

    let query = `SELECT id, name, slug, "logoUrl", "coverUrl", "customLabels" FROM "Restaurant" WHERE `;
    const params: any[] = [];

    if (negocioId) {
      params.push(negocioId);
      query += `id = $1 LIMIT 1`;
    } else if (slug) {
      params.push(slug.toLowerCase().trim());
      query += `slug = $1 LIMIT 1`;
    } else {
      return NextResponse.json({ ok: false, error: "Falta negocio_id o slug" }, { status: 400 });
    }

    const { rows } = await pool.query(query, params);
    if (rows.length === 0) {
      return NextResponse.json({ ok: false, error: "Negocio no encontrado" }, { status: 404 });
    }

    const rest = rows[0];
    let customMeta: any = {};
    if (rest.customLabels) {
      try {
        customMeta = JSON.parse(rest.customLabels);
      } catch {}
    }

    return NextResponse.json({
      ok: true,
      negocio_id: rest.id,
      slug: rest.slug,
      logoUrl: rest.logoUrl,
      coverUrl: rest.coverUrl,
      specialists: customMeta.specialists || [],
      morningSlots: customMeta.morningSlots || ["09:00", "09:45", "10:30", "11:15", "12:00"],
      afternoonSlots: customMeta.afternoonSlots || ["14:00", "14:45", "15:30", "16:15", "17:00", "17:45"],
      galleryImages: Array.isArray(customMeta.galleryImages)
        ? customMeta.galleryImages.filter((u: any) => typeof u === "string" && u.trim().length > 0).slice(0, 4)
        : [],
    });
  } catch (err: any) {
    console.error("[GET /api/citas/config] Error:", err);
    return NextResponse.json(
      { ok: false, error: err.message || "Error al obtener configuración de citas" },
      { status: 500 }
    );
  }
}

// POST /api/citas/config - Guardar especialistas y horarios configurados desde el Admin
export async function POST(req: NextRequest) {
  try {
    await ensureDbTables();

    const body = await req.json();
    const { negocio_id, specialists, morningSlots, afternoonSlots, galleryImages } = body;

    if (!negocio_id) {
      return NextResponse.json({ ok: false, error: "negocio_id es requerido" }, { status: 400 });
    }

    // Obtener restaurant actual
    const { rows } = await pool.query(
      `SELECT id, "customLabels" FROM "Restaurant" WHERE id = $1 LIMIT 1`,
      [negocio_id]
    );

    if (rows.length === 0) {
      return NextResponse.json({ ok: false, error: "Negocio no encontrado" }, { status: 404 });
    }

    let customMeta: any = {};
    if (rows[0].customLabels) {
      try {
        customMeta = JSON.parse(rows[0].customLabels);
      } catch {}
    }

    if (specialists !== undefined) {
      customMeta.specialists = specialists;
    }
    if (morningSlots !== undefined) {
      customMeta.morningSlots = morningSlots;
    }
    if (afternoonSlots !== undefined) {
      customMeta.afternoonSlots = afternoonSlots;
    }
    if (galleryImages !== undefined) {
      customMeta.galleryImages = Array.isArray(galleryImages)
        ? galleryImages.map((u: any) => (typeof u === "string" ? u.trim() : "")).filter(Boolean).slice(0, 4)
        : [];
    }

    const updatedLabelsJson = JSON.stringify(customMeta);

    await pool.query(
      `UPDATE "Restaurant" SET "customLabels" = $1, "updatedAt" = NOW() WHERE id = $2`,
      [updatedLabelsJson, negocio_id]
    );

    return NextResponse.json({
      ok: true,
      mensaje: "Configuración de agenda y especialistas guardada con éxito",
      specialists: customMeta.specialists,
      morningSlots: customMeta.morningSlots,
      afternoonSlots: customMeta.afternoonSlots,
      galleryImages: customMeta.galleryImages,
    });
  } catch (err: any) {
    console.error("[POST /api/citas/config] Error:", err);
    return NextResponse.json(
      { ok: false, error: err.message || "Error al guardar configuración de citas" },
      { status: 500 }
    );
  }
}
