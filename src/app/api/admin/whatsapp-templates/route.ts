import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserSession, getSuperAdminSession } from "@/lib/auth";
import { getOrSeedRestaurantTemplates, DEFAULT_TEMPLATES } from "@/lib/whatsapp-templates";

async function authorizeRestaurant(restaurantId: string): Promise<boolean> {
  const isSuperAdmin = await getSuperAdminSession();
  if (isSuperAdmin) return true;

  const userSession = await getUserSession();
  if (!userSession) return false;

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { userId: true },
  });

  return Boolean(restaurant && restaurant.userId === (userSession as any).userId);
}

// GET: Listar todas las plantillas del restaurante
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const restaurantId = searchParams.get("restaurantId");

    if (!restaurantId) {
      return NextResponse.json({ error: "Parámetro restaurantId requerido" }, { status: 400 });
    }

    const isAuthorized = await authorizeRestaurant(restaurantId);
    if (!isAuthorized) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const templates = await getOrSeedRestaurantTemplates(restaurantId);
    return NextResponse.json({ success: true, templates });
  } catch (error: any) {
    console.error("[API WhatsApp Templates GET Error]:", error);
    return NextResponse.json({ error: "Error al cargar plantillas", details: error.message }, { status: 500 });
  }
}

// POST: Crear o editar una plantilla
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { restaurantId, id, key, title, trigger, content, isActive, order } = body;

    if (!restaurantId || !title || !content) {
      return NextResponse.json({ error: "Datos incompletos (restaurantId, title, content requeridos)" }, { status: 400 });
    }

    const isAuthorized = await authorizeRestaurant(restaurantId);
    if (!isAuthorized) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    if (id) {
      // Actualizar plantilla existente
      const updated = await prisma.whatsAppTemplate.update({
        where: { id },
        data: {
          title: title.trim(),
          trigger: trigger !== undefined ? trigger.trim() : undefined,
          content: content.trim(),
          isActive: typeof isActive === "boolean" ? isActive : true,
          order: typeof order === "number" ? order : undefined,
        },
      });
      return NextResponse.json({ success: true, template: updated, message: "Plantilla actualizada correctamente" });
    } else {
      // Crear nueva plantilla
      const newKey = key || `custom_${Date.now()}`;
      const created = await prisma.whatsAppTemplate.create({
        data: {
          restaurantId,
          key: newKey,
          title: title.trim(),
          trigger: trigger ? trigger.trim() : null,
          content: content.trim(),
          order: typeof order === "number" ? order : 10,
          isActive: true,
        },
      });
      return NextResponse.json({ success: true, template: created, message: "Plantilla creada correctamente" });
    }
  } catch (error: any) {
    console.error("[API WhatsApp Templates POST Error]:", error);
    return NextResponse.json({ error: "Error al guardar plantilla", details: error.message }, { status: 500 });
  }
}

// DELETE: Eliminar una plantilla
export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const { restaurantId, templateId } = body;

    if (!restaurantId || !templateId) {
      return NextResponse.json({ error: "Parámetros restaurantId y templateId requeridos" }, { status: 400 });
    }

    const isAuthorized = await authorizeRestaurant(restaurantId);
    if (!isAuthorized) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    await prisma.whatsAppTemplate.delete({
      where: { id: templateId },
    });

    return NextResponse.json({ success: true, message: "Plantilla eliminada correctamente" });
  } catch (error: any) {
    console.error("[API WhatsApp Templates DELETE Error]:", error);
    return NextResponse.json({ error: "Error al eliminar plantilla", details: error.message }, { status: 500 });
  }
}

// PUT: Restaurar plantillas predeterminadas del sistema
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { restaurantId } = body;

    if (!restaurantId) {
      return NextResponse.json({ error: "Parámetro restaurantId requerido" }, { status: 400 });
    }

    const isAuthorized = await authorizeRestaurant(restaurantId);
    if (!isAuthorized) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    // Borrar actuales y recrear por defecto
    await prisma.whatsAppTemplate.deleteMany({
      where: { restaurantId },
    });

    const dataToCreate = DEFAULT_TEMPLATES.map((tmpl) => ({
      restaurantId,
      key: tmpl.key,
      title: tmpl.title,
      trigger: tmpl.trigger,
      content: tmpl.content,
      order: tmpl.order,
      isActive: true,
    }));

    await prisma.whatsAppTemplate.createMany({
      data: dataToCreate,
    });

    const restored = await prisma.whatsAppTemplate.findMany({
      where: { restaurantId },
      orderBy: { order: "asc" },
    });

    return NextResponse.json({ success: true, templates: restored, message: "Plantillas restauradas con éxito" });
  } catch (error: any) {
    console.error("[API WhatsApp Templates Reset Error]:", error);
    return NextResponse.json({ error: "Error al restaurar plantillas", details: error.message }, { status: 500 });
  }
}
