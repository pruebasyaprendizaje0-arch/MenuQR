import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
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
    const { slug } = await context.params;
    const body = await req.json();
    const { dishId } = body;

    if (!slug || !dishId) {
      return NextResponse.json({ success: false, error: "Datos incompletos" }, { status: 400 });
    }

    const restaurant = await prisma.restaurant.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!restaurant) {
      return NextResponse.json({ success: false, error: "Restaurante no encontrado" }, { status: 404 });
    }

    const result = await toggleSuggestedDishAction(restaurant.id, dishId);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error al actualizar plato sugerido:", error);
    return NextResponse.json({ success: false, error: "Error interno del servidor" }, { status: 500 });
  }
}
