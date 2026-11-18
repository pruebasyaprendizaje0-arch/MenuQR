import { NextRequest, NextResponse } from "next/server";
import { getSuperAdminSession } from "@/lib/auth";
import { inspectBackupZip, MAX_ZIP_FILE_SIZE } from "@/lib/business-backup";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    // 1. Autorización estricta comprobada en servidor
    const isSuperAdmin = await getSuperAdminSession();
    if (!isSuperAdmin) {
      return NextResponse.json(
        { error: "Acceso no autorizado. Acción reservada exclusivamente para SuperAdmin." },
        { status: 403 }
      );
    }

    const formData = await req.formData().catch(() => null);
    if (!formData) {
      return NextResponse.json(
        { error: "Formulario de inspección no válido." },
        { status: 400 }
      );
    }

    const file = formData.get("file") as File | null;
    const targetRestaurantId = (formData.get("targetRestaurantId") as string) || null;

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

    // 2. Inspección segura (Dry-run preview)
    const inspection = await inspectBackupZip(buffer, targetRestaurantId);

    return NextResponse.json({
      success: true,
      inspection,
    });
  } catch (error: any) {
    console.error("[BACKUP INSPECT ERROR]", error);
    return NextResponse.json(
      { error: error?.message || "Error al inspeccionar el archivo de respaldo." },
      { status: 400 }
    );
  }
}
