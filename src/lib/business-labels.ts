import { CustomLabels, BusinessType } from "@/types/business";

export interface ResolvedBusinessLabels {
  items: string;
  itemSingle: string;
  categories: string;
  kitchen: string;
  table: string;
  orderButton: string;
  businessTabTitle: string;
  catalogTabTitle: string;
  subTitle: string;
  newItemButton: string;
  importExcelButton: string;
  exportExcelButton: string;
  itemsPageTitle: string;
  kitchenMonitorBadge: string;
  showSplitBill: boolean;
  showRuleta: boolean;
  showSeasons: boolean;
  showCoupons: boolean;
  showAiSettings: boolean;
  showCrm: boolean;
  showTablesConfig: boolean;
  showInventory: boolean;
  showCajaPos: boolean;
  inventoryTabTitle: string;
  disabledModules: string[];
  stockUnitSingular: string;
  stockUnitPlural: string;
  stockSectionTitle: string;
  topItemTitle: string;
  topChannelTitle: string;
  isGastro: boolean;
  imageAspectRatio: "1:1" | "9:16";
  suggestedAspectRatio: "1:1" | "9:16";
  popularAspectRatio: "1:1" | "9:16";
  suggestedSectionTitle: string;
  suggestedSectionBadge: string;
  suggestedCardBadge: string;
  suggestedSectionSubtitle: string;
  suggestedDefaultDesc: string;
}

