export type BusinessType = "RESTAURANT" | "RETAIL" | "SERVICES" | "GENERAL_CATALOG";
export type CatalogMode = "MENU" | "CATALOG";

export type ImageAspectRatio = "1:1" | "9:16";
export type CategoryImageAspectRatio = "DEFAULT" | "1:1" | "9:16";

export interface CustomLabels {
  items?: string;       // Ej: "Productos", "Servicios", "Platos"
  itemSingle?: string;  // Ej: "Producto", "Servicio", "Plato"
  categories?: string;  // Ej: "Colecciones", "Departamentos", "Categorías"
  kitchen?: string;     // Ej: "Pedidos y Despacho", "Comandas de Cocina"
  table?: string;       // Ej: "Referencia de Pedido", "Código de Casillero", "Mesa"
  orderButton?: string; // Ej: "Enviar Pedido por WhatsApp", "Solicitar Cotización"
  catalogTabTitle?: string; // Ej: "Menú Digital", "Productos", "Catálogo de Productos", "Catálogo"
  subTitle?: string;    // Ej: "Menú Digital Auténtico", "Catálogo Digital de Productos"
  vertical?: string;    // "menuqr" | "catalogo" | "servicios" | "citas" | "reservas"
  businessSubType?: string; // "RESTAURANT" | "RETAIL" | "SERVICIOS" | "CITAS" | "RESERVAS"
  enabledModules?: string[]; // Ej: ["tables", "reservas", "citas", "cotizador", "ecommerce"]
  disabledModules?: string[]; // Ej: ["tables", "split-bill", "ruleta", "seasons", "coupons", "crm"]
  showSplitBill?: boolean;
  imageAspectRatio?: ImageAspectRatio; // "1:1" (Estándar/Horizontal) o "9:16" (Vertical/Reels/Botellas)
  suggestedAspectRatio?: ImageAspectRatio; // Formato para platos sugeridos / especial del día
  popularAspectRatio?: ImageAspectRatio; // Formato para platos más populares
  suggestedSectionTitle?: string;    // Ej: "Sugerencias del Chef", "Recomendados de la Casa"
  suggestedSectionBadge?: string;    // Ej: "⭐ Plato del Día", "⭐ Producto Destacado"
  suggestedCardBadge?: string;       // Ej: "Especial del Día", "Destacado"
  suggestedSectionSubtitle?: string; // Ej: "Recomendaciones especiales preparadas para hoy"
  suggestedDefaultDesc?: string;     // Ej: "Especialidad sugerida por la casa."
  kitchenPin?: string;               // PIN de 4-6 dígitos para acceso a Cocina KDS
  kitchenPinRequired?: boolean;      // Requerir PIN obligatorio al entrar a Cocina KDS
  waiterPinRequired?: boolean;       // Requerir PIN obligatorio al entrar a Módulo Mesero
}

export interface ProductVariant {
  name: string;      // Ej: "Talla", "Color", "Presentación"
  options: string[]; // Ej: ["S", "M", "L"]
}

export interface BusinessConfig {
  businessType: BusinessType;
  catalogMode: CatalogMode;
  enableTableOrdering: boolean;
  enableDelivery: boolean;
  enablePickup: boolean;
  customLabels?: CustomLabels | null;
}
