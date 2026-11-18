import { NextRequest, NextResponse } from "next/server";
import { getSuperAdminSession } from "@/lib/auth";
import { restoreBusinessBackupZip, sanitizeErrorMessage, MAX_ZIP_FILE_SIZE } from "@/lib/business-backup";
import { revalidatePath } from "next/cache";

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
        { error: "Formulario de restauración no válido." },
        { status: 400 }
      );
    }

    const file = formData.get("file") as File | null;
    const confirmed = formData.get("confirmed") === "true";
    const mode = (formData.get("mode") as "UPDATE_EXISTING" | "CREATE_NEW") || "CREATE_NEW";
    const targetRestaurantId = (formData.get("targetRestaurantId") as string) || undefined;
    const newSlug = (formData.get("newSlug") as string) || undefined;
    const newOwnerEmail = (formData.get("newOwnerEmail") as string) || undefined;
    const confirmMergeConflicts = formData.get("confirmMergeConflicts") === "true";

    if (!confirmed) {
      return NextResponse.json(
        { error: "Debe confirmar explícitamente la restauración tras revisar la previsualización." },
        { status: 400 }
      );
    }

    if (!file || typeof file.arrayBuffer !== "function" || file.size === 0) {
      return NextResponse.json(
        { error: "Debe proveer un archivo ZIP válido." },
        { status: 400 }
      );
    }

    if (file.size > MAX_ZIP_FILE_SIZE) {
      return NextResponse.json(
        { error: `El archivo supera el tamaño máximo permitido (${MAX_ZIP_FILE_SIZE / (1024 * 1024)} MB).` },
        { status: 400 }
      );
    }

    if (mode === "UPDATE_EXISTING" && !targetRestaurantId) {
      return NextResponse.json(
        { error: "Debe seleccionar un negocio destino para actualizar." },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // 2. Ejecutar restauración con combinación sin borrados (idempotente)
    const result = await restoreBusinessBackupZip(buffer, {
      targetRestaurantId,
      mode,
      newSlug,
      newOwnerEmail,
      confirmMergeConflicts,
    });

    // 3. Auditoría en servidor
    console.log(
      `[SUPERADMIN BACKUP RESTORE] Negocio: "${result.restaurantName}" (Slug: ${result.restaurantSlug}) | Creado nuevo: ${result.createdNew} | Reintento: ${result.isRetry} | Lotes: ${result.batchesApplied.join(", ")} | Platos Creados/Actualizados: ${result.restoredCounts.dishesCreated}/${result.restoredCounts.dishesUpdated} | Fotos Escritas/Reusadas: ${result.restoredCounts.photosWritten}/${result.restoredCounts.photosReused}`
    );

    // 4. Revalidar rutas afectadas
    revalidatePath("/super-admin");
    revalidatePath("/admin");
    revalidatePath(`/${result.restaurantSlug}`);

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error: any) {
    console.error("[BACKUP RESTORE ERROR]", error);
    const sanitizedMsg = error?.message ? sanitizeErrorMessage(error.message) : "Error al ejecutar la restauración del negocio.";
    return NextResponse.json(
      {
        error: sanitizedMsg,
        stage: error?.stage || "DESCONOCIDA",
        confirmedBatches: error?.confirmedBatches || [],
        partialChangesPossible: Boolean(error?.partialChangesPossible),
        photosRetained: error?.photosRetained || 0,
      },
      { status: 500 }
    );
  }
}
