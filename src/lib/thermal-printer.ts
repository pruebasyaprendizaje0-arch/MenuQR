import QRCode from "qrcode";

export interface ThermalTicketItem {
  id?: string;
  dishName: string;
  quantity: number;
  price: number;
}

export interface ThermalTicketInvoiceData {
  status?: string | null;         // "AUTORIZADA", "PENDIENTE_SRI", "RECHAZADA_SRI", etc.
  accessKey?: string | null;      // Clave de acceso de 49 dígitos
  authNumber?: string | null;     // Número de autorización
  authDate?: string | Date | null;
  sequential?: string | null;     // 001-001-000000001
  customerDoc?: string | null;    // Cédula / RUC / Pasaporte
  customerDocType?: string | null;// "04", "05", "06", "07"
  customerEmail?: string | null;
  customerAddress?: string | null;
  ruc?: string | null;            // RUC emisor
  razonSocial?: string | null;    // Razón social emisor
  direccionMatriz?: string | null;
  regimen?: string | null;
  obligadoContabilidad?: boolean | null;
}

export interface ThermalTicketData {
  order: {
    id: string;
    orderNumber?: number | string | null;
    createdAt?: string | Date | null;
    items?: ThermalTicketItem[];
    subtotal?: number;
    iva?: number;
    serviceCharge?: number;
    deliveryCost?: number;
    discountAmount?: number;
    depositDiscount?: number;
    total: number;
    tableName?: string | null;
    paymentMethod?: string | null;
    customerName?: string | null;
    customerPhone?: string | null;
    customerAddress?: string | null;
    notes?: string | null;
  };
  restaurant: {
    name: string;
    phone?: string | null;
    address?: string | null;
    ruc?: string | null;
    razonSocial?: string | null;
    city?: string | null;
  };
  invoice?: ThermalTicketInvoiceData | null;
  paperWidth?: "80mm" | "58mm";
}

/**
 * Genera el documento HTML completo para impresión térmica
 */
