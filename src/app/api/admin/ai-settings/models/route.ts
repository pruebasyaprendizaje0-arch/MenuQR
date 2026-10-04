import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserSession, getSuperAdminSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    let { restaurantId, aiProvider, aiApiKey } = body;

    if (!restaurantId || !aiProvider) {
      return NextResponse.json({ error: "Parámetros restaurantId y aiProvider requeridos" }, { status: 400 });
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

    if (!aiApiKey || aiApiKey.includes("...") || aiApiKey.trim().length < 5) {
      aiApiKey = currentRestaurant?.aiApiKey || "";
    }

    if (!aiApiKey) {
      return NextResponse.json({ error: "Ingresa tu clave API para consultar los modelos disponibles." }, { status: 400 });
    }

    const cleanKey = aiApiKey.trim();

    if (aiProvider === "GEMINI") {
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${cleanKey}`, {
          signal: AbortSignal.timeout(8000),
        });
        const data = await res.json();
        if (data.models && Array.isArray(data.models)) {
          const geminiModels = data.models
            .filter((m: any) => 
              m.supportedGenerationMethods?.includes("generateContent") &&
              !m.name.includes("embedding") &&
              !m.name.includes("aqa")
            )
            .map((m: any) => ({
              id: m.name.replace(/^models\//, ""),
              name: `${m.displayName || m.name.replace(/^models\//, "")} (${m.name.replace(/^models\//, "")})`,
            }))
            .sort((a: any, b: any) => a.id.localeCompare(b.id));

          return NextResponse.json({ success: true, models: geminiModels });
        } else if (data.error) {
          return NextResponse.json({ error: data.error.message || "Error al consultar Google Gemini" }, { status: 400 });
        }
      } catch (err: any) {
        return NextResponse.json({ error: "Timeout o error de conexión con Google Gemini: " + err.message }, { status: 500 });
      }
    } else if (aiProvider === "DEEPSEEK") {
      try {
        const res = await fetch("https://api.deepseek.com/models", {
          headers: { Authorization: `Bearer ${cleanKey}` },
          signal: AbortSignal.timeout(8000),
        });
        const data = await res.json();
        if (data.data && Array.isArray(data.data)) {
          const deepseekModels = data.data.map((m: any) => ({
            id: m.id,
            name: m.id === "deepseek-chat" ? "DeepSeek V3 (deepseek-chat)" : m.id === "deepseek-reasoner" ? "DeepSeek R1 (deepseek-reasoner)" : m.id,
          }));
          return NextResponse.json({ success: true, models: deepseekModels });
        }
      } catch (e) {
        // Fallback a modelos oficiales conocidos
      }
      return NextResponse.json({
        success: true,
        models: [
          { id: "deepseek-chat", name: "DeepSeek V3 (deepseek-chat - Recomendado)" },
          { id: "deepseek-reasoner", name: "DeepSeek R1 (deepseek-reasoner - Razonamiento)" },
        ],
      });
    } else if (aiProvider === "OPENAI") {
      try {
        const res = await fetch("https://api.openai.com/v1/models", {
          headers: { Authorization: `Bearer ${cleanKey}` },
          signal: AbortSignal.timeout(8000),
        });
        const data = await res.json();
        if (data.data && Array.isArray(data.data)) {
          const openaiModels = data.data
            .filter((m: any) => m.id.startsWith("gpt-") || m.id.startsWith("o1") || m.id.startsWith("o3"))
            .map((m: any) => ({ id: m.id, name: m.id }))
            .sort((a: any, b: any) => a.id.localeCompare(b.id));

          return NextResponse.json({ success: true, models: openaiModels });
        }
      } catch (e) {}
      return NextResponse.json({
        success: true,
        models: [
          { id: "gpt-4o-mini", name: "GPT-4o Mini (Recomendado)" },
          { id: "gpt-4o", name: "GPT-4o (Completo)" },
          { id: "o3-mini", name: "o3-mini (Razonamiento)" },
          { id: "gpt-4-turbo", name: "GPT-4 Turbo" },
        ],
      });
    }

    return NextResponse.json({ error: "Proveedor no soportado" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
