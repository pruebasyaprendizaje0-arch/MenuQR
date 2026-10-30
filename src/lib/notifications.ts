import { prisma } from "@/lib/prisma";
import { NotificationPriority, NotificationType, Prisma } from "@prisma/client";
import { z } from "zod";

// Esquema de validación para la creación de notificaciones (n8n o SuperAdmin)
export const CreateNotificationInputSchema = z.object({
  restaurantId: z.string().uuid("El restaurantId debe ser un UUID válido").optional().nullable(),
  restaurantSlug: z.string().min(1).optional().nullable(),
  broadcastAll: z.boolean().optional().default(false),
  type: z.enum([
    "WARNING_EXPIRING",
    "SUSPENDED",
    "METRIC_SUMMARY",
    "MAINTENANCE",
    "PROMO",
    "INFO",
  ] as const),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"] as const).optional().default("NORMAL"),
  title: z.string().min(2, "El título debe tener al menos 2 caracteres").max(150),
  message: z.string().min(2, "El mensaje debe tener al menos 2 caracteres").max(4000),
  actionUrl: z.string().optional().nullable(),
  actionLabel: z.string().max(60).optional().nullable(),
  metadata: z.record(z.string(), z.any()).optional().nullable(),
  expiresAt: z.union([z.string(), z.date()]).optional().nullable(),
  expiresInHours: z.number().positive().optional().nullable(),
  source: z.string().optional().default("N8N"),
});

export type CreateNotificationInput = z.input<typeof CreateNotificationInputSchema>;

export interface CleanInAppNotification {
  id: string;
  restaurantId: string | null;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  actionUrl: string | null;
  actionLabel: string | null;
  metadata: any | null;
  isRead: boolean;
  readAt: string | null;
  expiresAt: string | null;
  source: string;
  createdAt: string;
  isGlobal: boolean;
}

const PRIORITY_WEIGHTS: Record<NotificationPriority, number> = {
  URGENT: 0,
  HIGH: 1,
  NORMAL: 2,
  LOW: 3,
};

/**
 * Inserta una notificación individual o un anuncio global.
 */
export async function createNotification(
  input: CreateNotificationInput
): Promise<{ success: boolean; notificationId?: string; error?: string }> {
  try {
    const validated = CreateNotificationInputSchema.parse(input);

    let targetRestaurantId: string | null = null;

    if (!validated.broadcastAll) {
      if (validated.restaurantId) {
        targetRestaurantId = validated.restaurantId;
      } else if (validated.restaurantSlug) {
        const found = await prisma.restaurant.findUnique({
          where: { slug: validated.restaurantSlug },
          select: { id: true },
        });
        if (!found) {
          return { success: false, error: `No se encontró restaurante con slug '${validated.restaurantSlug}'` };
        }
        targetRestaurantId = found.id;
      } else {
        return { success: false, error: "Debe especificar restaurantId, restaurantSlug o broadcastAll: true" };
      }

      // Validar existencia del negocio si se especificó ID directo
      if (targetRestaurantId) {
        const exists = await prisma.restaurant.findUnique({
          where: { id: targetRestaurantId },
          select: { id: true },
        });
        if (!exists) {
          return { success: false, error: `Restaurante con ID '${targetRestaurantId}' no existe` };
        }
      }
    }

    // Calcular fecha de expiración
    let expiresAtDate: Date | null = null;
    if (validated.expiresAt) {
      expiresAtDate = new Date(validated.expiresAt);
    } else if (validated.expiresInHours) {
      expiresAtDate = new Date(Date.now() + validated.expiresInHours * 3600 * 1000);
    } else if (validated.type === "METRIC_SUMMARY") {
      // 7 días de vigencia por defecto para resúmenes semanales
      expiresAtDate = new Date(Date.now() + 7 * 24 * 3600 * 1000);
    } else if (validated.type === "WARNING_EXPIRING") {
      // 5 días de vigencia por defecto para alertas de expiración
      expiresAtDate = new Date(Date.now() + 5 * 24 * 3600 * 1000);
    }

    const created = await prisma.inAppNotification.create({
      data: {
        restaurantId: targetRestaurantId,
        type: validated.type,
        priority: validated.priority,
        title: validated.title.trim(),
        message: validated.message.trim(),
        actionUrl: validated.actionUrl?.trim() || null,
        actionLabel: validated.actionLabel?.trim() || null,
        metadata: validated.metadata ? (validated.metadata as Prisma.InputJsonValue) : Prisma.JsonNull,
        expiresAt: expiresAtDate,
        source: validated.source || "N8N",
      },
    });

    return { success: true, notificationId: created.id };
  } catch (error: any) {
    console.error("Error en createNotification:", error);
    return { success: false, error: error?.message || "Error al crear notificación" };
  }
}

/**
 * Obtiene todas las notificaciones activas para un restaurante (propias + globales no descartadas).
 * Ordenadas por prioridad (URGENT -> HIGH -> NORMAL -> LOW) y fecha de creación.
 */
