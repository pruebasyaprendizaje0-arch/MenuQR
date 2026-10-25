"use server";

import { prisma } from "@/lib/db";
import { getUserSession, getSuperAdminSession } from "@/lib/auth";
import { validateExternalImageUrl } from "@/lib/actions";
import { revalidatePath } from "next/cache";
import { CampaignType, CampaignDiscountType, BusinessCampaignData } from "./campaign-types";

async function verifyRestaurantOwnership(restaurantId: string): Promise<{ authorized: boolean; error?: string }> {
  const isSuperAdmin = await getSuperAdminSession();
  if (isSuperAdmin) {
    return { authorized: true };
  }

  const session = await getUserSession();
  if (!session || !session.userId) {
    return { authorized: false, error: "No autenticado. Inicie sesión." };
  }

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { id: true, userId: true },
  });

  if (!restaurant) {
    return { authorized: false, error: "Negocio no encontrado." };
  }

  if (restaurant.userId !== session.userId) {
    return { authorized: false, error: "No tiene permisos para modificar este negocio." };
  }

  return { authorized: true };
}

/**
 * Obtener campañas del negocio (Público o Admin)
 */
export async function getRestaurantCampaignsAction(
  restaurantId: string,
  onlyActive: boolean = false
): Promise<{ success: boolean; campaigns: BusinessCampaignData[]; error?: string }> {
  try {
    const now = new Date();
    const whereClause: any = { restaurantId };

    if (onlyActive) {
      whereClause.isActive = true;
      whereClause.OR = [
        { endDate: null },
        { endDate: { gte: now } },
      ];
    }

    const campaigns = await prisma.businessCampaign.findMany({
      where: whereClause,
      include: {
        dishes: {
          include: {
            dish: {
              select: {
                id: true,
                name: true,
                price: true,
                imageUrl: true,
                isAvailable: true,
                category: {
                  select: { name: true },
                },
              },
            },
          },
        },
      },
      orderBy: [{ order: "asc" }, { createdAt: "desc" }],
    });

    const serialized: BusinessCampaignData[] = campaigns.map((c) => ({
      ...c,
      startDate: c.startDate ? c.startDate.toISOString() : null,
      endDate: c.endDate ? c.endDate.toISOString() : null,
      eventDate: c.eventDate ? c.eventDate.toISOString() : null,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
      dishes: (c.dishes || []).map((cd) => ({
        id: cd.id,
        campaignId: cd.campaignId,
        dishId: cd.dishId,
        promoPrice: cd.promoPrice,
        promoLabel: cd.promoLabel,
        dish: cd.dish,
      })),
    }));

    return { success: true, campaigns: serialized };
  } catch (err: any) {
    console.error("[getRestaurantCampaignsAction Error]", err);
    return { success: false, campaigns: [], error: err.message || "Error al obtener campañas." };
  }
}

/**
 * Crear o editar una Campaña/Evento/Promo Semanal
 */