const DEFAULTS: Record<BusinessType, ResolvedBusinessLabels> = {
  RESTAURANT: {
    items: "Platos",
    itemSingle: "Plato",
    categories: "Categorías",
    kitchen: "Comandas de Cocina",
    table: "Mesa",
    orderButton: "Pedir a Cocina / Mesa",
    businessTabTitle: "Restaurante",
    catalogTabTitle: "Menú Digital",
    subTitle: "Menú Digital Auténtico",
    newItemButton: "+ Nuevo Plato",
    importExcelButton: "Subida por Lotes (Excel / CSV)",
    exportExcelButton: "Descargar Platos (Excel)",
    itemsPageTitle: "Platos del Menú",
    kitchenMonitorBadge: "COCINA",
    showSplitBill: true,
    showRuleta: true,
    showSeasons: true,
    showCoupons: true,
    showAiSettings: true,
    showCrm: true,
    showTablesConfig: true,
    showInventory: true,
    showCajaPos: true,
    inventoryTabTitle: "Inventario & Insumos",
    disabledModules: [],
    stockUnitSingular: "porción",
    stockUnitPlural: "porciones",
    stockSectionTitle: "Raciones y Disponibilidad del Menú",
    topItemTitle: "Plato Más Vendido",
    topChannelTitle: "Mesa que Más Vende",
    isGastro: true,
    imageAspectRatio: "1:1",
    suggestedAspectRatio: "1:1",
    popularAspectRatio: "1:1",
    suggestedSectionTitle: "Sugerencias del Chef",
    suggestedSectionBadge: "⭐ Plato del Día",
    suggestedCardBadge: "Especial del Día",
    suggestedSectionSubtitle: "Recomendaciones especiales preparadas para hoy",
    suggestedDefaultDesc: "Especialidad sugerida por la casa.",
  },
  RETAIL: {
    items: "Productos",
    itemSingle: "Producto",
    categories: "Colecciones / Departamentos",
    kitchen: "Pedidos y Despacho",
    table: "Código de Casillero / Referencia",
    orderButton: "Enviar Pedido por WhatsApp",
    businessTabTitle: "Negocio",
    catalogTabTitle: "Productos",
    subTitle: "Catálogo Digital de Productos",
    newItemButton: "+ Nuevo Producto",
    importExcelButton: "Subida por Lotes (Excel / CSV)",
    exportExcelButton: "Descargar Productos (Excel)",
    itemsPageTitle: "Productos del Catálogo",
    kitchenMonitorBadge: "DESPACHO",
    showSplitBill: false,
    showRuleta: true,
    showSeasons: true,
    showCoupons: true,
    showAiSettings: true,
    showCrm: true,
    showTablesConfig: false,
    showInventory: true,
    showCajaPos: true,
    inventoryTabTitle: "Bodega & Proveedores",
    disabledModules: ["split-bill"],
    stockUnitSingular: "unidad",
    stockUnitPlural: "unidades",
    stockSectionTitle: "Control de Inventario y Bodega",
    topItemTitle: "Producto Más Vendido",
    topChannelTitle: "Canal Principal de Pedidos",
    isGastro: false,
    imageAspectRatio: "1:1",
    suggestedAspectRatio: "1:1",
    popularAspectRatio: "1:1",
    suggestedSectionTitle: "Recomendados de la Casa",
    suggestedSectionBadge: "⭐ Producto Destacado",
    suggestedCardBadge: "Destacado",
    suggestedSectionSubtitle: "Nuestra mejor selección y recomendaciones para ti",
    suggestedDefaultDesc: "Producto seleccionado por la casa.",
  },
  SERVICES: {
    items: "Servicios",
    itemSingle: "Servicio",
    categories: "Especialidades / Áreas",
    kitchen: "Solicitudes y Citas",
    table: "Referencia de Solicitud",
    orderButton: "Solicitar Cotización por WhatsApp",
    businessTabTitle: "Negocio",
    catalogTabTitle: "Servicios",
    subTitle: "Catálogo Digital de Servicios",
    newItemButton: "+ Nuevo Servicio",
    importExcelButton: "Subida por Lotes (Excel / CSV)",
    exportExcelButton: "Descargar Servicios (Excel)",
    itemsPageTitle: "Servicios Ofrecidos",
    kitchenMonitorBadge: "SOLICITUDES",
    showSplitBill: false,
    showRuleta: true,
    showSeasons: true,
    showCoupons: true,
    showAiSettings: true,
    showCrm: true,
    showTablesConfig: false,
    showInventory: true,
    showCajaPos: true,
    inventoryTabTitle: "Insumos & Proveedores",
    disabledModules: ["split-bill"],
    stockUnitSingular: "cupo",
    stockUnitPlural: "cupos",
    stockSectionTitle: "Disponibilidad y Cupos",
    topItemTitle: "Servicio Más Solicitado",
    topChannelTitle: "Canal Principal de Solicitudes",
    isGastro: false,
    imageAspectRatio: "1:1",
    suggestedAspectRatio: "1:1",
    popularAspectRatio: "1:1",
    suggestedSectionTitle: "Servicios Destacados",
    suggestedSectionBadge: "⭐ Recomendado",
    suggestedCardBadge: "Más Solicitado",
    suggestedSectionSubtitle: "Nuestras opciones y especialidades más solicitadas",
    suggestedDefaultDesc: "Servicio destacado por la casa.",
  },
  GENERAL_CATALOG: {
    items: "Catálogo",
    itemSingle: "Ítem",
    categories: "Categorías",
    kitchen: "Gestión de Pedidos",
    table: "Referencia",
    orderButton: "Consultar por WhatsApp",
    businessTabTitle: "Negocio",
    catalogTabTitle: "Catálogo",
    subTitle: "Catálogo Digital",
    newItemButton: "+ Nuevo Ítem",
    importExcelButton: "Subida por Lotes (Excel / CSV)",
    exportExcelButton: "Descargar Catálogo (Excel)",
    itemsPageTitle: "Ítems del Catálogo",
    kitchenMonitorBadge: "PEDIDOS",
    showSplitBill: false,
    showRuleta: true,
    showSeasons: true,
    showCoupons: true,
    showAiSettings: true,
    showCrm: true,
    showTablesConfig: false,
    showInventory: true,
    showCajaPos: true,
    inventoryTabTitle: "Inventario & Compras",
    disabledModules: ["split-bill"],
    stockUnitSingular: "unidad",
    stockUnitPlural: "unidades",
    stockSectionTitle: "Control de Inventario y Disponibilidad",
    topItemTitle: "Ítem Más Vendido",
    topChannelTitle: "Canal Principal de Pedidos",
    isGastro: false,
    imageAspectRatio: "1:1",
    suggestedAspectRatio: "1:1",
    popularAspectRatio: "1:1",
    suggestedSectionTitle: "Selección Especial",
    suggestedSectionBadge: "⭐ Destacado",
    suggestedCardBadge: "Selección",
    suggestedSectionSubtitle: "Artículos seleccionados especialmente para ti",
    suggestedDefaultDesc: "Ítem destacado del catálogo.",
  },
};

