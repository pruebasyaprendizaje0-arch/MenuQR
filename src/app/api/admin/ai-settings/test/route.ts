import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserSession, getSuperAdminSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    let { restaurantId, aiProvider, aiApiKey, aiModel, aiPromptContext } = body;

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
      select: { aiApiKey: true, name: true },
    });

    // Si la clave viene enmascarada o vacía, usar la guardada en la base de datos
    if (!aiApiKey || aiApiKey.includes("...") || aiApiKey.trim().length < 5) {
      aiApiKey = currentRestaurant?.aiApiKey || "";
    }

    if (!aiApiKey) {
      return NextResponse.json({ error: "No se ingresó ninguna clave API de OpenAI o Gemini." }, { status: 400 });
    }

    const restaurantName = currentRestaurant?.name || "Restaurante";
    const systemPrompt = `Eres un asistente virtual amable del restaurante "${restaurantName}". ${aiPromptContext || ""} Responde de forma concisa en 2 o 3 oraciones.`;
    const sampleQuery = "Hola, ¿qué tipo de comida ofrecen y cuáles son sus recomendaciones?";

    let aiReply = "";

    if (aiProvider === "GEMINI") {
      let model = aiModel || "gemini-1.5-flash";
      if (model === "gemini-1.5-pro") model = "gemini-1.5-pro-latest";
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${aiApiKey.trim()}`;

      const geminiRes = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `${systemPrompt}\n\nPregunta del Cliente: ${sampleQuery}`,
                },
              ],
            },
          ],
        }),
        signal: AbortSignal.timeout(10000),
      });

      const geminiData = await geminiRes.json().catch(() => ({}));

      if (!geminiRes.ok || geminiData.error) {
        return NextResponse.json(
          { error: geminiData.error?.message || `Error en Google Gemini (HTTP ${geminiRes.status})` },
          { status: 400 }
        );
      }

      aiReply =
        geminiData.candidates?.[0]?.content?.parts?.[0]?.text ||
        "¡Conexión con Google Gemini verificada con éxito!";
    } else if (aiProvider === "DEEPSEEK") {
      const model = aiModel || "deepseek-chat";
      const endpoint = "https://api.deepseek.com/chat/completions";

      const deepseekRes = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${aiApiKey.trim()}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: sampleQuery },
          ],
          max_tokens: 150,
        }),
        signal: AbortSignal.timeout(10000),
      });

      const deepseekData = await deepseekRes.json().catch(() => ({}));

      if (!deepseekRes.ok || deepseekData.error) {
        return NextResponse.json(
          { error: deepseekData.error?.message || `Error en DeepSeek (HTTP ${deepseekRes.status})` },
          { status: 400 }
        );
      }

      aiReply =
        deepseekData.choices?.[0]?.message?.content ||
        "¡Conexión con DeepSeek verificada con éxito!";
    } else {
      // Por defecto OpenAI
      const model = aiModel || "gpt-4o-mini";
      const endpoint = "https://api.openai.com/v1/chat/completions";

      const openAiRes = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${aiApiKey.trim()}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: sampleQuery },
          ],
          max_tokens: 150,
        }),
        signal: AbortSignal.timeout(10000),
      });

      const openAiData = await openAiRes.json().catch(() => ({}));

      if (!openAiRes.ok || openAiData.error) {
        return NextResponse.json(
          { error: openAiData.error?.message || `Error en OpenAI (HTTP ${openAiRes.status})` },
          { status: 400 }
        );
      }

      aiReply =
        openAiData.choices?.[0]?.message?.content ||
        "¡Conexión con OpenAI verificada con éxito!";
    }

    return NextResponse.json({
      success: true,
      provider: aiProvider,
      message: "¡Conexión exitosa! Tu clave API es totalmente válida y responde correctamente.",
      response: aiReply.trim(),
    });
  } catch (error: any) {
    console.error("[API Admin AI Settings Test Error]:", error);
    return NextResponse.json({ error: error.message || "Error al conectar con la API de IA" }, { status: 500 });
  }
}
