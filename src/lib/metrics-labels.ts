import { BusinessVertical } from "@/lib/business-labels";

export interface VerticalMetricLabels {
  vertical: BusinessVertical;
  ordersCountLabel: string;
  ordersCountSublabel: string;
  topItemTitle: string;
  topItemBadge: string;
  topItemEmpty: string;
  topChannelTitle: string;
  topChannelBadge: string;
  topChannelEmpty: string;
  channelsTitle: string;
  channel1Icon: string;
  channel1Label: string;
  channel2Icon: string;
  channel2Label: string;
  channel3Icon: string;
  channel3Label: string;
  isGastro: boolean;
}

export function getVerticalMetricLabels(vertical: BusinessVertical): VerticalMetricLabels {
  switch (vertical) {
    case "retail":
      return {
        vertical: "retail",
        ordersCountLabel: "Ventas Realizadas",
        ordersCountSublabel: "Pedidos despachados",
        topItemTitle: "Producto Estrella ⭐",
        topItemBadge: "Producto",
        topItemEmpty: "Sin ventas registradas",
        topChannelTitle: "Canal de Entrega Líder 📦",
        topChannelBadge: "Entrega",
        topChannelEmpty: "Sin pedidos registrados",
        channelsTitle: "Distribución por Modalidad de Entrega",
        channel1Icon: "🏪",
        channel1Label: "Retiro en Tienda / Local",
        channel2Icon: "🛵",
        channel2Label: "Envío a Domicilio / Courier",
        channel3Icon: "🛍️",
        channel3Label: "Venta por Mostrador / POS",
        isGastro: false,
      };
    case "citas":
      return {
        vertical: "citas",
        ordersCountLabel: "Citas Atendidas",
        ordersCountSublabel: "Turnos completados",
        topItemTitle: "Servicio / Tratamiento Estrella ⭐",
        topItemBadge: "Servicio",
        topItemEmpty: "Sin citas registradas",
        topChannelTitle: "Modalidad / Especialista Líder 👨‍⚕️",
        topChannelBadge: "Especialista",
        topChannelEmpty: "Sin turnos registrados",
        channelsTitle: "Modalidad de Atención",
        channel1Icon: "🩺",
        channel1Label: "Atención en Consultorio",
        channel2Icon: "🚗",
        channel2Label: "Servicio a Domicilio",
        channel3Icon: "💻",
        channel3Label: "Atención Virtual / Online",
        isGastro: false,
      };
    case "reservas":
      return {
        vertical: "reservas",
        ordersCountLabel: "Reservas Confirmadas",
        ordersCountSublabel: "Estadías registradas",
        topItemTitle: "Alojamiento / Cabaña Estrella 🏡",
        topItemBadge: "Cabaña",
        topItemEmpty: "Sin reservas registradas",
        topChannelTitle: "Canal de Reserva Preferido 📱",
        topChannelBadge: "Canal",
        topChannelEmpty: "Sin reservas en el período",
        channelsTitle: "Origen de la Reserva",
        channel1Icon: "🌐",
        channel1Label: "Reserva Web Directa",
        channel2Icon: "📲",
        channel2Label: "WhatsApp / Reserva Directa",
        channel3Icon: "🛎️",
        channel3Label: "Mostrador / Check-In Directo",
        isGastro: false,
      };
    case "servicios":
      return {
        vertical: "servicios",
        ordersCountLabel: "Cotizaciones Atendidas",
        ordersCountSublabel: "Solicitudes de servicio",
        topItemTitle: "Servicio Técnico Estrella 🔧",
        topItemBadge: "Servicio",
        topItemEmpty: "Sin solicitudes registradas",
        topChannelTitle: "Modalidad / Zona Líder 📍",
        topChannelBadge: "Modalidad",
        topChannelEmpty: "Sin visitas registradas",
        channelsTitle: "Distribución del Servicio",
        channel1Icon: "🚐",
        channel1Label: "Visita Técnica a Domicilio",
        channel2Icon: "🛠️",
        channel2Label: "Atención en Taller / Local",
        channel3Icon: "📞",
        channel3Label: "Diagnóstico Express / Remoto",
        isGastro: false,
      };
    case "restaurante":
    default:
      return {
        vertical: "restaurante",
        ordersCountLabel: "Pedidos Atendidos",
        ordersCountSublabel: "Órdenes completadas",
        topItemTitle: "Plato Estrella ⭐",
        topItemBadge: "Plato",
        topItemEmpty: "Sin ventas registradas",
        topChannelTitle: "Mesa Más Activa 🪑",
        topChannelBadge: "Mesa",
        topChannelEmpty: "Sin pedidos en mesa",
        channelsTitle: "Distribución por Canal de Venta",
        channel1Icon: "🪑",
        channel1Label: "Salón / En Mesa",
        channel2Icon: "🛍️",
        channel2Label: "Para Llevar / Retiro",
        channel3Icon: "🛵",
        channel3Label: "A Domicilio (Delivery)",
        isGastro: true,
      };
  }
}
