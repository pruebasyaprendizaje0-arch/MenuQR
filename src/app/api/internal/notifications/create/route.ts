import { NextRequest, NextResponse } from "next/server";
import { verifyInternalApiKey } from "@/lib/internal-auth";
import { createNotification, CreateNotificationInputSchema } from "@/lib/notifications";

export async function POST(req: NextRequest) {
  // 1. Verificación de seguridad en tiempo constante
  if (!verifyInternalApiKey(req)) {
    return NextResponse.json(
      { success: false, error: "No autorizado. Token de API interno inválido o ausente." },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();

    // 2. Validación estricta con Zod
    const parseResult = CreateNotificationInputSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Datos de notificación inválidos",
          details: parseResult.error.format(),
        },
        { status: 400 }
      );
    }

    // 3. Creación en base de datos
    const result = await createNotification(parseResult.data);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Notificación creada con éxito",
        notificationId: result.notificationId,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Error en POST /api/internal/notifications/create:", error);
    return NextResponse.json(
      { success: false, error: "Error interno del servidor al procesar la notificación" },
      { status: 500 }
    );
  }
}
