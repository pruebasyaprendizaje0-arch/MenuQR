import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  getOrCreateRuletaConfig,
  sendWhatsAppCoupon,
} from "@/lib/ruleta-actions";
import {
  normalizePhoneNumber,
  selectWeightedPrize,
  generateUniqueCouponCode,
  RuletaPremioItem,
} from "@/lib/ruleta-utils";
import { findRestaurantBySlugOrHistory } from "@/lib/slugs";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { slug, telefono, nombre, fechaNacimiento } = body || {};

    if (!slug) {
      return NextResponse.json(
        { success: false, error: "El slug del restaurante es obligatorio." },
        { status: 400 }
      );
    }

    const rawPhone = (telefono || "").toString().trim();
    const cleanPhone = normalizePhoneNumber(rawPhone);
    const cleanName = (nombre || "").toString().trim();
    const cleanFechaNacimiento = (fechaNacimiento || "").toString().trim();

    if (!cleanName || cleanName.length < 2) {
      return NextResponse.json(
        { success: false, error: "Por favor ingresa tu nombre para poder girar la ruleta." },
        { status: 400 }
      );
    }

    if (!cleanPhone || cleanPhone.length < 8) {
      return NextResponse.json(
        { success: false, error: "Por favor ingresa un número de WhatsApp válido (ej: 0991234567)." },
        { status: 400 }
      );
    }

    if (!cleanFechaNacimiento) {
      return NextResponse.json(
        { success: false, error: "Por favor ingresa tu fecha de cumpleaños para poder girar la ruleta." },
        { status: 400 }
      );
    }

    // 1. Obtener restaurante
    const cleanSlug = slug.toLowerCase().trim();
    const slugCheck = await findRestaurantBySlugOrHistory(cleanSlug);
    const targetSlug = slugCheck.targetSlug || cleanSlug;

    const restaurant = await prisma.restaurant.findUnique({
      where: { slug: targetSlug },
      select: {
        id: true,
        name: true,
        slug: true,
        whatsapp: true,
      },
    });

    if (!restaurant) {
      return NextResponse.json(
        { success: false, error: "Restaurante no encontrado." },
        { status: 404 }
      );
    }

    // 2. Obtener configuración de ruleta
    const config = await getOrCreateRuletaConfig(restaurant.id);

    if (!config.activa) {
      return NextResponse.json(
        { success: false, error: "La Ruleta de Premios no está activa en este momento." },
        { status: 400 }
      );
    }

    // Default 1 día (1 giro por WhatsApp al día)
    const limiteDias = Number(config.limiteDiasReGiro) || 1;
    const maxGirosIp = Number(config.maxGirosIpDia) || 5;
    const expiracionHoras = Number(config.expiracionHoras) || 24;

    // Obtener IP del cliente y User Agent
    const forwardedFor = request.headers.get("x-forwarded-for");
    const ipAddress = forwardedFor ? forwardedFor.split(",")[0].trim() : "127.0.0.1";
    const userAgent = request.headers.get("user-agent") || "Web Client";

    const now = new Date();

    // 3. Anti-Fraude A: Validar si el teléfono ya giró hoy (1 vez al día)
    const fechaLimiteGiro = new Date(now.getTime() - limiteDias * 24 * 60 * 60 * 1000);
    const giroDelegate = (prisma as any).ruletaGiro;

    if (giroDelegate?.findFirst) {
      const ultimoGiroTelefono = await giroDelegate.findFirst({
        where: {
          restaurantId: restaurant.id,
          telefono: cleanPhone,
          fechaGiro: { gte: fechaLimiteGiro },
        },
        orderBy: { fechaGiro: "desc" },
      });

      if (ultimoGiroTelefono) {
        const horasRestantes = Math.max(
          1,
          Math.ceil((ultimoGiroTelefono.fechaGiro.getTime() + limiteDias * 24 * 60 * 60 * 1000 - now.getTime()) / (1000 * 60 * 60))
        );
        const errorMsg = limiteDias <= 1
          ? `Este número de WhatsApp ya realizó su giro del día. Podrás volver a girar en ${horasRestantes} hora(s).`
          : `Este número de WhatsApp ya participó. Podrás volver a girar en ${Math.ceil(horasRestantes / 24)} día(s).`;

        return NextResponse.json(
          {
            success: false,
            error: errorMsg,
            yaGiro: true,
            ultimoGiro: {
              codigoCupon: ultimoGiroTelefono.codigoCupon,
              premioLabel: ultimoGiroTelefono.premioLabel,
              estado: ultimoGiroTelefono.estado,
              fechaExpiracion: ultimoGiroTelefono.fechaExpiracion,
            },
          },
          { status: 429 }
        );
      }
    }

    // 4. Anti-Fraude B: Validar límite de giros por IP en las últimas 24 horas
    if (giroDelegate?.count && ipAddress && ipAddress !== "127.0.0.1" && ipAddress !== "::1") {
      const fecha24hAtras = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const girosPorIp = await giroDelegate.count({
        where: {
          ipAddress,
          fechaGiro: { gte: fecha24hAtras },
        },
      });

      if (girosPorIp >= maxGirosIp) {
        return NextResponse.json(
          {
            success: false,
            error: "Has alcanzado el límite de giros diarios desde esta red. Intenta mañana.",
          },
          { status: 429 }
        );
      }
    }

    // 5. Backend Sorteo: Probabilidad ponderada
    const premios: RuletaPremioItem[] = config.premiosList;
    const { premio, sectorIndex } = selectWeightedPrize(premios);

    // 6. Generar código de cupón único
    let codigoCupon = generateUniqueCouponCode(premio.codigo_prefijo || "GIFT", restaurant.slug);
    if (giroDelegate?.findUnique) {
      let exists = await giroDelegate.findUnique({ where: { codigoCupon } });
      let attempts = 0;
      while (exists && attempts < 5) {
        codigoCupon = generateUniqueCouponCode(premio.codigo_prefijo || "GIFT", restaurant.slug);
        exists = await giroDelegate.findUnique({ where: { codigoCupon } });
        attempts++;
      }
    }

    const fechaExpiracion = new Date(now.getTime() + expiracionHoras * 60 * 60 * 1000);

    // 7. Guardar registro en ruletas_giros
    let nuevoGiroId = `giro-${Date.now()}`;
    if (giroDelegate?.create) {
      const nuevoGiro = await giroDelegate.create({
        data: {
          restaurantId: restaurant.id,
          telefono: cleanPhone,
          nombreCliente: cleanName,
          fechaNacimiento: cleanFechaNacimiento,
          premioId: premio.id,
          premioLabel: premio.label,
          premioTipo: premio.tipo,
          premioValor: Number(premio.valor) || 0.0,
          codigoCupon,
          estado: "PENDIENTE",
          ipAddress,
          userAgent,
          fechaGiro: now,
          fechaExpiracion,
        },
      });
      nuevoGiroId = nuevoGiro.id;
    }

    // 8. Integración CRM Automática: Crear o actualizar contacto en tabla Customer
    try {
      const existingCustomer = await prisma.customer.findFirst({
        where: {
          restaurantId: restaurant.id,
          phone: cleanPhone,
        },
      });

      if (existingCustomer) {
        await prisma.customer.update({
          where: { id: existingCustomer.id },
          data: {
            name: cleanName || existingCustomer.name,
            birthDate: cleanFechaNacimiento || (existingCustomer as any).birthDate,
            notes: existingCustomer.notes
              ? `${existingCustomer.notes} | Ganó Ruleta: ${premio.label} (Cupón ${codigoCupon})`
              : `Ganó Ruleta: ${premio.label} (Cupón ${codigoCupon})`,
          },
        });
      } else {
        await prisma.customer.create({
          data: {
            restaurantId: restaurant.id,
            name: cleanName,
            phone: cleanPhone,
            category: "RULETA",
            birthDate: cleanFechaNacimiento,
            notes: `Capturado en Ruleta: ${premio.label} (Cupón ${codigoCupon})`,
            totalOrders: 0,
            totalSpent: 0.0,
          },
        });
      }
    } catch (crmError) {
      console.error("[Ruleta CRM Error] Error al sincronizar con CRM:", crmError);
    }

    // 9. Enviar notificación WhatsApp (Stub listo para conectar API)
    try {
      await sendWhatsAppCoupon({
        phone: cleanPhone,
        name: cleanName,
        couponCode: codigoCupon,
        prizeLabel: premio.label,
        restaurantName: restaurant.name,
        expirationDate: fechaExpiracion,
      });
    } catch (waError) {
      console.error("[Ruleta WhatsApp Error]:", waError);
    }

    // 10. Devolver resultado seguro al frontend
    return NextResponse.json({
      success: true,
      giroId: nuevoGiroId,
      codigoCupon,
      premioLabel: premio.label,
      premioTipo: premio.tipo,
      premioId: premio.id,
      sectorIndex,
      fechaExpiracion: fechaExpiracion.toISOString(),
      restaurantName: restaurant.name,
      restaurantWhatsapp: restaurant.whatsapp,
    });
  } catch (error: any) {
    console.error("[API Ruleta Girar Error]:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Error al procesar el giro de la ruleta" },
      { status: 500 }
    );
  }
}
