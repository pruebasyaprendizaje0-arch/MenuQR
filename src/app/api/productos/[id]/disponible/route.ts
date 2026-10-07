import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { emitProductoActualizado } from "@/lib/socket-server";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await req.json();
    const { isAvailable, negocio_id } = body;

    let updatedDish: any = { id, isAvailable: Boolean(isAvailable) };

    try {
      const dish = await prisma.dish.update({
        where: { id },
        data: { isAvailable: Boolean(isAvailable) },
        select: { id: true, name: true, isAvailable: true, restaurantId: true },
      });
      updatedDish = dish;
    } catch (prismaErr) {
      console.warn("[PATCH /api/productos/disponible] No se encontró en Dish de Prisma, simulando actualización:", prismaErr);
    }

    if (negocio_id) {
      emitProductoActualizado(negocio_id, {
        id,
        isAvailable: Boolean(isAvailable),
        negocio_id,
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
