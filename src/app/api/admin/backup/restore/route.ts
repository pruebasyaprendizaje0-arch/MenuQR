import { NextRequest, NextResponse } from "next/server";
import { getUserSession, getSuperAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { restoreBusinessBackupZip, sanitizeErrorMessage, MAX_ZIP_FILE_SIZE } from "@/lib/business-backup";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData().catch(() => null);
    if (!formData) {
      return NextResponse.json(
        { error: "Formulario de restauración no válido." },
        { status: 400 }
      );
    }

    const file = formData.get("file") as File | null;
    const confirmed = formData.get("confirmed") === "true";
    const restaurantId = (formData.get("restaurantId") as string) || null;
    const confirmMergeConflicts = formData.get("confirmMergeConflicts") === "true";

    if (!restaurantId || typeof restaurantId !== "string") {
      return NextResponse.json(
        { error: "El parámetro 'restaurantId' es requerido." },
        { status: 400 }
      );
    }

    // 1. Autorización: SuperAdmin o Propietario del negocio
    const isSuperAdmin = await getSuperAdminSession();
    let restaurantSlug = "";
    if (!isSuperAdmin) {
      const userSession = await getUserSession();
      if (!userSession) {
        return NextResponse.json({ error: "No autorizado. Inicie sesión para continuar." }, { status: 401 });
      }
      const restaurant = await prisma.restaurant.findUnique({
        where: { id: restaurantId },
        select: { userId: true, slug: true },
      });
      if (!restaurant || restaurant.userId !== (userSession as any).userId) {
        return NextResponse.json({ error: "Acceso denegado a este negocio." }, { status: 403 });
      }
      restaurantSlug = restaurant.slug;
    } else {
      const restaurant = await prisma.restaurant.findUnique({
        where: { id: restaurantId },
        select: { slug: true },
      });
      restaurantSlug = restaurant?.slug || "";
    }

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

    const bytes = await file.arrayBuffer();
    const zipBuffer = Buffer.from(bytes);

    // 2. Ejecutar restauración segura en modo UPDATE_EXISTING fijado a su propio restaurante
    const result = await restoreBusinessBackupZip(zipBuffer, {
      mode: "UPDATE_EXISTING",
      targetRestaurantId: restaurantId,
      confirmMergeConflicts,
    });

    // 3. Revalidar rutas
    revalidatePath("/admin");
    if (restaurantSlug) {
      revalidatePath(`/${restaurantSlug}`);
      revalidatePath(`/ctalo/${restaurantSlug}`);
      revalidatePath(`/reservas/${restaurantSlug}`);
      revalidatePath(`/citas/${restaurantSlug}`);
      revalidatePath(`/servicios/${restaurantSlug}`);
    }

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error: any) {
    console.error("[TENANT BACKUP RESTORE ERROR]", error);
    const sanitized = sanitizeErrorMessage(error);
    return NextResponse.json(
      { error: sanitized },
      { status: 400 }
    );
  }
}
