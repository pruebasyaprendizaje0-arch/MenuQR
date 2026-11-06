import { NextRequest, NextResponse } from "next/server";
import { pool, ensureDbTables } from "@/lib/db-pool";
import { getUserSession, getSuperAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

async function verifyCamarerosAccess(negocioId: string): Promise<{ authorized: boolean; isAdmin: boolean; error?: string }> {
  const isSuperAdmin = await getSuperAdminSession();
  if (isSuperAdmin) return { authorized: true, isAdmin: true };

  const session = await getUserSession();
  if (session?.userId) {
    if (session.restaurantId === negocioId) {
      return { authorized: true, isAdmin: true };
    }
    const restaurant = await prisma.restaurant.findFirst({
      where: { id: negocioId, userId: session.userId },
      select: { id: true },
    });
    if (restaurant) {
      return { authorized: true, isAdmin: true };
    }
  }

  // Verificar si existe cookie de negocio activo para terminales autorizadas de salón/meseros
  const cookieStore = await cookies();
  const activeRestId = cookieStore.get("active_restaurant_id")?.value;
  if (activeRestId && activeRestId === negocioId) {
    return { authorized: true, isAdmin: false };
  }

  return { authorized: false, isAdmin: false, error: "No autorizado. Se requiere sesión activa o pertenencia al negocio." };
}

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

    const access = await verifyCamarerosAccess(negocioId);
    if (!access.authorized) {
      return NextResponse.json(
        { ok: false, error: access.error || "No autorizado para acceder a este negocio" },
        { status: 401 }
      );
    }

    // EXCLUIR terminantemente el campo `pin` de los campos devueltos para evitar fuga de credenciales
    const { rows: camareros } = await pool.query(
      `SELECT id, negocio_id, nombre, activo, created_at 
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

// POST /api/camareros - Crear nuevo mesero (Solo administradores)
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

    const access = await verifyCamarerosAccess(negocio_id);
    if (!access.authorized || !access.isAdmin) {
      return NextResponse.json(
        { ok: false, error: "Acceso denegado: solo el administrador del negocio puede crear meseros." },
        { status: 403 }
      );
    }

    const { rows } = await pool.query(
      `INSERT INTO camareros (negocio_id, nombre, pin, activo)
       VALUES ($1, $2, $3, true)
       RETURNING id, negocio_id, nombre, activo, created_at`,
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
