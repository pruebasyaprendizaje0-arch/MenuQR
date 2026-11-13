import { prisma } from "@/lib/prisma";
import { decryptDatilPassword } from "@/lib/datil-encryption";
import {
  CustomerInvoiceInput,
  validateEcuadorianRuc,
  validateSriInvoiceRules,
} from "./datil-utils";
export { type CustomerInvoiceInput, validateEcuadorianRuc, validateSriInvoiceRules };

export interface EmitInvoiceResult {
  success: boolean;
  status: "AUTORIZADA" | "PENDIENTE_SRI" | "RECHAZADA_SRI" | "NO_CONFIGURADO";
  message?: string;
  accessKey?: string;
  authNumber?: string;
  sequential?: string;
  rideUrl?: string;
  xmlUrl?: string;
  error?: string;
}

/**
 * Mapeo de métodos de pago de MenuQR Pro al código del SRI
 */
function mapPaymentMethodToSri(method?: string): string {
  const m = (method || "").toUpperCase();
  if (m.includes("EFECTIVO")) return "01"; // Sin utilización del sistema financiero
  if (m.includes("DEUNA") || m.includes("DINERO_ELECTRONICO")) return "17"; // Dinero electrónico
  if (m.includes("TARJETA") || m.includes("POS")) return "19"; // Tarjeta de crédito/débito
  if (m.includes("TRANSFERENCIA") || m.includes("PAYPHONE")) return "20"; // Otros con utilización del sistema financiero
  return "01";
}

/**
 * Emite una factura electrónica a través de Dátil (con tolerancia a fallos y timeout de 6s)
 */
