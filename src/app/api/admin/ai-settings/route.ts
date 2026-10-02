import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserSession, getSuperAdminSession } from "@/lib/auth";

function maskApiKey(key?: string | null): string {
  if (!key || typeof key !== "string" || key.trim().length < 6) return "";
  const trimmed = key.trim();
  const start = trimmed.substring(0, 4);
  const end = trimmed.substring(trimmed.length - 4);
  return `${start}...${end}`;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const restaurantId = searchParams.get("restaurantId");

    if (!restaurantId) {
      return NextResponse.json({ error: "Parámetro restaurantId requerido" }, { status: 400 });
    }

    const isSuperAdmin = await getSuperAdminSession();
    if (!isSuperAdmin) {
      const userSession = await getUserSession();
      if (!userSession) {
        return NextResponse.json({ error: "No autorizado" }, { status: 401 });
      }
      const restaurant = await prisma.restaurant.findUnique({
        where: { id: restaurantId },
        select: { userId: true },
      });
      if (!restaurant || restaurant.userId !== (userSession as any).userId) {
        return NextResponse.json({ error: "Acceso denegado a este restaurante" }, { status: 403 });
      }
    }

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: {
        aiProvider: true,
        aiApiKey: true,
        aiModel: true,
        aiPromptContext: true,
        aiFallbackEnabled: true,
      },
    });

    if (!restaurant) {
      return NextResponse.json({ error: "Restaurante no encontrado" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      aiProvider: restaurant.aiProvider || "NONE",
      aiModel: restaurant.aiModel || "gpt-4o-mini",
      aiPromptContext: restaurant.aiPromptContext || "",
      aiFallbackEnabled: Boolean(restaurant.aiFallbackEnabled),
      hasApiKey: Boolean(restaurant.aiApiKey && restaurant.aiApiKey.length > 5),
      maskedApiKey: maskApiKey(restaurant.aiApiKey),
    });
  } catch (error: any) {
    console.error("[API Admin AI Settings GET Error]:", error);
    return NextResponse.json({ error: "Error interno del servidor", details: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { restaurantId, aiProvider, aiApiKey, aiModel, aiPromptContext, aiFallbackEnabled } = body;

    if (!restaurantId) {
      return NextResponse.json({ error: "Parámetro restaurantId requerido" }, { status: 400 });
    }

    const isSuperAdmin = await getSuperAdminSession();
    if (!isSuperAdmin) {
      const userSession = await getUserSession();
      if (!userSession) {
        return NextResponse.json({ error: "No autorizado" }, { status: 401 });
      }
      const restaurant = await prisma.restaurant.findUnique({
        where: { id: restaurantId },
        select: { userId: true },
      });
      if (!restaurant || restaurant.userId !== (userSession as any).userId) {
        return NextResponse.json({ error: "Acceso denegado a este restaurante" }, { status: 403 });
      }
    }

    const currentRestaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { aiApiKey: true },
    });

    if (!currentRestaurant) {
      return NextResponse.json({ error: "Restaurante no encontrado" }, { status: 404 });
    }

    const updateData: any = {
      aiProvider: aiProvider || "NONE",
      aiModel: aiModel || (aiProvider === "GEMINI" ? "gemini-1.5-flash" : "gpt-4o-mini"),
      aiPromptContext: aiPromptContext || null,
      aiFallbackEnabled: Boolean(aiFallbackEnabled),
    };

    // Actualizar la clave solo si se proporciona una nueva clave que no esté enmascarada
    if (aiApiKey && typeof aiApiKey === "string" && !aiApiKey.includes("...") && aiApiKey.trim().length > 5) {
      updateData.aiApiKey = aiApiKey.trim();
    }

    const updated = await prisma.restaurant.update({
      where: { id: restaurantId },
      data: updateData,
      select: {
        aiProvider: true,
        aiApiKey: true,
        aiModel: true,
        aiPromptContext: true,
        aiFallbackEnabled: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Configuración de Asistente IA guardada correctamente",
      aiProvider: updated.aiProvider,
      aiModel: updated.aiModel,
      aiPromptContext: updated.aiPromptContext || "",
      aiFallbackEnabled: updated.aiFallbackEnabled,
      hasApiKey: Boolean(updated.aiApiKey && updated.aiApiKey.length > 5),
      maskedApiKey: maskApiKey(updated.aiApiKey),
    });
  } catch (error: any) {
    console.error("[API Admin AI Settings POST Error]:", error);
    return NextResponse.json({ error: "Error interno del servidor", details: error.message }, { status: 500 });
  }
}
