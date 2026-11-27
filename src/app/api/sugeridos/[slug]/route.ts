import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSuperAdminSession, getUserSession } from "@/lib/auth";
import { getSuggestedDishIdsAction, toggleSuggestedDishAction } from "@/lib/suggested-dishes-actions";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    if (!slug) {
      return NextResponse.json({ success: false, error: "Slug no proporcionado" }, { status: 400 });
    }

    const restaurant = await prisma.restaurant.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!restaurant) {
      return NextResponse.json({ success: false, error: "Restaurante no encontrado" }, { status: 404 });
    }

    const suggestedDishIds = await getSuggestedDishIdsAction(restaurant.id);

    return NextResponse.json({
      success: true,
      suggestedDishIds,
    });
  } catch (error) {
    console.error("Error al consultar platos sugeridos:", error);
    return NextResponse.json(
      { success: false, error: "Error interno del servidor", suggestedDishIds: [] },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const isSuperAdmin = await getSuperAdminSession();
    const session = isSuperAdmin ? null : await getUserSession();

    if (!isSuperAdmin && (!session || !session.userId)) {
      return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
    }

    const { slug } = await context.params;
    const body = await req.json();
    const dishId = typeof body?.dishId === "string" ? body.dishId : "";

    if (!slug || !dishId) {
      return NextResponse.json({ success: false, error: "Datos incompletos" }, { status: 400 });
    }

    const restaurant = await prisma.restaurant.findUnique({
      where: { slug },
      select: { id: true, userId: true },
    });

    if (!restaurant) {
      return NextResponse.json({ success: false, error: "Restaurante no encontrado" }, { status: 404 });
    }

    if (!isSuperAdmin && restaurant.userId !== session!.userId) {
      return NextResponse.json({ success: false, error: "No tiene permisos para modificar este restaurante" }, { status: 403 });
    }

    const result = await toggleSuggestedDishAction(restaurant.id, dishId);
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || "No se pudo actualizar el plato sugerido" },
        { status: result.status || 400 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error al actualizar plato sugerido:", error);
    return NextResponse.json({ success: false, error: "Error interno del servidor" }, { status: 500 });
  }
}