export async function generateThermalTicketHtml(data: ThermalTicketData): Promise<string> {
  const { order, restaurant, invoice, paperWidth = "80mm" } = data;
  const is58mm = paperWidth === "58mm";
  const bodyWidth = is58mm ? "54mm" : "76mm";
  const fontSize = is58mm ? "10px" : "11px";

  // Formato de fecha
  const orderDate = order.createdAt ? new Date(order.createdAt) : new Date();
  const formattedDate = orderDate.toLocaleString("es-EC", {
    dateStyle: "short",
    timeStyle: "short",
  });

  // Generar QR en base64 si hay clave de acceso o URL RIDE
  let qrDataUrl = "";
  if (invoice?.accessKey && invoice.status === "AUTORIZADA") {
    try {
      qrDataUrl = await QRCode.toDataURL(invoice.accessKey, {
        width: is58mm ? 120 : 140,
        margin: 1,
        color: { dark: "#000000", light: "#ffffff" },
      });
    } catch (e) {
      console.error("Error generando QR para ticket térmico:", e);
    }
  }

  // Canal de venta
  const channelLabel =
    order.tableName === "Llevar"
      ? "🛍 PARA LLEVAR"
      : order.tableName === "Domicilio"
      ? "🛵 A DOMICILIO"
      : order.tableName
      ? `🪑 MESA #${order.tableName}`
      : "🛍 MOSTRADOR";

  // Desglose de impuestos y totales
  const subtotal = Number(order.subtotal || order.total || 0);
  const iva = Number(order.iva || 0);
  const service = Number(order.serviceCharge || 0);
  const delivery = Number(order.deliveryCost || 0);
  const discount = Number(order.discountAmount || 0) + Number(order.depositDiscount || 0);
  const total = Number(order.total || 0);

  // Datos del emisor si hay facturación
  const emisorRuc = invoice?.ruc || restaurant.ruc || "";
  const emisorRazon = invoice?.razonSocial || restaurant.razonSocial || restaurant.name;
  const emisorDir = invoice?.direccionMatriz || restaurant.address || "";

  // Régimen tributario SRI
  let regimenText = "";
  if (invoice?.regimen === "RIMPE_EMPRENDEDOR") {
    regimenText = "CONTRIBUYENTE RÉGIMEN RIMPE EMPRENDEDOR";
  } else if (invoice?.regimen === "RIMPE_POPULAR") {
    regimenText = "CONTRIBUYENTE NEGOCIO POPULAR - RÉGIMEN RIMPE";
  }

  return `
    <!DOCTYPE html>
    <html lang="es">
      <head>
        <meta charset="utf-8"/>
        <title>Ticket #${order.orderNumber || order.id.slice(0, 6)}</title>
        <style>
          @page {
            margin: 0;
            size: ${paperWidth} auto;
          }
          * {
            box-sizing: border-box;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Courier New", Courier, monospace;
            width: ${bodyWidth};
            margin: 0 auto;
            padding: 8px 4px;
            color: #000;
            font-size: ${fontSize};
            line-height: 1.25;
            background: #fff;
          }
          .center { text-align: center; }
          .right { text-align: right; }
          .bold { font-weight: bold; }
          .uppercase { text-transform: uppercase; }
          .dashed { border-top: 1px dashed #000; margin: 5px 0; }
          .double { border-top: 2px solid #000; margin: 5px 0; }
          .flex { display: flex; justify-content: space-between; align-items: flex-start; }
          .title { font-size: ${is58mm ? "13px" : "15px"}; font-weight: bold; line-height: 1.2; }
          .subtitle { font-size: 10px; margin-top: 2px; }
          .badge {
            font-size: 11px;
            font-weight: bold;
            border: 1.5px solid #000;
            padding: 2px 6px;
            display: inline-block;
            margin: 3px 0;
            border-radius: 4px;
          }
          .sri-box {
            border: 1px solid #000;
            padding: 4px;
            margin: 4px 0;
            font-size: 9px;
            line-height: 1.2;
            word-break: break-all;
          }
          .item-row {
            display: flex;
            justify-content: space-between;
            margin: 3px 0;
            font-size: ${fontSize};
          }
          .item-name {
            max-width: ${is58mm ? "36mm" : "52mm"};
            word-break: break-word;
          }
          .total-row {
            font-size: ${is58mm ? "13px" : "15px"};
            font-weight: bold;
            margin: 4px 0;
          }
          .qr-container {
            margin: 6px auto;
            text-align: center;
          }
          .qr-img {
            max-width: ${is58mm ? "110px" : "130px"};
            height: auto;
            display: block;
            margin: 0 auto;
          }
          @media print {
            body { width: 100%; padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="center">
          <div class="title uppercase">${restaurant.name}</div>
          ${emisorRazon && emisorRazon !== restaurant.name ? `<div class="subtitle bold">${emisorRazon}</div>` : ""}
          ${emisorRuc ? `<div class="bold">R.U.C.: ${emisorRuc}</div>` : ""}
          ${emisorDir ? `<div class="subtitle">${emisorDir}</div>` : ""}
          ${restaurant.phone ? `<div class="subtitle">Tel: ${restaurant.phone}</div>` : ""}
          ${regimenText ? `<div class="subtitle bold" style="font-size: 8px; margin-top: 2px;">${regimenText}</div>` : ""}
          ${invoice?.obligadoContabilidad ? `<div class="subtitle" style="font-size: 8px;">OBLIGADO A LLEVAR CONTABILIDAD: SÍ</div>` : ""}

          <div class="badge uppercase">${channelLabel}</div>
          <div class="bold" style="font-size: 12px;">TICKET #${order.orderNumber || order.id.slice(0, 6)}</div>
          <div class="subtitle">${formattedDate}</div>
        </div>

        <div class="dashed"></div>

        ${
          invoice?.status === "AUTORIZADA"
            ? `
          <div class="sri-box">
            <div class="bold center" style="font-size: 10px;">FACTURA ELECTRÓNICA</div>
            <div class="center bold">Nº: ${invoice.sequential || "001-001-000000000"}</div>
            <div><strong>AUTORIZACIÓN SRI:</strong></div>
            <div style="font-size: 8px; font-family: monospace;">${invoice.authNumber || invoice.accessKey || ""}</div>
            <div><strong>CLAVE DE ACCESO:</strong></div>
            <div style="font-size: 8px; font-family: monospace;">${invoice.accessKey || ""}</div>
            ${invoice.authDate ? `<div><strong>FECHA AUTORIZACIÓN:</strong> ${new Date(invoice.authDate).toLocaleString("es-EC")}</div>` : ""}
          </div>
          <div class="dashed"></div>
        `
            : invoice?.status === "PENDIENTE_SRI"
            ? `
          <div class="sri-box center">
            <div class="bold" style="font-size: 9px;">*** COMPROBANTE EN PROCESO SRI ***</div>
            ${invoice.sequential ? `<div>Secuencial: <strong>${invoice.sequential}</strong></div>` : ""}
            <div style="font-size: 8px; margin-top: 2px;">En proceso de validación y autorización del SRI. Su factura electrónica será enviada por correo.</div>
          </div>
          <div class="dashed"></div>
        `
            : ""
        }

        <!-- Datos del Cliente -->
        <div>
          <div><strong>Cliente:</strong> ${invoice?.customerDoc ? (order.customerName || "Cliente") : (order.customerName || "Consumidor Final")}</div>
          ${invoice?.customerDoc ? `<div><strong>Identificación:</strong> ${invoice.customerDoc}</div>` : ""}
          ${invoice?.customerEmail ? `<div><strong>Email:</strong> ${invoice.customerEmail}</div>` : ""}
          ${order.customerPhone ? `<div><strong>Teléfono:</strong> ${order.customerPhone}</div>` : ""}
          ${order.customerAddress ? `<div><strong>Dirección:</strong> ${order.customerAddress}</div>` : ""}
          <div><strong>Forma de Pago:</strong> ${order.paymentMethod || "Efectivo"}</div>
        </div>

        <div class="dashed"></div>

        <!-- Encabezado de Productos -->
        <div class="bold flex" style="font-size: 9px; text-transform: uppercase;">
          <span>CANT / DESCRIPCIÓN</span>
          <span>TOTAL</span>
        </div>
        <div class="dashed"></div>

        <!-- Lista de Productos -->
        ${(order.items || [])
          .map(
            (it) => `
          <div class="item-row">
            <span class="item-name"><strong>${it.quantity}x</strong> ${it.dishName}</span>
            <span class="right bold">$${(it.price * it.quantity).toFixed(2)}</span>
          </div>
        `
          )
          .join("")}

        <div class="dashed"></div>

        <!-- Totales -->
        <div class="flex"><span>Subtotal:</span><span>$${subtotal.toFixed(2)}</span></div>
        ${delivery > 0 ? `<div class="flex"><span>Envío / Delivery:</span><span>+$${delivery.toFixed(2)}</span></div>` : ""}
        ${discount > 0 ? `<div class="flex"><span>Descuento:</span><span>-$${discount.toFixed(2)}</span></div>` : ""}
        ${iva > 0 ? `<div class="flex"><span>IVA (15%):</span><span>+$${iva.toFixed(2)}</span></div>` : ""}
        ${service > 0 ? `<div class="flex"><span>Servicio:</span><span>+$${service.toFixed(2)}</span></div>` : ""}

        <div class="double"></div>
        <div class="flex total-row">
          <span>TOTAL:</span>
          <span>$${total.toFixed(2)}</span>
        </div>
        <div class="dashed"></div>

        ${
          qrDataUrl
            ? `
          <div class="qr-container">
            <img class="qr-img" src="${qrDataUrl}" alt="QR Clave de Acceso SRI" />
            <div style="font-size: 8px; margin-top: 2px;">Consulta tu comprobante en el portal del SRI</div>
          </div>
          <div class="dashed"></div>
        `
            : ""
        }

        <div class="center" style="font-size: 9px; margin-top: 6px;">
          ¡Gracias por su compra!<br/>
          Comprobante emitido con <strong>MenuQR Pro</strong>
        </div>
      </body>
    </html>
  `;
}

/**
 * Abre el diálogo de impresión del navegador con el ticket térmico renderizado
 */
export async function printThermalTicket(data: ThermalTicketData): Promise<void> {
  const html = await generateThermalTicketHtml(data);
  const printWindow = window.open("", "_blank", "width=420,height=680");
  if (!printWindow) {
    alert("Por favor habilita las ventanas emergentes (pop-ups) en tu navegador para imprimir el ticket.");
    return;
  }

  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();

  setTimeout(() => {
    printWindow.print();
    printWindow.close();
  }, 300);
}