export async function emitDatilInvoice(
  restaurantId: string,
  orderId: string,
  customerInput?: CustomerInvoiceInput
): Promise<EmitInvoiceResult> {
  try {
    // 1. Obtener la configuración de Dátil del restaurante
    const config = await prisma.datilConfig.findUnique({
      where: { restaurantId },
    });

    if (!config || !config.isEnabled) {
      return {
        success: true,
        status: "NO_CONFIGURADO",
        message: "Facturación electrónica no habilitada para este negocio",
      };
    }

    // 2. Obtener la orden con sus ítems
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order) {
      return {
        success: false,
        status: "RECHAZADA_SRI",
        error: "No se encontró el pedido a facturar.",
      };
    }

    // 3. Resolver datos del cliente
    const customer: CustomerInvoiceInput = customerInput || {
      doc: order.invoiceCustomerDoc || "9999999999999",
      docType: (order.invoiceCustomerDocType as any) || "07",
      name: order.customerName || "CONSUMIDOR FINAL",
      email: order.invoiceCustomerEmail || undefined,
      address: order.invoiceCustomerAddress || undefined,
    };

    // 4. Validar regla de $50 USD
    const ruleCheck = validateSriInvoiceRules(order.total, customer);
    if (!ruleCheck.valid) {
      return {
        success: false,
        status: "RECHAZADA_SRI",
        error: ruleCheck.error,
      };
    }

    // 5. Descifrar contraseña de API Dátil
    const apiPassword = decryptDatilPassword(config.apiPasswordEncrypted);
    const apiKey = config.apiKey.trim();

    // 6. Preparar numeración secuencial
    const seqNum = String(config.secuencialFactura).padStart(9, "0");
    const formattedSequential = `${config.establecimiento}-${config.puntoEmision}-${seqNum}`;

    // 7. Estructurar detalle de ítems e impuestos
    const subtotal = order.subtotal || order.total;
    const ivaVal = order.iva || 0;
    const hasIva = ivaVal > 0;
    const ivaTarifa = hasIva ? 15 : 0; // Tarifa general vigente en Ecuador (15%) o 0%
    const ivaCodigoPorcentaje = hasIva ? 4 : 0; // Código 4 = 15%, Código 0 = 0% en SRI

    const datilItems = (order.items || []).map((it, idx) => {
      const itemSubtotal = it.price * it.quantity;
      const itemIva = hasIva ? Number((itemSubtotal * 0.15).toFixed(2)) : 0;
      return {
        codigo_principal: it.id ? it.id.substring(0, 20) : `ITM-${idx + 1}`,
        descripcion: it.dishName || "Producto / Consumo",
        cantidad: it.quantity,
        precio_unitario: Number(it.price.toFixed(2)),
        descuento: 0,
        precio_total_sin_impuesto: Number(itemSubtotal.toFixed(2)),
        impuestos: [
          {
            codigo: 2, // 2 = IVA
            codigo_porcentaje: ivaCodigoPorcentaje,
            tarifa: ivaTarifa,
            base_imponible: Number(itemSubtotal.toFixed(2)),
            valor: itemIva,
          },
        ],
      };
    });

    // 8. Construir el payload completo para Dátil
    const datilPayload = {
      ambiente: config.environment === "PROD" ? 2 : 1, // 1: Pruebas, 2: Producción
      tipo_emision: 1, // 1: Emisión Normal
      secuencial: Number(config.secuencialFactura),
      establecimiento: config.establecimiento,
      punto_emision: config.puntoEmision,
      emisor: {
        ruc: config.ruc,
        razon_social: config.razonSocial,
        nombre_comercial: config.nombreComercial || config.razonSocial,
        direccion_matriz: config.direccionMatriz,
        direccion_establecimiento: config.direccionEstablecimiento || config.direccionMatriz,
        contribuyente_especial: config.contribuyenteEspecial || undefined,
        obligado_contabilidad: config.obligadoContabilidad,
        regimen_rimpe:
          config.regimen === "RIMPE_EMPRENDEDOR"
            ? "CONTRIBUYENTE RÉGIMEN RIMPE EMPRENDEDOR"
            : config.regimen === "RIMPE_POPULAR"
            ? "CONTRIBUYENTE NEGOCIO POPULAR - RÉGIMEN RIMPE"
            : undefined,
      },
      comprador: {
        tipo_identificacion: customer.docType,
        identificacion: customer.doc,
        razon_social: customer.name,
        direccion: customer.address || "S/D",
        email: customer.email || undefined,
        telefono: customer.phone || undefined,
      },
      totales: {
        total_sin_impuestos: Number(subtotal.toFixed(2)),
        total_descuento: Number((order.discountAmount || 0).toFixed(2)),
        propina: Number((order.serviceCharge || 0).toFixed(2)),
        importe_total: Number(order.total.toFixed(2)),
        impuestos: [
          {
            codigo: 2,
            codigo_porcentaje: ivaCodigoPorcentaje,
            tarifa: ivaTarifa,
            base_imponible: Number(subtotal.toFixed(2)),
            valor: Number(ivaVal.toFixed(2)),
          },
        ],
      },
      items: datilItems.length > 0 ? datilItems : [
        {
          codigo_principal: "CONSUMO-01",
          descripcion: "Consumo General",
          cantidad: 1,
          precio_unitario: Number(subtotal.toFixed(2)),
          descuento: 0,
          precio_total_sin_impuesto: Number(subtotal.toFixed(2)),
          impuestos: [
            {
              codigo: 2,
              codigo_porcentaje: ivaCodigoPorcentaje,
              tarifa: ivaTarifa,
              base_imponible: Number(subtotal.toFixed(2)),
              valor: Number(ivaVal.toFixed(2)),
            },
          ],
        },
      ],
      pagos: [
        {
          medio_pago: mapPaymentMethodToSri(order.paymentMethod),
          total: Number(order.total.toFixed(2)),
        },
      ],
    };

    // 9. Ejecutar llamada a Dátil con Idempotency-Key y Timeout de 6 segundos
    let responseData: any = null;
    let isTimeoutOrProcessing = false;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000); // 6 segundos de timeout

      const res = await fetch("https://api.datil.co/v1/invoices", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Key": apiKey,
          "X-Password": apiPassword,
          "Idempotency-Key": `order-${order.id}`,
        },
        body: JSON.stringify(datilPayload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      responseData = await res.json().catch(() => null);

      if (!res.ok) {
        // Si el estado es 504 (Gateway Timeout) o 500 intermitente de Dátil
        if (res.status === 504 || res.status === 502) {
          isTimeoutOrProcessing = true;
        } else {
          const errDetail =
            responseData?.mensaje ||
            responseData?.error ||
            (Array.isArray(responseData?.mensajes) ? responseData.mensajes.map((m: any) => m.mensaje || m).join("; ") : null) ||
            `Error HTTP ${res.status}`;
          
          await prisma.order.update({
            where: { id: order.id },
            data: {
              invoiceStatus: "RECHAZADA_SRI",
              invoiceErrorMessage: String(errDetail),
              invoiceCustomerDoc: customer.doc,
              invoiceCustomerDocType: customer.docType,
              invoiceCustomerEmail: customer.email,
              invoiceCustomerAddress: customer.address,
            },
          });

          return {
            success: false,
            status: "RECHAZADA_SRI",
            error: `SRI / Dátil: ${errDetail}`,
          };
        }
      }
    } catch (networkErr: any) {
      // Timeout o falla de conexión: no bloqueamos la caja
      isTimeoutOrProcessing = true;
    }

    // 10. Evaluar resultado y aplicar contingencia si hay demora o está EN_PROCESO
    const estado = (responseData?.estado || responseData?.status || "").toUpperCase();
    const isAuthorized = estado === "AUTORIZADO" || estado === "AUTORIZADA" || estado === "AUTHORIZED";

    if (isTimeoutOrProcessing || estado === "EN_PROCESO" || estado === "RECIBIDA") {
      // Manejo de contingencia: Marcamos como PENDIENTE_SRI y avanzamos el secuencial
      await prisma.$transaction([
        prisma.order.update({
          where: { id: order.id },
          data: {
            invoiceStatus: "PENDIENTE_SRI",
            invoiceSequential: formattedSequential,
            invoiceCustomerDoc: customer.doc,
            invoiceCustomerDocType: customer.docType,
            invoiceCustomerEmail: customer.email,
            invoiceCustomerAddress: customer.address,
            invoiceErrorMessage: "Comprobante en proceso de autorización SRI",
          },
        }),
        prisma.datilConfig.update({
          where: { id: config.id },
          data: { secuencialFactura: { increment: 1 } },
        }),
      ]);

      return {
        success: true,
        status: "PENDIENTE_SRI",
        sequential: formattedSequential,
        message: "Comprobante en proceso de autorización SRI",
      };
    }

    if (isAuthorized) {
      const accessKey =
        responseData.clave_acceso ||
        responseData.access_key ||
        responseData.numero_autorizacion ||
        "";
      const authNumber = responseData.numero_autorizacion || accessKey;
      const authDate = responseData.fecha_autorizacion ? new Date(responseData.fecha_autorizacion) : new Date();
      const rideUrl = responseData.pdf_url || responseData.ride_url || `https://app.datil.co/invoices/${responseData.id || accessKey}/pdf`;
      const xmlUrl = responseData.xml_url || `https://app.datil.co/invoices/${responseData.id || accessKey}/xml`;

      await prisma.$transaction([
        prisma.order.update({
          where: { id: order.id },
          data: {
            invoiceStatus: "AUTORIZADA",
            invoiceAccessKey: accessKey,
            invoiceAuthNumber: authNumber,
            invoiceAuthDate: authDate,
            invoiceSequential: formattedSequential,
            invoiceRideUrl: rideUrl,
            invoiceXmlUrl: xmlUrl,
            invoiceCustomerDoc: customer.doc,
            invoiceCustomerDocType: customer.docType,
            invoiceCustomerEmail: customer.email,
            invoiceCustomerAddress: customer.address,
            invoiceErrorMessage: null,
          },
        }),
        prisma.datilConfig.update({
          where: { id: config.id },
          data: { secuencialFactura: { increment: 1 } },
        }),
      ]);

      return {
        success: true,
        status: "AUTORIZADA",
        accessKey,
        authNumber,
        sequential: formattedSequential,
        rideUrl,
        xmlUrl,
        message: "Factura autorizada exitosamente por el SRI",
      };
    }

    // Si Dátil respondió pero con rechazo
    const rejectionMsg =
      responseData?.mensaje ||
      (Array.isArray(responseData?.mensajes) ? responseData.mensajes.map((m: any) => m.mensaje || m).join("; ") : null) ||
      `Rechazado por SRI con estado: ${estado}`;

    await prisma.order.update({
      where: { id: order.id },
      data: {
        invoiceStatus: "RECHAZADA_SRI",
        invoiceErrorMessage: rejectionMsg,
        invoiceCustomerDoc: customer.doc,
        invoiceCustomerDocType: customer.docType,
      },
    });

    return {
      success: false,
      status: "RECHAZADA_SRI",
      error: rejectionMsg,
    };
  } catch (error: any) {
    console.error("Error en emitDatilInvoice:", error);
    return {
      success: false,
      status: "RECHAZADA_SRI",
      error: error?.message || "Error inesperado al emitir factura electrónica",
    };
  }
}

