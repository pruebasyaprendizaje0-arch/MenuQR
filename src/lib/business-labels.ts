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
    const custom: CustomLabels = typeof customLabelsRaw === "string" ? JSON.parse(customLabelsRaw) : customLabelsRaw;
    const disabledModules = custom.disabledModules || base.disabledModules || [];

    const items = custom.items || base.items;
    const itemSingle = custom.itemSingle || (items === "Productos" ? "Producto" : items === "Servicios" ? "Servicio" : items === "Platos" ? "Plato" : base.itemSingle);
    const catalogTabTitle = custom.catalogTabTitle || base.catalogTabTitle;
    const subTitle = custom.subTitle || (catalogTabTitle === "Menú Digital" ? "Menú Digital Auténtico" : catalogTabTitle === "Productos" ? "Catálogo Digital de Productos" : `Catálogo Digital de ${items}`);

    return {
      ...base,
      items,
      itemSingle,
      categories: custom.categories || base.categories,
      kitchen: custom.kitchen || base.kitchen,
      table: custom.table || base.table,
      orderButton: custom.orderButton || base.orderButton,
      catalogTabTitle,
      subTitle,
      newItemButton: `+ Nuevo ${itemSingle}`,
      exportExcelButton: `Descargar ${items} (Excel)`,
      itemsPageTitle: `${items} del ${items === "Platos" ? "Menú" : "Catálogo"}`,
      disabledModules,
      showSplitBill: !disabledModules.includes("split-bill") && (custom.showSplitBill ?? base.showSplitBill),
      showRuleta: !disabledModules.includes("ruleta"),
      showSeasons: !disabledModules.includes("seasons"),
      showCoupons: !disabledModules.includes("coupons"),
      showAiSettings: !disabledModules.includes("ai-settings"),
      showCrm: !disabledModules.includes("crm"),
      showInventory: !disabledModules.includes("inventory"),
      inventoryTabTitle: base.inventoryTabTitle,
      stockUnitSingular: base.stockUnitSingular,
      stockUnitPlural: base.stockUnitPlural,
      stockSectionTitle: base.stockSectionTitle,
      topItemTitle: base.topItemTitle,
      topChannelTitle: base.topChannelTitle,
      isGastro: typeKey === "RESTAURANT",
      imageAspectRatio: custom.imageAspectRatio || base.imageAspectRatio || "1:1",
      suggestedAspectRatio: custom.suggestedAspectRatio || custom.imageAspectRatio || base.suggestedAspectRatio || "1:1",
      popularAspectRatio: custom.popularAspectRatio || custom.imageAspectRatio || base.popularAspectRatio || "1:1",
      suggestedSectionTitle: custom.suggestedSectionTitle || base.suggestedSectionTitle,
      suggestedSectionBadge: custom.suggestedSectionBadge || base.suggestedSectionBadge,
      suggestedCardBadge: custom.suggestedCardBadge || base.suggestedCardBadge,
      suggestedSectionSubtitle: custom.suggestedSectionSubtitle || base.suggestedSectionSubtitle,
      suggestedDefaultDesc: custom.suggestedDefaultDesc || base.suggestedDefaultDesc,
    };
  } catch {
    return base;
  }
}
