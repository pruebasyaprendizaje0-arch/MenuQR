import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserSession, getSuperAdminSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const session = await getUserSession();
    const superAdmin = await getSuperAdminSession();

    if (!session && !superAdmin) {
      return NextResponse.json(
        { success: false, error: "No autorizado. Inicia sesión en el panel." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { codigo_cupon, restaurantId } = body || {};

    const cleanCode = (codigo_cupon || "").toString().trim().toUpperCase();

    if (!cleanCode) {
      return NextResponse.json(
        { success: false, error: "El código de cupón es requerido." },
        { status: 400 }
      );
    }

    const whereClause: any = { codigoCupon: cleanCode };
    if (restaurantId) {
      whereClause.restaurantId = restaurantId;
    }

    const giro = await (prisma as any).ruletaGiro.findFirst({
      where: whereClause,
      include: {
        restaurant: {
          select: { id: true, name: true, slug: true },
        },
      },
    });

    if (!giro) {
      return NextResponse.json(
        { success: false, error: `El cupón "${cleanCode}" no existe o pertenece a otro restaurante.` },
        { status: 404 }
      );
    }

    if (giro.estado === "CANJEADO") {
      return NextResponse.json(
        {
          success: false,
          error: `Este cupón YA FUE CANJEADO el ${giro.fechaCanjeo ? new Date(giro.fechaCanjeo).toLocaleString("es-EC") : ""}.`,
          giro,
        },
        { status: 400 }
      );
    }

    const now = new Date();
    if (new Date(giro.fechaExpiracion) < now || giro.estado === "EXPIRADO") {
      await (prisma as any).ruletaGiro.update({
        where: { id: giro.id },
        data: { estado: "EXPIRADO" },
      });
      return NextResponse.json(
        {
          success: false,
          error: `Este cupón expiró el ${new Date(giro.fechaExpiracion).toLocaleString("es-EC")}.`,
          giro: { ...giro, estado: "EXPIRADO" },
        },
        { status: 400 }
      );
    }

    // Marcar como CANJEADO
    const updatedGiro = await (prisma as any).ruletaGiro.update({
      where: { id: giro.id },
      data: {
        estado: "CANJEADO",
        fechaCanjeo: now,
      },
    });

    return NextResponse.json({
      success: true,
      message: `¡Cupón ${cleanCode} canjeado con éxito!`,
      premio: {
        label: updatedGiro.premioLabel,
        tipo: updatedGiro.premioTipo,
        valor: updatedGiro.premioValor,
      },
      cliente: {
        nombre: updatedGiro.nombreCliente,
        telefono: updatedGiro.telefono,
      },
      giro: updatedGiro,
    });
  } catch (error: any) {
    console.error("[API Ruleta Validar Cupon Error]:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Error al validar el cupón." },
      { status: 500 }
    );
  }
}