export function getBusinessLabels(
  customLabelsRaw?: string | null,
  businessType: string = "RESTAURANT"
): ResolvedBusinessLabels {
  const typeKey = (businessType.toUpperCase() in DEFAULTS
    ? businessType.toUpperCase()
    : "RESTAURANT") as BusinessType;

  const base = DEFAULTS[typeKey];

  if (!customLabelsRaw) return base;

  try {
    const custom: CustomLabels = typeof customLabelsRaw === "string" ? JSON.parse(customLabelsRaw) : (customLabelsRaw || {});
    const disabledModules = custom.disabledModules || base.disabledModules || [];
    const enabledModules = custom.enabledModules || [];

    const isReservas = custom.vertical === "reservas" || custom.businessSubType === "RESERVAS";
    const isServicios = custom.vertical === "servicios" || custom.businessSubType === "SERVICIOS";
    const isCitas = custom.vertical === "citas" || custom.businessSubType === "CITAS";
    const isRetail = custom.vertical === "catalogo" || custom.vertical === "retail" || custom.businessSubType === "RETAIL" || typeKey === "RETAIL";

    const defaultItems = isReservas
      ? "Cabañas / Habitaciones"
      : isServicios
      ? "Servicios Técnicos"
      : isCitas
      ? "Servicios / Citas"
      : isRetail
      ? "Productos"
      : base.items;

    const defaultItemSingle = isReservas
      ? "Habitación"
      : isServicios
      ? "Servicio Técnico"
      : isCitas
      ? "Servicio"
      : isRetail
      ? "Producto"
      : (base.itemSingle || "Producto");

    const defaultCategories = isReservas
      ? "Tipos de Alojamiento"
      : isServicios
      ? "Áreas / Especialidades"
      : isCitas
      ? "Especialidades / Tratamientos"
      : isRetail
      ? "Colecciones / Categorías"
      : base.categories;

    const items = custom.items || defaultItems;
    const itemSingle = custom.itemSingle || defaultItemSingle;
    const categories = custom.categories || defaultCategories;

    const businessTabTitle = isReservas ? "Hospedaje" : isServicios ? "Empresa" : isCitas ? "Centro / Clínica" : isRetail ? "Tienda" : base.businessTabTitle;
    const catalogTabTitle = custom.catalogTabTitle || (isReservas ? "Hospedaje" : isServicios ? "Cotizador Express" : isCitas ? "Citas & Turnos" : isRetail ? "Productos" : base.catalogTabTitle);
    const subTitle = custom.subTitle || (
      isReservas ? "Catálogo de Hospedaje y Cabañas" :
      isServicios ? "Catálogo de Servicios Técnicos" :
      isCitas ? "Catálogo de Servicios y Citas Online" :
      isRetail ? "Catálogo Digital de Productos" :
      (catalogTabTitle === "Menú Digital" ? "Menú Digital Auténtico" : catalogTabTitle === "Productos" ? "Catálogo Digital de Productos" : `Catálogo Digital de ${items}`)
    );
    const inventoryTabTitle = isReservas ? "Insumos & Blancos" : isServicios ? "Herramientas & Repuestos" : isCitas ? "Insumos & Productos" : isRetail ? "Bodega & Stock" : base.inventoryTabTitle;
    const stockSectionTitle = isReservas ? "Disponibilidad y Noches" : isServicios ? "Capacidad y Disponibilidad" : isCitas ? "Capacidad y Turnos Diarios" : isRetail ? "Control de Inventario y Bodega" : base.stockSectionTitle;
    const topItemTitle = isReservas ? "Habitación Más Reservada" : isServicios ? "Servicio Más Cotizado" : isCitas ? "Servicio Más Agendado" : isRetail ? "Producto Más Vendido" : base.topItemTitle;
    const topChannelTitle = isReservas ? "Canal Principal de Reservas" : isServicios ? "Canal Principal de Cotizaciones" : isCitas ? "Canal Principal de Citas" : isRetail ? "Canal Principal de Pedidos" : base.topChannelTitle;
    const stockUnitSingular = isReservas ? "noche" : isServicios ? "trabajo" : isCitas ? "turno" : isRetail ? "unidad" : base.stockUnitSingular;
    const stockUnitPlural = isReservas ? "noches" : isServicios ? "trabajos" : isCitas ? "turnos" : isRetail ? "unidades" : base.stockUnitPlural;

    // Modular Hybrid: checks if tables/gastro is enabled or forced
    const hasGastroForced = enabledModules.includes("tables") || enabledModules.includes("gastro");
    const isGastroDisabled = disabledModules.includes("tables") || disabledModules.includes("gastro");
    const isGastro = !isGastroDisabled && (hasGastroForced || (typeKey === "RESTAURANT" && !isReservas && !isServicios && !isCitas && !isRetail));
    const showTablesConfig = isGastro;
    const showSplitBill = !disabledModules.includes("split-bill") && (hasGastroForced || (isGastro && (custom.showSplitBill ?? base.showSplitBill)));

    return {
      ...base,
      items,
      itemSingle,
      categories,
      kitchen: custom.kitchen || (
        isReservas ? "Reservas y Estadías" :
        isServicios ? "Cotizaciones y Solicitudes" :
        isCitas ? "Agenda y Turnos" :
        isRetail ? "Pedidos y Despacho" :
        base.kitchen
      ),
      table: custom.table || (
        isReservas ? "Código / Habitación" :
        isServicios ? "Referencia de Trabajo" :
        isCitas ? "Box / Sillón / Consultorio" :
        isRetail ? "Referencia / Casillero" :
        base.table
      ),
      orderButton: custom.orderButton || (
        isReservas ? "Solicitar Reserva por WhatsApp" :
        isServicios ? "Solicitar Cotización por WhatsApp" :
        isCitas ? "Agendar Cita por WhatsApp" :
        isRetail ? "Pedir por WhatsApp" :
        base.orderButton
      ),
      businessTabTitle,
      catalogTabTitle,
      subTitle,
      newItemButton: `+ Nuevo ${itemSingle}`,
      exportExcelButton: `Descargar ${items} (Excel)`,
      itemsPageTitle: `${items} del ${items === "Platos" ? "Menú" : "Catálogo"}`,
      disabledModules,
      showSplitBill,
      showRuleta: !disabledModules.includes("ruleta"),
      showSeasons: !disabledModules.includes("seasons"),
      showCoupons: !disabledModules.includes("coupons"),
      showAiSettings: !disabledModules.includes("ai-settings"),
      showCrm: !disabledModules.includes("crm"),
      showInventory: !disabledModules.includes("inventory"),
      showCajaPos: !disabledModules.includes("caja"),
      showTablesConfig,
      inventoryTabTitle,
      stockUnitSingular,
      stockUnitPlural,
      stockSectionTitle,
      topItemTitle,
      topChannelTitle,
      isGastro,
      imageAspectRatio: custom.imageAspectRatio || base.imageAspectRatio || "1:1",
      suggestedAspectRatio: custom.suggestedAspectRatio || custom.imageAspectRatio || base.suggestedAspectRatio || "1:1",
      popularAspectRatio: custom.popularAspectRatio || custom.imageAspectRatio || base.popularAspectRatio || "1:1",
      suggestedSectionTitle: custom.suggestedSectionTitle || (
        isReservas ? "Hospedajes Destacados" :
        isServicios ? "Servicios Destacados" :
        isCitas ? "Tratamientos Recomendados" :
        isRetail ? "Productos Destacados" :
        base.suggestedSectionTitle
      ),
      suggestedSectionBadge: custom.suggestedSectionBadge || (
        isReservas ? "⭐ Recomendado" :
        isServicios ? "⭐ Destacado" :
        isCitas ? "⭐ Popular" :
        isRetail ? "⭐ Destacado" :
        base.suggestedSectionBadge
      ),
      suggestedCardBadge: custom.suggestedCardBadge || (
        isReservas ? "Más Solicitado" :
        isServicios ? "Más Cotizado" :
        isCitas ? "Más Solicitado" :
        isRetail ? "Más Vendido" :
        base.suggestedCardBadge
      ),
      suggestedSectionSubtitle: custom.suggestedSectionSubtitle || base.suggestedSectionSubtitle,
      suggestedDefaultDesc: custom.suggestedDefaultDesc || base.suggestedDefaultDesc,
    };
  } catch {
    return base;
  }
}

