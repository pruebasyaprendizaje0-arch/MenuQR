export type BusinessType = "RESTAURANT" | "RETAIL" | "SERVICES" | "GENERAL_CATALOG";
export type CatalogMode = "MENU" | "CATALOG";

export interface CustomLabels {
  items?: string;       // Ej: "Productos", "Servicios", "Platos"
  itemSingle?: string;  // Ej: "Producto", "Servicio", "Plato"
  categories?: string;  // Ej: "Colecciones", "Departamentos", "Categorías"
  kitchen?: string;     // Ej: "Pedidos y Despacho", "Comandas de Cocina"
  table?: string;       // Ej: "Referencia de Pedido", "Código de Casillero", "Mesa"
  orderButton?: string; // Ej: "Enviar Pedido por WhatsApp", "Solicitar Cotización"
  catalogTabTitle?: string; // Ej: "Menú Digital", "Productos", "Catálogo de Productos", "Catálogo"
  subTitle?: string;    // Ej: "Menú Digital Auténtico", "Catálogo Digital de Productos"
  disabledModules?: string[]; // Ej: ["split-bill", "ruleta", "seasons", "coupons", "ai-settings", "crm"]
  showSplitBill?: boolean;
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
