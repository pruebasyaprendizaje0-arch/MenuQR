import { prisma } from "./prisma";

interface RestaurantWithAi {
  id: string;
  name: string;
  slug: string;
  address?: string | null;
  city?: string | null;
  schedule?: string | null;
  localSchedule?: string | null;
  aiProvider?: string | null;
  aiApiKey?: string | null;
  aiModel?: string | null;
  aiPromptContext?: string | null;
  aiFallbackEnabled?: boolean;
}

export async function queryWhatsAppAI(
  restaurant: RestaurantWithAi,
  customerMessage: string
): Promise<string | null> {
  const provider = (restaurant.aiProvider || "NONE").toUpperCase();
  const apiKey = restaurant.aiApiKey?.trim();

  // Si no hay proveedor o no hay clave, no ejecutar IA
  if (provider === "NONE" || !apiKey) {
    return null;
  }

  try {
    // 1. Obtener los platos activos del restaurante para darle contexto real a la IA
    const dishes = await prisma.dish.findMany({
      where: {
        category: { restaurantId: restaurant.id },
        isAvailable: true,
      },
      select: {
        name: true,
        description: true,
        price: true,
        category: { select: { name: true } },
      },
      take: 60,
    });

    const menuSummary = dishes
      .map(
        (d) =>
          `- ${d.name} (${d.category.name}): $${Number(d.price).toFixed(2)}${
            d.description ? ` - ${d.description}` : ""
          }`
      )
      .join("\n");

    const horario = restaurant.localSchedule || restaurant.schedule || "Lunes a Domingo de 09:00 a 22:00";
    const direccion = `${restaurant.address || "Local principal"}${
      restaurant.city ? `, ${restaurant.city}` : ""
    }`;
    const linkMenu = `https://menuqr.ubicame.cc/${restaurant.slug}`;

    const systemPrompt = `Eres el asistente virtual amable y servicial del restaurante "${restaurant.name}".
Tu misión es resolver dudas sobre el menú, ingredientes, horarios y el local de forma directa, cálida y breve (máximo 2 párrafos cortos).

INFORMACIÓN DEL RESTAURANTE:
- Nombre: ${restaurant.name}
- Horarios: ${horario}
- Dirección: ${direccion}
- Carta Digital y Pedidos Online: ${linkMenu}

PLATOS DISPONIBLES EN CARTA:
${menuSummary || "Consulta nuestra carta digital para ver las opciones disponibles."}

${
  restaurant.aiPromptContext
    ? `INSTRUCCIONES ESPECIALES DEL DUEÑO:\n${restaurant.aiPromptContext}`
    : ""
}

REGLAS DE RESPUESTA:
1. Responde siempre en español con tono amable y profesional.
2. Si preguntan por recomendaciones, sugiere 1 o 2 platos de la lista anterior y recuérdales que pueden ver fotos y pedir directamente en ${linkMenu}.
3. Si preguntan por algo que no vendemos, indícalo amablemente sin inventar platos.
4. Mantén las respuestas breves para WhatsApp (sin textos gigantescos).`;

    let replyText = "";

    // 2. Ejecutar según el proveedor configurado por el cliente
    if (provider === "GEMINI") {
      let model = restaurant.aiModel || "gemini-1.5-flash";
      if (model.includes("3.8")) model = "gemini-1.5-flash";

      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: "user", parts: [{ text: customerMessage }] }],
          generationConfig: { maxOutputTokens: 250, temperature: 0.7 },
        }),
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok) {
        console.warn(`[WhatsApp AI] Error en Gemini HTTP ${res.status}`);
        return null;
      }

      const data = await res.json();
      replyText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    } else if (provider === "GROQ") {
      const model = restaurant.aiModel || "llama-3.3-70b-versatile";
      const endpoint = "https://api.groq.com/openai/v1/chat/completions";

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: customerMessage },
          ],
          max_tokens: 250,
          temperature: 0.7,
        }),
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) return null;
      const data = await res.json();
      replyText = data?.choices?.[0]?.message?.content || "";
    } else if (provider === "DEEPSEEK") {
      const model = restaurant.aiModel || "deepseek-chat";
      const endpoint = "https://api.deepseek.com/chat/completions";

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: customerMessage },
          ],
          max_tokens: 250,
        }),
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok) return null;
      const data = await res.json();
      replyText = data?.choices?.[0]?.message?.content || "";
    } else {
      // Default: OPENAI
      const model = restaurant.aiModel || "gpt-4o-mini";
      const endpoint = "https://api.openai.com/v1/chat/completions";

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: customerMessage },
          ],
          max_tokens: 250,
          temperature: 0.7,
        }),
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok) return null;
      const data = await res.json();
      replyText = data?.choices?.[0]?.message?.content || "";
    }

    return replyText.trim() || null;
  } catch (err) {
    console.warn("[WhatsApp AI Query Error]:", err);
    return null;
  }
}