export async function getActiveNotificationsForRestaurant(
  restaurantId: string
): Promise<CleanInAppNotification[]> {
  const now = new Date();

  // 1. Notificaciones directas
  const directNotifications = await prisma.inAppNotification.findMany({
    where: {
      restaurantId,
      dismissedAt: null,
      OR: [
        { expiresAt: null },
        { expiresAt: { gte: now } },
      ],
    },
    orderBy: { createdAt: "desc" },
  });

  // 2. Anuncios globales vigentes
  const globalNotifications = await prisma.inAppNotification.findMany({
    where: {
      restaurantId: null,
      OR: [
        { expiresAt: null },
        { expiresAt: { gte: now } },
      ],
    },
    include: {
      readReceipts: {
        where: { restaurantId },
        select: {
          isRead: true,
          readAt: true,
          isDismissed: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Filtrar las globales que este restaurante ya descartó del banner
  const activeGlobals = globalNotifications.filter(
    (g) => !g.readReceipts[0]?.isDismissed
  );

  // Mapear a formato unificado
  const cleanedDirect: CleanInAppNotification[] = directNotifications.map((d) => ({
    id: d.id,
    restaurantId: d.restaurantId,
    type: d.type,
    priority: d.priority,
    title: d.title,
    message: d.message,
    actionUrl: d.actionUrl,
    actionLabel: d.actionLabel,
    metadata: d.metadata,
    isRead: d.isRead,
    readAt: d.readAt ? d.readAt.toISOString() : null,
    expiresAt: d.expiresAt ? d.expiresAt.toISOString() : null,
    source: d.source,
    createdAt: d.createdAt.toISOString(),
    isGlobal: false,
  }));

  const cleanedGlobal: CleanInAppNotification[] = activeGlobals.map((g) => {
    const receipt = g.readReceipts[0];
    return {
      id: g.id,
      restaurantId: null,
      type: g.type,
      priority: g.priority,
      title: g.title,
      message: g.message,
      actionUrl: g.actionUrl,
      actionLabel: g.actionLabel,
      metadata: g.metadata,
      isRead: Boolean(receipt?.isRead),
      readAt: receipt?.readAt ? receipt.readAt.toISOString() : null,
      expiresAt: g.expiresAt ? g.expiresAt.toISOString() : null,
      source: g.source,
      createdAt: g.createdAt.toISOString(),
      isGlobal: true,
    };
  });

  const all = [...cleanedDirect, ...cleanedGlobal];

  // Ordenar por prioridad primero, luego por fecha descendente
  all.sort((a, b) => {
    const weightDiff = PRIORITY_WEIGHTS[a.priority] - PRIORITY_WEIGHTS[b.priority];
    if (weightDiff !== 0) return weightDiff;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return all;
}

/**
 * Marca una notificación como leída (individual o global).
 */
export async function markNotificationAsRead(
  notificationId: string,
  restaurantId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const notification = await prisma.inAppNotification.findUnique({
      where: { id: notificationId },
      select: { id: true, restaurantId: true },
    });

    if (!notification) {
      return { success: false, error: "Notificación no encontrada" };
    }

    if (notification.restaurantId !== null) {
      // Notificación individual: verificar pertenencia
      if (notification.restaurantId !== restaurantId) {
        return { success: false, error: "No autorizado para modificar esta notificación" };
      }

      await prisma.inAppNotification.update({
        where: { id: notificationId },
        data: {
          isRead: true,
          readAt: new Date(),
        },
      });
    } else {
      // Notificación global: upsert en InAppNotificationRead
      await prisma.inAppNotificationRead.upsert({
        where: {
          notificationId_restaurantId: {
            notificationId,
            restaurantId,
          },
        },
        create: {
          notificationId,
          restaurantId,
          isRead: true,
          readAt: new Date(),
        },
        update: {
          isRead: true,
          readAt: new Date(),
        },
      });
    }

    return { success: true };
  } catch (error: any) {
    console.error("Error en markNotificationAsRead:", error);
    return { success: false, error: error?.message || "Error al marcar como leída" };
  }
}

/**
 * Descarta una notificación para que no se muestre en el banner superior.
 */
export async function dismissNotification(
  notificationId: string,
  restaurantId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const notification = await prisma.inAppNotification.findUnique({
      where: { id: notificationId },
      select: { id: true, restaurantId: true },
    });

    if (!notification) {
      return { success: false, error: "Notificación no encontrada" };
    }

    if (notification.restaurantId !== null) {
      // Notificación individual: verificar pertenencia
      if (notification.restaurantId !== restaurantId) {
        return { success: false, error: "No autorizado para modificar esta notificación" };
      }

      await prisma.inAppNotification.update({
        where: { id: notificationId },
        data: {
          dismissedAt: new Date(),
          isRead: true, // Descartar también cuenta como leída
          readAt: new Date(),
        },
      });
    } else {
      // Notificación global: upsert en InAppNotificationRead
      await prisma.inAppNotificationRead.upsert({
        where: {
          notificationId_restaurantId: {
            notificationId,
            restaurantId,
          },
        },
        create: {
          notificationId,
          restaurantId,
          isDismissed: true,
          dismissedAt: new Date(),
          isRead: true,
          readAt: new Date(),
        },
        update: {
          isDismissed: true,
          dismissedAt: new Date(),
          isRead: true,
          readAt: new Date(),
        },
      });
    }

    return { success: true };
  } catch (error: any) {
    console.error("Error en dismissNotification:", error);
    return { success: false, error: error?.message || "Error al descartar notificación" };
  }
}
