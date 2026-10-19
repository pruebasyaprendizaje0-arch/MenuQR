import { NextRequest, NextResponse } from "next/server";
import { pool, ensureDbTables } from "@/lib/db-pool";

export const dynamic = "force-dynamic";

const DEFAULT_AMENITIES = [
  "📶 WiFi de Alta Velocidad",
  "🔥 Chimenea / Fogata a Leña",
  "🛁 Jacuzzi Privado",
  "🚗 Parqueadero Gratuito",
  "🐾 Pet Friendly",
  "☕ Desayuno Artesanal",
  "🌿 Senderos Ecológicos Privados",
  "💧 Agua Caliente a Presión",
];

const DEFAULT_EXTRAS = [
  { id: "ext-1", name: "Desayuno Campestre Tradicional", price: 6.5, perPerson: true },
  { id: "ext-2", name: "Cesta de Leña Seca para Fogata", price: 5.0, perPerson: false },
  { id: "ext-3", name: "Sesión Privada de Jacuzzi con Sales", price: 20.0, perPerson: false },
  { id: "ext-4", name: "Paseo a Caballo Guiado (1 hora)", price: 15.0, perPerson: true },
];

// GET /api/reservas/config?negocio_id=...&slug=...
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
        customMeta = typeof rest.customLabels === "string" ? JSON.parse(rest.customLabels) : rest.customLabels;
      } catch {}
    }

    const amenities = Array.isArray(customMeta.amenities) && customMeta.amenities.length > 0
      ? customMeta.amenities
      : DEFAULT_AMENITIES;

    const availableExtras = Array.isArray(customMeta.availableExtras) && customMeta.availableExtras.length > 0
      ? customMeta.availableExtras
      : DEFAULT_EXTRAS;

    return NextResponse.json({
      ok: true,
      negocio_id: rest.id,
      slug: rest.slug,
      logoUrl: rest.logoUrl,
      coverUrl: rest.coverUrl,
      amenities,
      availableExtras,
      checkInTime: customMeta.checkInTime || "14:00",
      checkOutTime: customMeta.checkOutTime || "12:00",
      showBedsBadge: customMeta.showBedsBadge !== undefined ? customMeta.showBedsBadge : true,
      showGuestsBadge: customMeta.showGuestsBadge !== undefined ? customMeta.showGuestsBadge : true,
      lodgingRules: customMeta.lodgingRules || "Horario de silencio a partir de las 23:00. No fumar dentro de las cabañas.",
      galleryImages: Array.isArray(customMeta.galleryImages)
        ? customMeta.galleryImages.filter((u: any) => typeof u === "string" && u.trim().length > 0).slice(0, 4)
        : [],
    });
  } catch (err: any) {
    console.error("[GET /api/reservas/config] Error:", err);
    return NextResponse.json(
      { ok: false, error: err.message || "Error al obtener configuración de hospedaje" },
      { status: 500 }
    );
  }
}

// POST /api/reservas/config - Guardar comodidades, extras y reglas de hospedaje
export async function POST(req: NextRequest) {
  try {
    await ensureDbTables();

    const body = await req.json();
    const { negocio_id, amenities, availableExtras, checkInTime, checkOutTime, lodgingRules, showBedsBadge, showGuestsBadge, galleryImages } = body;

    if (!negocio_id) {
      return NextResponse.json({ ok: false, error: "negocio_id es requerido" }, { status: 400 });
    }

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
        customMeta = typeof rows[0].customLabels === "string" ? JSON.parse(rows[0].customLabels) : rows[0].customLabels;
      } catch {}
    }

    if (amenities !== undefined) {
      customMeta.amenities = amenities;
    }
    if (availableExtras !== undefined) {
      customMeta.availableExtras = availableExtras;
    }
    if (checkInTime !== undefined) {
      customMeta.checkInTime = checkInTime;
    }
    if (checkOutTime !== undefined) {
      customMeta.checkOutTime = checkOutTime;
    }
    if (lodgingRules !== undefined) {
      customMeta.lodgingRules = lodgingRules;
    }
    if (showBedsBadge !== undefined) {
      customMeta.showBedsBadge = Boolean(showBedsBadge);
    }
    if (showGuestsBadge !== undefined) {
      customMeta.showGuestsBadge = Boolean(showGuestsBadge);
    }
    if (galleryImages !== undefined) {
      customMeta.galleryImages = Array.isArray(galleryImages)
        ? galleryImages.map((u: any) => (typeof u === "string" ? u.trim() : "")).filter(Boolean).slice(0, 4)
        : [];
    }

    // Asegurar vertical y businessSubType
    customMeta.vertical = "reservas";
    customMeta.businessSubType = "RESERVAS";

    const updatedLabelsJson = JSON.stringify(customMeta);

    await pool.query(
      `UPDATE "Restaurant" SET "customLabels" = $1 WHERE id = $2`,
      [updatedLabelsJson, negocio_id]
    );

    return NextResponse.json({
      ok: true,
      message: "Configuración de hospedaje guardada correctamente",
      amenities: customMeta.amenities,
      availableExtras: customMeta.availableExtras,
    });
  } catch (err: any) {
    console.error("[POST /api/reservas/config] Error:", err);
    return NextResponse.json(
      { ok: false, error: err.message || "Error al guardar configuración de hospedaje" },
      { status: 500 }
    );
  }
}
