import { NextRequest, NextResponse } from "next/server";
import { pool, ensureDbTables } from "@/lib/db-pool";

export const dynamic = "force-dynamic";

// GET /api/camareros?negocio_id=...
export async function GET(req: NextRequest) {
  try {
    await ensureDbTables();

    const { searchParams } = new URL(req.url);
    const negocioId = searchParams.get("negocio_id");

    if (!negocioId) {
      return NextResponse.json(
        { ok: false, error: "negocio_id es obligatorio" },
        { status: 400 }
      );
    }

    const { rows: camareros } = await pool.query(
      `SELECT id, negocio_id, nombre, pin, activo, created_at 
       FROM camareros 
       WHERE negocio_id = $1 AND activo = true 
       ORDER BY created_at ASC`,
      [negocioId]
    );

    return NextResponse.json({ ok: true, camareros });
  } catch (err: any) {
    console.error("[GET /api/camareros] Error:", err);
    return NextResponse.json(
      { ok: false, error: err.message || "Error al obtener camareros" },
      { status: 500 }
    );
  }
}

// POST /api/camareros - Crear nuevo mesero
export async function POST(req: NextRequest) {
  try {
    await ensureDbTables();

    const body = await req.json();
    const { negocio_id, nombre, pin } = body;

    if (!negocio_id || !nombre?.trim()) {
      return NextResponse.json(
        { ok: false, error: "negocio_id y nombre son obligatorios" },
        { status: 400 }
      );
    }

    const { rows } = await pool.query(
      `INSERT INTO camareros (negocio_id, nombre, pin, activo)
       VALUES ($1, $2, $3, true)
       RETURNING id, negocio_id, nombre, pin, activo, created_at`,
      [negocio_id, nombre.trim(), pin?.trim() || null]
    );

    return NextResponse.json({
      ok: true,
      camarero: rows[0],
      message: "Mesero creado exitosamente",
    });
  } catch (err: any) {
    console.error("[POST /api/camareros] Error:", err);
    return NextResponse.json(
      { ok: false, error: err.message || "Error al crear camarero" },
      { status: 500 }
    );
  }
}
