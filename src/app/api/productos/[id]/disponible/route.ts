import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { emitProductoActualizado } from "@/lib/socket-server";
import { getUserSession, getSuperAdminSession } from "@/lib/auth";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    // 1. Obtener producto existente para validar pertenencia de inquilino
    const existingDish = await prisma.dish.findUnique({
      where: { id },
      select: {
        id: true,
        restaurantId: true,
        restaurant: { select: { id: true, userId: true, slug: true } },
      },
    });

    if (!existingDish) {
      return NextResponse.json({ ok: false, error: "Producto no encontrado" }, { status: 404 });
    }

    // 2. Control de Acceso: SuperAdmin, Propietario del negocio o Terminal autorizada del local
    const isSuperAdmin = await getSuperAdminSession();
    const session = await getUserSession();
    const cookieStore = await cookies();
    const activeRestCookie = cookieStore.get("active_restaurant_id")?.value;

    const isOwner = Boolean(session?.userId && existingDish.restaurant.userId === session.userId);
    const hasActiveRestSession = session?.restaurantId === existingDish.restaurantId;
    const hasActiveDeviceCookie = activeRestCookie === existingDish.restaurantId;

    if (!isSuperAdmin && !isOwner && !hasActiveRestSession && !hasActiveDeviceCookie) {
      return NextResponse.json(
        { ok: false, error: "No autorizado para modificar la disponibilidad de productos de este restaurante." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { isAvailable, negocio_id, stock } = body;

    const dataToUpdate: any = { isAvailable: Boolean(isAvailable) };
    if (typeof stock === "number") {
      dataToUpdate.stock = Math.max(0, Math.floor(stock));
      dataToUpdate.trackStock = true;
      if (dataToUpdate.stock <= 0) {
        dataToUpdate.isAvailable = false;
      }
    }

    const updatedDish = await prisma.dish.update({
      where: { id },
      data: dataToUpdate,
      select: { id: true, name: true, isAvailable: true, stock: true, minStock: true, trackStock: true, restaurantId: true },
    });

    const targetNegocioId = negocio_id || existingDish.restaurantId;
    if (targetNegocioId) {
      emitProductoActualizado(targetNegocioId, {
        id,
        isAvailable: updatedDish.isAvailable,
        stock: updatedDish.stock,
        minStock: updatedDish.minStock,
        trackStock: updatedDish.trackStock,
        negocio_id: targetNegocioId,
      });
    }

    return NextResponse.json({
      ok: true,
      producto: updatedDish,
    });
  } catch (err: any) {
    console.error("[PATCH /api/productos/disponible] Error:", err);
    return NextResponse.json(
      { ok: false, error: err.message || "Error al actualizar disponibilidad" },
      { status: 500 }
    );
  }
}
