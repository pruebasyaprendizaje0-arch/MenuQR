"use server";

import { prisma } from "@/lib/db";
import { getUserSession, getSuperAdminSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { RuletaPremioItem, DEFAULT_RULETA_PREMIOS } from "./ruleta-utils";
import crypto from "crypto";

/**
 * Stub de integración WhatsApp API (Meta Cloud API / WPPConnect / Twilio / Deuna / Chatwoot)
 */
export async function sendWhatsAppCoupon({
  phone,
  name,
  couponCode,
  prizeLabel,
  restaurantName,
  expirationDate,
}: {
  phone: string;
  name: string;
  couponCode: string;
  prizeLabel: string;
  restaurantName: string;
  expirationDate: Date;
}) {
  const formattedDate = expirationDate.toLocaleDateString("es-EC", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  const message = `¡Hola ${name || "Cliente"}! 🎉\n\nGanaste *${prizeLabel}* en la Ruleta de Premios de *${restaurantName}*.\n\n🎟️ Tu código de cupón es: *${couponCode}*\n⏰ Válido hasta: ${formattedDate}\n\nPresenta este código al mesero o cajero antes de pagar. ¡Te esperamos! ✨`;

  console.log(`[WhatsApp API Stub] Enviando cupón a ${phone}:\n${message}`);

  return {
    success: true,
    phone,
    message,
    sentAt: new Date().toISOString(),
  };
}

/**
 * Obtiene o inicializa la configuración de ruleta para un restaurante
 */
export async function getOrCreateRuletaConfig(restaurantId: string) {
  const configDelegate = (prisma as any).ruletaConfig;
  try {
    if (configDelegate?.findUnique) {
      const config = await configDelegate.findUnique({
        where: { restaurantId },
      });

      if (config) {
        let parsedPremios: RuletaPremioItem[] = [];
        try {
          parsedPremios = JSON.parse(config.premios);
        } catch {
          parsedPremios = DEFAULT_RULETA_PREMIOS;
        }
        return {
          ...config,
          premiosList: parsedPremios,
        };
      }

      // Si no existe, crear con defaults
      const newConfig = await configDelegate.create({
        data: {
          restaurantId,
          activa: true,
          titulo: "¡Gira la Ruleta y Gana!",
          descripcion: "Prueba tu suerte y obtén un beneficio exclusivo para tu consumo hoy.",
          colorPrimario: "#111827",
          colorSecundario: "#ef4444",
          colorFondo: "#0f172a",
          premios: JSON.stringify(DEFAULT_RULETA_PREMIOS),
          limiteDiasReGiro: 1,
          maxGirosIpDia: 5,
          expiracionHoras: 24,
        },
      });

      return {
        ...newConfig,
        premiosList: DEFAULT_RULETA_PREMIOS,
      };
    } else {
      // Fallback SQL nativo si el cliente Prisma aún no cargó el modelo
      const rows: any[] = await prisma.$queryRawUnsafe(
        `SELECT * FROM "RuletaConfig" WHERE "restaurantId" = $1 LIMIT 1`,
        restaurantId
      );

      if (rows && rows.length > 0) {
        const config = rows[0];
        let parsedPremios: RuletaPremioItem[] = [];
        try {
          parsedPremios = JSON.parse(config.premios);
        } catch {
          parsedPremios = DEFAULT_RULETA_PREMIOS;
        }
        return {
          id: config.id,
          restaurantId: config.restaurantId,
          activa: Boolean(config.activa),
          titulo: config.titulo,
          descripcion: config.descripcion,
          colorPrimario: config.colorPrimario,
          colorSecundario: config.colorSecundario,
          colorFondo: config.colorFondo,
          premios: config.premios,
          limiteDiasReGiro: Number(config.limiteDiasReGiro) || 1,
          maxGirosIpDia: Number(config.maxGirosIpDia) || 5,
          expiracionHoras: Number(config.expiracionHoras) || 24,
          premiosList: parsedPremios,
        };
      }

      // Insertar por defecto en SQL nativo
      const newId = crypto.randomUUID();
      await prisma.$executeRawUnsafe(
        `INSERT INTO "RuletaConfig" ("id", "restaurantId", "activa", "titulo", "descripcion", "colorPrimario", "colorSecundario", "colorFondo", "premios", "limiteDiasReGiro", "maxGirosIpDia", "expiracionHoras", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())`,
        newId,
        restaurantId,
        true,
        "¡Gira la Ruleta y Gana!",
        "Prueba tu suerte y obtén un beneficio exclusivo para tu consumo hoy.",
        "#111827",
        "#ef4444",
        "#0f172a",
        JSON.stringify(DEFAULT_RULETA_PREMIOS),
        1,
        5,
        24
      );

      return {
        id: newId,
        restaurantId,
        activa: true,
        titulo: "¡Gira la Ruleta y Gana!",
        descripcion: "Prueba tu suerte y obtén un beneficio exclusivo para tu consumo hoy.",
        colorPrimario: "#111827",
        colorSecundario: "#ef4444",
        colorFondo: "#0f172a",
        premios: JSON.stringify(DEFAULT_RULETA_PREMIOS),
        limiteDiasReGiro: 1,
        maxGirosIpDia: 5,
        expiracionHoras: 24,
        premiosList: DEFAULT_RULETA_PREMIOS,
      };
    }
  } catch (err) {
    console.warn("[Ruleta Config Warning] Fallback a config en memoria:", err);
  }

  return {
    id: `fallback-${restaurantId}`,
    restaurantId,
    activa: true,
    titulo: "¡Gira la Ruleta y Gana!",
    descripcion: "Prueba tu suerte y obtén un beneficio exclusivo para tu consumo hoy.",
    colorPrimario: "#111827",
    colorSecundario: "#ef4444",
    colorFondo: "#0f172a",
    premios: JSON.stringify(DEFAULT_RULETA_PREMIOS),
    limiteDiasReGiro: 1,
    maxGirosIpDia: 5,
    expiracionHoras: 24,
    premiosList: DEFAULT_RULETA_PREMIOS,
  };
}

/**
 * Obtener configuración completa para el panel de Administración
 */
export async function getRuletaAdminConfigAction(restaurantId: string) {
  const session = await getUserSession();
  const superAdmin = await getSuperAdminSession();

  if (!session && !superAdmin) {
    return { success: false, error: "No autorizado" };
  }

  try {
    const config = await getOrCreateRuletaConfig(restaurantId);
    return {
      success: true,
      config,
    };
  } catch (error: any) {
    console.error("Error al obtener config para admin:", error);
    return { success: false, error: error?.message || "Error al obtener configuración" };
  }
}

/**
 * Guardar configuración de la ruleta desde el panel Admin
 */
export async function saveRuletaConfigAction(
  restaurantId: string,
  formData: {
    activa: boolean;
    titulo: string;
    descripcion: string;
    colorPrimario: string;
    colorSecundario: string;
    colorFondo: string;
    premios: RuletaPremioItem[];
    limiteDiasReGiro: number;
    maxGirosIpDia: number;
    expiracionHoras: number;
  }
) {
  const session = await getUserSession();
  const superAdmin = await getSuperAdminSession();

  if (!session && !superAdmin) {
    return { success: false, error: "No autorizado" };
  }

  // Validar permisos del restaurante
  if (session && !superAdmin) {
    const rest = await prisma.restaurant.findFirst({
      where: { id: restaurantId, userId: session.userId },
    });
    if (!rest) {
      return { success: false, error: "No tienes permiso para editar este negocio." };
    }
  }

  // Validar 6 premios
  if (!formData.premios || formData.premios.length !== 6) {
    return { success: false, error: "La ruleta debe tener exactamente 6 premios." };
  }

  // Validar suma de probabilidades = 100%
  const sumProb = formData.premios.reduce((acc, p) => acc + (Number(p.probabilidad) || 0), 0);
  if (Math.abs(sumProb - 100) > 0.01) {
    return { success: false, error: `La suma de probabilidades debe ser exactamente 100%. Actual: ${sumProb}%` };
  }

  const activa = Boolean(formData.activa);
  const titulo = formData.titulo?.trim() || "¡Gira la Ruleta y Gana!";
  const descripcion = formData.descripcion?.trim() || "Prueba tu suerte y obtén un premio.";
  const colorPrimario = formData.colorPrimario || "#111827";
  const colorSecundario = formData.colorSecundario || "#ef4444";
  const colorFondo = formData.colorFondo || "#0f172a";
  const premiosJson = JSON.stringify(formData.premios);
  const limiteDiasReGiro = Number(formData.limiteDiasReGiro) || 1;
  const maxGirosIpDia = Number(formData.maxGirosIpDia) || 5;
  const expiracionHoras = Number(formData.expiracionHoras) || 24;

  try {
    const configDelegate = (prisma as any).ruletaConfig;
    if (configDelegate?.upsert) {
      const updated = await configDelegate.upsert({
        where: { restaurantId },
        update: {
          activa,
          titulo,
          descripcion,
          colorPrimario,
          colorSecundario,
          colorFondo,
          premios: premiosJson,
          limiteDiasReGiro,
          maxGirosIpDia,
          expiracionHoras,
        },
        create: {
          restaurantId,
          activa,
          titulo,
          descripcion,
          colorPrimario,
          colorSecundario,
          colorFondo,
          premios: premiosJson,
          limiteDiasReGiro,
          maxGirosIpDia,
          expiracionHoras,
        },
      });

      revalidatePath("/admin");
      revalidatePath(`/[slug]`, "page");
      return { success: true, config: updated };
    } else {
      // Fallback SQL nativo si prisma delegate aún no está cargado
      const existing: any[] = await prisma.$queryRawUnsafe(
        `SELECT id FROM "RuletaConfig" WHERE "restaurantId" = $1 LIMIT 1`,
        restaurantId
      );

      if (existing && existing.length > 0) {
        await prisma.$executeRawUnsafe(
          `UPDATE "RuletaConfig" SET "activa" = $1, "titulo" = $2, "descripcion" = $3, "colorPrimario" = $4, "colorSecundario" = $5, "colorFondo" = $6, "premios" = $7, "limiteDiasReGiro" = $8, "maxGirosIpDia" = $9, "expiracionHoras" = $10, "updatedAt" = NOW() WHERE "restaurantId" = $11`,
          activa,
          titulo,
          descripcion,
          colorPrimario,
          colorSecundario,
          colorFondo,
          premiosJson,
          limiteDiasReGiro,
          maxGirosIpDia,
          expiracionHoras,
          restaurantId
        );
      } else {
        const newId = crypto.randomUUID();
        await prisma.$executeRawUnsafe(
          `INSERT INTO "RuletaConfig" ("id", "restaurantId", "activa", "titulo", "descripcion", "colorPrimario", "colorSecundario", "colorFondo", "premios", "limiteDiasReGiro", "maxGirosIpDia", "expiracionHoras", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())`,
          newId,
          restaurantId,
          activa,
          titulo,
          descripcion,
          colorPrimario,
          colorSecundario,
          colorFondo,
          premiosJson,
          limiteDiasReGiro,
          maxGirosIpDia,
          expiracionHoras
        );
      }

      revalidatePath("/admin");
      revalidatePath(`/[slug]`, "page");
      return {
        success: true,
        config: {
          restaurantId,
          activa,
          titulo,
          descripcion,
          colorPrimario,
          colorSecundario,
          colorFondo,
          premios: premiosJson,
          limiteDiasReGiro,
          maxGirosIpDia,
          expiracionHoras,
        },
      };
    }
  } catch (error: any) {
    console.error("Error al guardar config de ruleta:", error);
    return { success: false, error: error?.message || "Error al guardar configuración" };
  }
}

/**
 * Validar y canjear cupón en caja
 */
export async function validarCuponAction(restaurantId: string, codigoCupon: string) {
  const session = await getUserSession();
  const superAdmin = await getSuperAdminSession();

  if (!session && !superAdmin) {
    return { success: false, error: "No autorizado para validar cupones." };
  }

  const cleanCode = (codigoCupon || "").trim().toUpperCase();
  if (!cleanCode) {
    return { success: false, error: "Ingresa el código del cupón." };
  }

  try {
    const giroDelegate = (prisma as any).ruletaGiro;
    let giro: any = null;

    if (giroDelegate?.findFirst) {
      giro = await giroDelegate.findFirst({
        where: {
          restaurantId,
          codigoCupon: cleanCode,
        },
        include: {
          restaurant: {
            select: { name: true, slug: true },
          },
        },
      });
    } else {
      const rows: any[] = await prisma.$queryRawUnsafe(
        `SELECT g.*, r.name as "restaurantName", r.slug as "restaurantSlug" 
         FROM "RuletaGiro" g 
         LEFT JOIN "Restaurant" r ON g."restaurantId" = r.id 
         WHERE g."restaurantId" = $1 AND g."codigoCupon" = $2 LIMIT 1`,
        restaurantId,
        cleanCode
      );
      if (rows && rows.length > 0) {
        giro = rows[0];
        giro.restaurant = { name: giro.restaurantName, slug: giro.restaurantSlug };
      }
    }

    if (!giro) {
      return { success: false, error: `El código "${cleanCode}" no existe en este restaurante.` };
    }

    if (giro.estado === "CANJEADO") {
      const fechaCanje = giro.fechaCanjeo ? new Date(giro.fechaCanjeo).toLocaleString("es-EC") : "Previamente";
      return {
        success: false,
        error: `Este cupón YA FUE CANJEADO el ${fechaCanje}.`,
        giro,
      };
    }

    const now = new Date();
    if (new Date(giro.fechaExpiracion) < now || giro.estado === "EXPIRADO") {
      if (giroDelegate?.update) {
        await giroDelegate.update({
          where: { id: giro.id },
          data: { estado: "EXPIRADO" },
        });
      } else {
        await prisma.$executeRawUnsafe(
          `UPDATE "RuletaGiro" SET "estado" = 'EXPIRADO', "updatedAt" = NOW() WHERE "id" = $1`,
          giro.id
        );
      }
      return {
        success: false,
        error: `Este cupón expiró el ${new Date(giro.fechaExpiracion).toLocaleString("es-EC")}.`,
        giro: { ...giro, estado: "EXPIRADO" },
      };
    }

    // Canjear cupón
    let updatedGiro = { ...giro, estado: "CANJEADO", fechaCanjeo: now };
    if (giroDelegate?.update) {
      updatedGiro = await giroDelegate.update({
        where: { id: giro.id },
        data: {
          estado: "CANJEADO",
          fechaCanjeo: now,
        },
      });
    } else {
      await prisma.$executeRawUnsafe(
        `UPDATE "RuletaGiro" SET "estado" = 'CANJEADO', "fechaCanjeo" = NOW(), "updatedAt" = NOW() WHERE "id" = $1`,
        giro.id
      );
    }

    return {
      success: true,
      message: `¡Cupón validado con éxito! Beneficio: ${updatedGiro.premioLabel}`,
      giro: updatedGiro,
    };
  } catch (error: any) {
    console.error("Error al validar cupón:", error);
    return { success: false, error: error?.message || "Error al validar cupón" };
  }
}

/**
 * Obtener historial de giros con filtros para panel admin
 */
export async function getRuletaGirosAction(
  restaurantId: string,
  params?: {
    search?: string;
    estado?: string;
    page?: number;
    pageSize?: number;
  }
) {
  const session = await getUserSession();
  const superAdmin = await getSuperAdminSession();

  if (!session && !superAdmin) {
    return { success: false, error: "No autorizado" };
  }

  const search = params?.search?.trim() || "";
  const estado = params?.estado || "TODOS";
  const page = params?.page || 1;
  const pageSize = params?.pageSize || 25;

  try {
    const giroDelegate = (prisma as any).ruletaGiro;
    if (giroDelegate?.findMany) {
      const where: any = { restaurantId };

      if (estado && estado !== "TODOS") {
        where.estado = estado;
      }

      if (search) {
        where.OR = [
          { telefono: { contains: search, mode: "insensitive" } },
          { nombreCliente: { contains: search, mode: "insensitive" } },
          { codigoCupon: { contains: search, mode: "insensitive" } },
          { premioLabel: { contains: search, mode: "insensitive" } },
        ];
      }

      const [total, giros] = await Promise.all([
        giroDelegate.count({ where }),
        giroDelegate.findMany({
          where,
          orderBy: { fechaGiro: "desc" },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
      ]);

      return {
        success: true,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
        giros,
      };
    } else {
      // Fallback SQL nativo
      let query = `SELECT * FROM "RuletaGiro" WHERE "restaurantId" = $1`;
      const queryParams: any[] = [restaurantId];
      let paramIdx = 2;

      if (estado && estado !== "TODOS") {
        query += ` AND "estado" = $${paramIdx}`;
        queryParams.push(estado);
        paramIdx++;
      }

      if (search) {
        query += ` AND ("telefono" ILIKE $${paramIdx} OR "nombreCliente" ILIKE $${paramIdx} OR "codigoCupon" ILIKE $${paramIdx} OR "premioLabel" ILIKE $${paramIdx})`;
        queryParams.push(`%${search}%`);
        paramIdx++;
      }

      const totalRows: any[] = await prisma.$queryRawUnsafe(
        `SELECT COUNT(*)::int as count FROM (${query}) as sub`,
        ...queryParams
      );
      const total = totalRows[0]?.count || 0;

      const offset = (page - 1) * pageSize;
      query += ` ORDER BY "fechaGiro" DESC LIMIT ${pageSize} OFFSET ${offset}`;
      const giros: any[] = await prisma.$queryRawUnsafe(query, ...queryParams);

      return {
        success: true,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
        giros,
      };
    }
  } catch (error: any) {
    console.error("Error al obtener giros:", error);
    return { success: false, error: error?.message || "Error al obtener historial" };
  }
}
