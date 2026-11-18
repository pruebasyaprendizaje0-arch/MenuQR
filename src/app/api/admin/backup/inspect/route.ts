import { NextRequest, NextResponse } from "next/server";
import { getUserSession, getSuperAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { inspectBackupZip, MAX_ZIP_FILE_SIZE } from "@/lib/business-backup";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData().catch(() => null);
    if (!formData) {
      return NextResponse.json(
        { error: "Formulario de inspección no válido." },
        { status: 400 }
      );
    }

    const file = formData.get("file") as File | null;
    const restaurantId = (formData.get("restaurantId") as string) || null;

    if (!restaurantId || typeof restaurantId !== "string") {
      return NextResponse.json(
        { error: "El parámetro 'restaurantId' es requerido." },
        { status: 400 }
      );
    }

    // 1. Autorización: SuperAdmin o Propietario del negocio
    const isSuperAdmin = await getSuperAdminSession();
    if (!isSuperAdmin) {
      const userSession = await getUserSession();
      if (!userSession) {
        return NextResponse.json({ error: "No autorizado. Inicie sesión para continuar." }, { status: 401 });
      }
      const restaurant = await prisma.restaurant.findUnique({
        where: { id: restaurantId },
        select: { userId: true },
      });
      if (!restaurant || restaurant.userId !== (userSession as any).userId) {
        return NextResponse.json({ error: "Acceso denegado a este negocio." }, { status: 403 });
      }
    }

    if (!file || typeof file.arrayBuffer !== "function" || file.size === 0) {
      return NextResponse.json(
        { error: "Debe seleccionar un archivo ZIP válido para inspeccionar." },
        { status: 400 }
      );
    }

    if (file.size > MAX_ZIP_FILE_SIZE) {
      return NextResponse.json(
        { error: `El archivo excede el tamaño máximo permitido (${MAX_ZIP_FILE_SIZE / (1024 * 1024)} MB).` },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // 2. Inspección segura vinculada al propio restaurante del tenant
    const inspection = await inspectBackupZip(buffer, restaurantId);

    return NextResponse.json({
      success: true,
      inspection,
    });
  } catch (error: any) {
    console.error("[TENANT BACKUP INSPECT ERROR]", error);
    return NextResponse.json(
      { error: error?.message || "Error al inspeccionar el archivo de respaldo." },
      { status: 400 }
    );
  }
}
