import { NextRequest, NextResponse } from "next/server";
import { getUserSession, getSuperAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

export type AdminAuthResult =
  | { success: true; restaurantId: string; userId: string; isSuperAdmin: boolean }
  | { success: false; response: NextResponse };

/**
 * Resuelve la sesión y verifica la pertenencia del restaurante para endpoints /api/admin/*
 */
export async function resolveAdminAuth(req: NextRequest): Promise<AdminAuthResult> {
  const isSuperAdmin = await getSuperAdminSession();
  const userSession = await getUserSession();

  if (!isSuperAdmin && !userSession) {
    return {
      success: false,
      response: NextResponse.json(
        { success: false, error: "No autorizado. Inicie sesión para acceder." },
        { status: 401 }
      ),
    };
  }

  const cookieStore = await cookies();
  const queryRestaurantId = req.nextUrl.searchParams.get("restaurantId");
  const cookieRestaurantId = cookieStore.get("active_restaurant_id")?.value;
  const sessionRestaurantId = (userSession as any)?.restaurantId;

  const candidateId = queryRestaurantId || cookieRestaurantId || sessionRestaurantId;

  let restaurant = null;

  if (candidateId) {
    restaurant = await prisma.restaurant.findUnique({
      where: { id: candidateId },
      select: { id: true, userId: true },
    });
  }

  // Si no se encontró con el candidato, obtener el primer restaurante del usuario
  if (!restaurant && userSession?.userId) {
    restaurant = await prisma.restaurant.findFirst({
      where: { userId: userSession.userId },
      orderBy: { createdAt: "asc" },
      select: { id: true, userId: true },
    });
  }

  if (!restaurant) {
    return {
      success: false,
      response: NextResponse.json(
        { success: false, error: "No se encontró ningún restaurante asociado al usuario." },
        { status: 404 }
      ),
    };
  }

  // Verificación estricta de inquilino (Tenant Isolation): el restaurante debe pertenecer al usuario
  if (!isSuperAdmin && restaurant.userId !== userSession?.userId) {
    return {
      success: false,
      response: NextResponse.json(
        { success: false, error: "Acceso denegado: no tiene permisos sobre este restaurante." },
        { status: 403 }
      ),
    };
  }

  return {
    success: true,
    restaurantId: restaurant.id,
    userId: userSession?.userId || "superadmin",
    isSuperAdmin,
  };
}
