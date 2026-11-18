import { NextRequest, NextResponse } from "next/server";
import { getUserSession, getSuperAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateBusinessBackupZip } from "@/lib/business-backup";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const restaurantId = searchParams.get("restaurantId");

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

    // 2. Generar el paquete ZIP completo con landing, catálogo y fotos
    const { zipBuffer, manifest, filename } = await generateBusinessBackupZip(restaurantId);

    console.log(
      `[ADMIN BACKUP EXPORT] Negocio: "${manifest.sourceRestaurant.name}" (Slug: ${manifest.sourceRestaurant.slug}) | Platos: ${manifest.counts.dishes} | Fotos: ${manifest.photos.included} | Tamaño ZIP: ${zipBuffer.length} bytes`
    );

    // 3. Retornar el binario con encabezados seguros
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
    console.error("[TENANT BACKUP EXPORT ERROR]", error);
    return NextResponse.json(
      { error: error?.message || "Error al generar el respaldo del negocio." },
      { status: 500 }
    );
  }
}
