import { NextRequest, NextResponse } from "next/server";
import { resolveAdminAuth } from "@/lib/admin-auth";
import { getActiveNotificationsForRestaurant } from "@/lib/notifications";

export async function GET(req: NextRequest) {
  // 1. Resolver sesión y validar pertenencia del inquilino
  const auth = await resolveAdminAuth(req);
  if (auth.success === false) {
    return auth.response;
  }

  try {
    // 2. Cargar notificaciones activas ordenadas por prioridad
    const notifications = await getActiveNotificationsForRestaurant(auth.restaurantId);

    return NextResponse.json({
      success: true,
      restaurantId: auth.restaurantId,
      count: notifications.length,
      notifications,
    });
  } catch (error: any) {
    console.error("Error en GET /api/admin/notifications:", error);
    return NextResponse.json(
      { success: false, error: "Error al obtener las notificaciones del restaurante" },
      { status: 500 }
    );
  }
}