export type BusinessVertical = "restaurante" | "retail" | "reservas" | "citas" | "servicios";

/**
 * Resuelve de forma robusta la vertical de negocio activa:
 * 1. Prioriza configuración explícita en customLabels (vertical o businessSubType)
 * 2. Si no está configurada, detecta por palabras clave en nombre / especialidad (hostal, cabaña, hotel, etc.)
 * 3. Fallback según el businessType de la base de datos (SERVICES -> citas, RETAIL -> retail, RESTAURANT -> restaurante)
 */
export function resolveBusinessVertical(restaurant: {
  businessType?: string | null;
  name?: string | null;
  specialty?: string | null;
  description?: string | null;
  customLabels?: any;
}): BusinessVertical {
  let custom: any = {};
  if (restaurant.customLabels) {
    try {
      custom = typeof restaurant.customLabels === "string" ? JSON.parse(restaurant.customLabels) : restaurant.customLabels;
    } catch {}
  }

  // 1. Configuración explícita en customLabels
  if (custom.vertical === "reservas" || custom.businessSubType === "RESERVAS") return "reservas";
  if (custom.vertical === "servicios" || custom.businessSubType === "SERVICIOS" || custom.businessSubType === "TECNICO") return "servicios";
  if (custom.vertical === "citas" || custom.businessSubType === "CITAS") return "citas";
  if (custom.vertical === "retail" || custom.businessSubType === "RETAIL" || custom.businessSubType === "CATALOGO") return "retail";
  if (custom.vertical === "restaurante" || custom.businessSubType === "RESTAURANTE") return "restaurante";

  // 2. Detección inteligente por nombre / especialidad / descripción si no está definido
  const corpus = `${restaurant.name || ""} ${restaurant.specialty || ""} ${restaurant.description || ""}`.toLowerCase();
  if (
    corpus.includes("hostal") ||
    corpus.includes("hotel") ||
    corpus.includes("cabaña") ||
    corpus.includes("cabana") ||
    corpus.includes("glamping") ||
    corpus.includes("hospedaje") ||
    corpus.includes("lodge") ||
    corpus.includes("resort")
  ) {
    return "reservas";
  }

  if (
    corpus.includes("plomer") ||
    corpus.includes("electric") ||
    corpus.includes("tecnic") ||
    corpus.includes("técnic") ||
    corpus.includes("reparaci") ||
    corpus.includes("mantenimiento") ||
    corpus.includes("taller")
  ) {
    return "servicios";
  }

  // 3. Fallback por enum BusinessType
  if (restaurant.businessType === "SERVICES") {
    return "citas";
  }

  if (restaurant.businessType === "RETAIL" || restaurant.businessType === "GENERAL_CATALOG") {
    return "retail";
  }

  return "restaurante";
}
