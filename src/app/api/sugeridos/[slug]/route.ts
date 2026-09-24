import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSuggestedDishIdsAction } from "@/lib/suggested-dishes-actions";

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