/**
 * Consulta el estado de una factura en Dátil / SRI (para comprobantes PENDIENTE_SRI)
 */
export async function checkDatilInvoiceStatus(orderId: string): Promise<EmitInvoiceResult> {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        restaurant: {
          include: { datilConfig: true },
        },
      },
    });

    if (!order || !order.restaurant.datilConfig) {
      return { success: false, status: "RECHAZADA_SRI", error: "Pedido o configuración no encontrada" };
    }

    const config = order.restaurant.datilConfig;
    const apiPassword = decryptDatilPassword(config.apiPasswordEncrypted);

    // Buscar en Dátil por Idempotency-Key o Clave de Acceso
    const searchParam = order.invoiceAccessKey || `order-${order.id}`;
    const res = await fetch(`https://api.datil.co/v1/invoices?search=${encodeURIComponent(searchParam)}&limit=1`, {
      method: "GET",
      headers: {
        "X-Key": config.apiKey.trim(),
        "X-Password": apiPassword,
      },
      signal: AbortSignal.timeout(6000),
    });

    if (!res.ok) {
      return {
        success: false,
        status: (order.invoiceStatus as any) || "PENDIENTE_SRI",
        error: `No se pudo consultar el estado en Dátil (HTTP ${res.status})`,
      };
    }

    const data = await res.json();
    const invoices = Array.isArray(data) ? data : data.results || data.invoices || [];
    const invoice = invoices[0];

    if (!invoice) {
      return {
        success: false,
        status: "PENDIENTE_SRI",
        message: "Comprobante aún no registrado o en cola de procesamiento SRI",
      };
    }

    const estado = (invoice.estado || invoice.status || "").toUpperCase();
    if (estado === "AUTORIZADO" || estado === "AUTORIZADA" || estado === "AUTHORIZED") {
      const accessKey = invoice.clave_acceso || invoice.access_key || invoice.numero_autorizacion;
      const authNumber = invoice.numero_autorizacion || accessKey;
      const authDate = invoice.fecha_autorizacion ? new Date(invoice.fecha_autorizacion) : new Date();
      const rideUrl = invoice.pdf_url || invoice.ride_url || `https://app.datil.co/invoices/${invoice.id || accessKey}/pdf`;
      const xmlUrl = invoice.xml_url || `https://app.datil.co/invoices/${invoice.id || accessKey}/xml`;

      await prisma.order.update({
        where: { id: order.id },
        data: {
          invoiceStatus: "AUTORIZADA",
          invoiceAccessKey: accessKey,
          invoiceAuthNumber: authNumber,
          invoiceAuthDate: authDate,
          invoiceRideUrl: rideUrl,
          invoiceXmlUrl: xmlUrl,
          invoiceErrorMessage: null,
        },
      });

      return {
        success: true,
        status: "AUTORIZADA",
        accessKey,
        authNumber,
        rideUrl,
        xmlUrl,
        message: "Factura confirmada y AUTORIZADA por el SRI",
      };
    }

    return {
      success: true,
      status: "PENDIENTE_SRI",
      message: `Estado actual en SRI: ${estado || "EN_PROCESO"}`,
    };
  } catch (err: any) {
    return {
      success: false,
      status: "PENDIENTE_SRI",
      error: err?.message || "Error al consultar estado en Dátil",
    };
  }
}