export async function saveCampaignAction(formData: FormData): Promise<{
  success: boolean;
  campaignId?: string;
  error?: string;
}> {
  try {
    const id = (formData.get("id") as string)?.trim() || null;
    const restaurantId = (formData.get("restaurantId") as string)?.trim();

    if (!restaurantId) {
      return { success: false, error: "Identificador de negocio faltante." };
    }

    const auth = await verifyRestaurantOwnership(restaurantId);
    if (!auth.authorized) {
      return { success: false, error: auth.error };
    }

    const title = (formData.get("title") as string)?.trim();
    if (!title) {
      return { success: false, error: "El título de la campaña es requerido." };
    }

    const type = ((formData.get("type") as string) || "PROMO") as CampaignType;
    const badgeText = (formData.get("badgeText") as string)?.trim() || (type === "EVENT" ? "Evento Especial" : "Promo Semanal");
    const description = (formData.get("description") as string)?.trim() || null;
    const startDateRaw = formData.get("startDate") as string;
    const endDateRaw = formData.get("endDate") as string;
    const eventDateRaw = formData.get("eventDate") as string;
    const startTime = (formData.get("startTime") as string)?.trim() || null;
    const endTime = (formData.get("endTime") as string)?.trim() || null;
    const daysOfWeek = (formData.get("daysOfWeek") as string)?.trim() || null;
    const discountType = ((formData.get("discountType") as string) || "PERCENTAGE") as CampaignDiscountType;
    const discountValue = parseFloat(formData.get("discountValue") as string) || 0;
    const ctaType = (formData.get("ctaType") as string) || "WHATSAPP";
    const ctaText = (formData.get("ctaText") as string)?.trim() || "Aprovechar por WhatsApp";
    const whatsappMessage = (formData.get("whatsappMessage") as string)?.trim() || null;
    const externalUrl = (formData.get("externalUrl") as string)?.trim() || null;
    const isActive = formData.get("isActive") === "true";
    const showInProfile = formData.get("showInProfile") !== "false";
    const showInCatalog = formData.get("showInCatalog") !== "false";

    // Manejo de imagen por URL (HTTPS o /uploads/...)
    let imageUrl: string | null = (formData.get("imageUrl") as string)?.trim() || null;
    if (imageUrl) {
      const val = await validateExternalImageUrl(imageUrl, { allowLegacyUploads: true });
      if (!val.isValid) {
        return { success: false, error: val.error || "URL de imagen no permitida." };
      }
      imageUrl = val.cleanUrl;
    }

    const startDate = startDateRaw ? new Date(startDateRaw) : null;
    const endDate = endDateRaw ? new Date(endDateRaw) : null;
    const eventDate = eventDateRaw ? new Date(eventDateRaw) : null;

    // Productos / Platos asociados JSON
    const dishesJson = formData.get("dishesJson") as string;
    let dishesData: Array<{ dishId: string; promoPrice?: number | null; promoLabel?: string | null }> = [];
    if (dishesJson) {
      try {
        dishesData = JSON.parse(dishesJson);
      } catch (e) {
        console.warn("[saveCampaignAction] Failed to parse dishesJson", e);
      }
    }

    let savedCampaignId = id;

    if (id) {
      // Actualizar existente
      await prisma.$transaction(async (tx) => {
        await tx.businessCampaign.update({
          where: { id },
          data: {
            title,
            type,
            badgeText,
            description,
            imageUrl,
            startDate,
            endDate,
            eventDate,
            startTime,
            endTime,
            daysOfWeek,
            discountType,
            discountValue,
            ctaType,
            ctaText,
            whatsappMessage,
            externalUrl,
            isActive,
            showInProfile,
            showInCatalog,
          },
        });

        // Reemplazar platos vinculados
        await tx.campaignDish.deleteMany({
          where: { campaignId: id },
        });

        if (dishesData.length > 0) {
          await tx.campaignDish.createMany({
            data: dishesData.map((d) => ({
              campaignId: id,
              dishId: d.dishId,
              promoPrice: typeof d.promoPrice === "number" ? d.promoPrice : null,
              promoLabel: d.promoLabel || null,
            })),
          });
        }
      });
    } else {
      // Crear nueva campaña
      const created = await prisma.businessCampaign.create({
        data: {
          restaurantId,
          title,
          type,
          badgeText,
          description,
          imageUrl,
          startDate,
          endDate,
          eventDate,
          startTime,
          endTime,
          daysOfWeek,
          discountType,
          discountValue,
          ctaType,
          ctaText,
          whatsappMessage,
          externalUrl,
          isActive,
          showInProfile,
          showInCatalog,
          dishes: {
            create: dishesData.map((d) => ({
              dishId: d.dishId,
              promoPrice: typeof d.promoPrice === "number" ? d.promoPrice : null,
              promoLabel: d.promoLabel || null,
            })),
          },
        },
      });
      savedCampaignId = created.id;
    }

    const rest = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { slug: true },
    });

    if (rest?.slug) {
      revalidatePath(`/${rest.slug}`);
      revalidatePath(`/admin`);
    }

    return { success: true, campaignId: savedCampaignId || undefined };
  } catch (err: any) {
    console.error("[saveCampaignAction Error]", err);
    return { success: false, error: err.message || "Error al guardar la campaña." };
  }
}

/**
 * Eliminar una campaña
 */
export async function deleteCampaignAction(
  id: string,
  restaurantId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const auth = await verifyRestaurantOwnership(restaurantId);
    if (!auth.authorized) {
      return { success: false, error: auth.error };
    }

    await prisma.businessCampaign.delete({
      where: { id },
    });

    const rest = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { slug: true },
    });
    if (rest?.slug) {
      revalidatePath(`/${rest.slug}`);
    }

    return { success: true };
  } catch (err: any) {
    console.error("[deleteCampaignAction Error]", err);
    return { success: false, error: err.message || "Error al eliminar la campaña." };
  }
}

/**
 * Activar / Desactivar switch rápido
 */
export async function toggleCampaignActiveAction(
  id: string,
  restaurantId: string,
  isActive: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const auth = await verifyRestaurantOwnership(restaurantId);
    if (!auth.authorized) {
      return { success: false, error: auth.error };
    }

    await prisma.businessCampaign.update({
      where: { id },
      data: { isActive },
    });

    const rest = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { slug: true },
    });
    if (rest?.slug) {
      revalidatePath(`/${rest.slug}`);
    }

    return { success: true };
  } catch (err: any) {
    console.error("[toggleCampaignActiveAction Error]", err);
    return { success: false, error: err.message || "Error al actualizar estado." };
  }
}
