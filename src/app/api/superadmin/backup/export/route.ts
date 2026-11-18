import { NextRequest, NextResponse } from "next/server";
import { getSuperAdminSession } from "@/lib/auth";
import { generateBusinessBackupZip } from "@/lib/business-backup";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    // 1. Autorización estricta comprobada en servidor
    const isSuperAdmin = await getSuperAdminSession();
    if (!isSuperAdmin) {
      return NextResponse.json(
        { error: "Acceso no autorizado. Acción reservada exclusivamente para SuperAdmin." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const restaurantId = searchParams.get("restaurantId");

    if (!restaurantId || typeof restaurantId !== "string") {
      return NextResponse.json(
        { error: "El parámetro 'restaurantId' es requerido." },
        { status: 400 }
      );
    }

    // 2. Generar el paquete ZIP seguro
    const { zipBuffer, manifest, filename } = await generateBusinessBackupZip(restaurantId);

    // 3. Auditoría en servidor
    console.log(
      `[SUPERADMIN BACKUP EXPORT] Negocio: "${manifest.sourceRestaurant.name}" (Slug: ${manifest.sourceRestaurant.slug}) | Platos: ${manifest.counts.dishes} | Fotos: ${manifest.photos.included} | Tamaño ZIP: ${zipBuffer.length} bytes`
    );

    // 4. Retornar el binario con encabezados de descarga seguros y no-cache
    return new NextResponse(zipBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": zipBuffer.length.toString(),
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
        "Pragma": "no-cache",
        "X-Content-Type-Options": "nosniff",
        "X-Backup-Version": manifest.version,
        "X-Backup-Slug": manifest.sourceRestaurant.slug,
      },
    });
  } catch (error: any) {
    console.error("[BACKUP EXPORT ERROR]", error);
    return NextResponse.json(
      { error: error?.message || "Error al generar el respaldo del negocio." },
      { status: 500 }
    );
  }
}
