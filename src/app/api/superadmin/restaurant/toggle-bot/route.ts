import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSuperAdminSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PATCH(req: NextRequest) {
  try {
    // 1. Verificación de Seguridad de Super Admin (Opcional según entorno, pero recomendada)
    const isSuperAdmin = await getSuperAdminSession();
    
    // 2. Extracción y validación del Payload
    const body = await req.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Cuerpo de solicitud inválido o ausente." },
        { status: 400 }
      );
    }

    const { restaurantId, enabled } = body;

    if (!restaurantId || typeof restaurantId !== "string") {
      return NextResponse.json(
        { error: "El campo 'restaurantId' es requerido y debe ser un string válido." },
        { status: 400 }
      );
    }

    if (typeof enabled !== "boolean") {
      return NextResponse.json(
        { error: "El campo 'enabled' es requerido y debe ser un valor booleano (true/false)." },
        { status: 400 }
      );
    }

    // 3. Comprobar existencia del restaurante
    const existingRestaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { id: true, name: true, slug: true, whatsappBotEnabled: true },
    });

    if (!existingRestaurant) {
      return NextResponse.json(
        { error: `No se encontró ningún restaurante con ID: ${restaurantId}` },
        { status: 404 }
      );
    }

    // 4. Actualización directa y atómica en PostgreSQL
    const updatedRestaurant = await prisma.restaurant.update({
      where: { id: restaurantId },
      data: { whatsappBotEnabled: enabled },
      select: {
        id: true,
        name: true,
        slug: true,
        whatsappBotEnabled: true,
        updatedAt: true,
      },
    });

    // 5. Telemetría y Registro de Auditoría en Servidor
    const auditTime = new Date().toISOString();
    console.log(
      `[SUPERADMIN AUDIT] [${auditTime}] Bot WhatsApp ${
        enabled ? "ACTIVADO (ON)" : "DESACTIVADO (OFF)"
      } | Negocio: "${updatedRestaurant.name}" (Slug: ${updatedRestaurant.slug}) | ID: ${restaurantId} | SuperAdmin: ${isSuperAdmin ? "Sí" : "Admin Sesión"}`
    );

    // 6. Revalidación de caché en rutas clave
    revalidatePath("/super-admin");
    revalidatePath("/admin");
    revalidatePath(`/${updatedRestaurant.slug}`);

    return NextResponse.json(
      {
        success: true,
        restaurantId: updatedRestaurant.id,
        restaurantName: updatedRestaurant.name,
        enabled: updatedRestaurant.whatsappBotEnabled,
        updatedAt: updatedRestaurant.updatedAt,
        message: `El bot de WhatsApp para '${updatedRestaurant.name}' ha sido ${
          updatedRestaurant.whatsappBotEnabled ? "activado" : "desactivado"
        } exitosamente.`,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("[API ERROR] Error crítico en PATCH /api/superadmin/restaurant/toggle-bot:", error);
    return NextResponse.json(
      {
        error: "Error interno del servidor al actualizar el estado del bot de WhatsApp.",
        details: process.env.NODE_ENV === "development" ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}
