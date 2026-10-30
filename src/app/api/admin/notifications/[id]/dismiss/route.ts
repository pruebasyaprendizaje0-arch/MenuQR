import { NextRequest, NextResponse } from "next/server";
import { resolveAdminAuth } from "@/lib/admin-auth";
import { dismissNotification } from "@/lib/notifications";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  const auth = await resolveAdminAuth(req);
  if (auth.success === false) {
    return auth.response;
  }

  try {
    const resolvedParams = await Promise.resolve(context.params);
    const notificationId = resolvedParams.id;

    if (!notificationId) {
      return NextResponse.json(
        { success: false, error: "ID de notificación requerido" },
        { status: 400 }
      );
    }

    const result = await dismissNotification(notificationId, auth.restaurantId);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Notificación descartada del panel",
    });
  } catch (error: any) {
    console.error("Error en PATCH /api/admin/notifications/[id]/dismiss:", error);
    return NextResponse.json(
      { success: false, error: "Error al descartar la notificación" },
      { status: 500 }
    );
  }
}
