"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Boxes,
  Package,
  PackagePlus,
  PackageCheck,
  Truck,
  Phone,
  MessageCircle,
  FileText,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Plus,
  Edit3,
  Trash2,
  Search,
  Barcode,
  Calculator,
  ChefHat,
  Wine,
  Coffee,
  ArrowRight,
  Layers,
  Copy,
  X,
  Filter,
  DollarSign,
  Calendar,
  Sparkles,
  ShoppingBag,
  RefreshCw,
  Download,
  FileSpreadsheet
} from "lucide-react";
import * as XLSX from "xlsx";
import { getBusinessLabels, ResolvedBusinessLabels } from "@/lib/business-labels";
import {
  getInventoryDataAction,
  createSupplierAction,
  updateSupplierAction,
  deleteSupplierAction,
  createSupplyItemAction,
  updateSupplyItemAction,
  deleteSupplyItemAction,
  adjustInventoryStockAction,
  setInventoryStockAction,
  saveDishRecipeAction,
  createPurchaseOrderAction,
  receivePurchaseOrderAction,
  cancelPurchaseOrderAction,
  updateDishInventoryAction,
  enableUniversalStockAction,
} from "@/lib/inventory-actions";
import BatchInventoryModal from "./BatchInventoryModal";
import QuickEditDishInventoryModal from "./QuickEditDishInventoryModal";

interface InventoryAdminTabProps {
  restaurant: {
    id: string;
    name: string;
    slug: string;
    themeColor?: string;
    customLabels?: string | null;
    businessType?: any;
    [key: string]: any;
  };
}

type SubTab = "stock" | "suppliers" | "purchases" | "recipes";

export default function InventoryAdminTab({ restaurant }: InventoryAdminTabProps) {
  const bLabels = useMemo(
    () => getBusinessLabels(restaurant.customLabels, restaurant.businessType),
    [restaurant.customLabels, restaurant.businessType]
  );

  const [activeSubTab, setActiveSubTab] = useState<SubTab>("stock");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Datos cargados desde el servidor
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [supplyItems, setSupplyItems] = useState<any[]>([]);
  const [dishes, setDishes] = useState<any[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);

  // Filtros y búsquedas
  const [searchQuery, setSearchQuery] = useState("");
  const [stockStatusFilter, setStockStatusFilter] = useState<"ALL" | "LOW" | "OUT">("ALL");

  // Modales
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<any | null>(null);

  const [isSupplyModalOpen, setIsSupplyModalOpen] = useState(false);
  const [editingSupply, setEditingSupply] = useState<any | null>(null);

  const [isPoModalOpen, setIsPoModalOpen] = useState(false);
  const [isRecipeModalOpen, setIsRecipeModalOpen] = useState(false);
  const [recipeDish, setRecipeDish] = useState<any | null>(null);

  const [isWasteModalOpen, setIsWasteModalOpen] = useState(false);
  const [wasteItem, setWasteItem] = useState<{ type: "DISH" | "SUPPLY"; item: any } | null>(null);
  const [wasteQty, setWasteQty] = useState(1);
  const [wasteReason, setWasteReason] = useState("Vencido / Caducado");

  // Modales de carga masiva y edición rápida
  const [isBatchInventoryModalOpen, setIsBatchInventoryModalOpen] = useState(false);
  const [quickEditDish, setQuickEditDish] = useState<any | null>(null);

  // Exportar todo el documento de inventario a Excel
  const handleExportInventoryExcel = () => {
    try {
      const wb = XLSX.utils.book_new();

      // HOJA 1: Catálogo de Venta / Existencias
      const dishesRows = dishes.map((d) => {
        const stock = typeof d.stock === "number" ? d.stock : (d.trackStock ? 0 : "Sin límite");
        const minStock = typeof d.minStock === "number" ? d.minStock : 0;
        const cost = typeof d.costPrice === "number" ? d.costPrice : 0;
        const price = typeof d.price === "number" ? d.price : 0;
        const profitMarginPct = price > 0 ? Number((((price - cost) / price) * 100).toFixed(1)) : 0;
        const unitProfit = price > 0 ? Number((price - cost).toFixed(2)) : 0;
        const totalCostInventory = typeof stock === "number" ? Number((stock * cost).toFixed(2)) : 0;
        const totalRetailProjected = typeof stock === "number" ? Number((stock * price).toFixed(2)) : 0;

        return {
          ID: d.id,
          Categoria: d.category?.name || "General",
          Nombre: d.name,
          Codigo_Barras_SKU: d.barcode || d.sku || "",
          Stock_Actual: stock,
          Stock_Minimo: minStock,
          Controla_Stock: d.trackStock ? "SI" : "NO",
          Costo_Compra: cost,
          Precio_Venta: price,
          Margen_Porcentaje: profitMarginPct + "%",
          Ganancia_Unitaria: unitProfit,
          Valor_Total_Bodega_Costo: totalCostInventory,
          Valor_Proyectado_Venta: totalRetailProjected,
          Proveedor_Habitual: d.supplier?.name || "No asignado",
          Telefono_Proveedor: d.supplier?.phone || "",
          Disponible: d.isAvailable ? "SI" : "NO",
        };
      });

      const wsDishes = XLSX.utils.json_to_sheet(dishesRows);
      wsDishes["!cols"] = [
        { wch: 38 },
        { wch: 18 },
        { wch: 32 },
        { wch: 20 },
        { wch: 14 },
        { wch: 14 },
        { wch: 14 },
        { wch: 14 },
        { wch: 14 },
        { wch: 18 },
        { wch: 16 },
        { wch: 24 },
        { wch: 22 },
        { wch: 24 },
        { wch: 18 },
        { wch: 12 },
      ];
      XLSX.utils.book_append_sheet(wb, wsDishes, "Catalogo_Venta");

      // HOJA 2: Insumos & Materia Prima
      const suppliesRows = supplyItems.map((s) => {
        const stock = Number(s.currentStock) || 0;
        const cost = Number(s.costPerUnit) || 0;
        return {
          ID: s.id,
          Insumo: s.name,
          Unidad_Medida: s.unit || "unidad",
          Stock_Actual: stock,
          Stock_Minimo: Number(s.minStock) || 0,
          Costo_Unitario: cost,
          Valor_Total_Insumo: Number((stock * cost).toFixed(2)),
          Proveedor_Habitual: s.supplier?.name || "No asignado",
          Telefono_Proveedor: s.supplier?.phone || "",
        };
      });
      const wsSupplies = XLSX.utils.json_to_sheet(suppliesRows);
      wsSupplies["!cols"] = [
        { wch: 38 },
        { wch: 28 },
        { wch: 15 },
        { wch: 14 },
        { wch: 14 },
        { wch: 15 },
        { wch: 18 },
        { wch: 24 },
        { wch: 18 },
      ];
      XLSX.utils.book_append_sheet(wb, wsSupplies, "Insumos_MateriaPrima");

      // HOJA 3: Directorio de Proveedores
      const suppliersRows = suppliers.map((sup) => ({
        ID: sup.id,
        Nombre_Proveedor: sup.name,
        Contacto: sup.contactName || "",
        Telefono_WhatsApp: sup.phone || "",
        Email: sup.email || "",
        RUC_NIT: sup.taxId || "",
        Direccion: sup.address || "",
        Notas: sup.notes || "",
        Items_Vinculados: sup._count?.dishes || 0,
      }));
      const wsSuppliers = XLSX.utils.json_to_sheet(suppliersRows);
      wsSuppliers["!cols"] = [
        { wch: 38 },
        { wch: 26 },
        { wch: 20 },
        { wch: 18 },
        { wch: 24 },
        { wch: 16 },
        { wch: 28 },
        { wch: 30 },
        { wch: 16 },
      ];
      XLSX.utils.book_append_sheet(wb, wsSuppliers, "Directorio_Proveedores");

      // HOJA 4: Resumen Financiero
      const summaryRows = [
        { Metrica: "Capital Total en Bodega (Costo)", Valor: `$${inventoryMetrics.totalCostValue.toFixed(2)}` },
        { Metrica: "Valor Proyectado Total de Venta", Valor: `$${inventoryMetrics.totalRetailValue.toFixed(2)}` },
        { Metrica: "Margen Bruto Promedio Estimado", Valor: `${inventoryMetrics.estimatedMargin}%` },
        { Metrica: "Ítems con Stock Crítico (Bajo Mínimo)", Valor: inventoryMetrics.lowStockCount },
        { Metrica: "Ítems Agotados (Quiebre de Stock)", Valor: inventoryMetrics.outOfStockCount },
        { Metrica: "Total Ítems en Catálogo de Venta", Valor: dishes.length },
        { Metrica: "Total Insumos / Materias Primas", Valor: supplyItems.length },
        { Metrica: "Total Proveedores Registrados", Valor: suppliers.length },
        { Metrica: "Fecha de Generación del Informe", Valor: new Date().toLocaleString() },
      ];
      const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
      wsSummary["!cols"] = [{ wch: 42 }, { wch: 25 }];
      XLSX.utils.book_append_sheet(wb, wsSummary, "Resumen_Financiero");

      const fileDate = new Date().toISOString().split("T")[0];
      const fileName = `Inventario_MenuQR_${restaurant.slug}_${fileDate}.xlsx`;
      XLSX.writeFile(wb, fileName);
    } catch (err: any) {
      console.error("Error al exportar inventario a Excel:", err);
      alert("Error al generar el archivo Excel: " + (err.message || "desconocido"));
    }
  };

  // Carga inicial de datos
  const loadInventory = async (isSilent: boolean = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);

    try {
      const res = await getInventoryDataAction(restaurant.id);
      if (res.success) {
        setSuppliers(res.suppliers || []);
        setSupplyItems(res.supplyItems || []);
        setDishes(res.dishes || []);
        setPurchaseOrders(res.purchaseOrders || []);
      } else if (res.error) {
        console.error("Error al cargar inventario:", res.error);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const [isEnablingUniversalStock, setIsEnablingUniversalStock] = useState(false);

  const handleEnableUniversalStock = async () => {
    const confirmed = window.confirm(
      "¿Deseas activar el control de stock universal en todo tu catálogo?\n\n" +
      "• Todos los productos 'Sin límite' pasarán a estar estrictamente controlados.\n" +
      "• Cuando cualquier producto llegue a 0 unidades, se bloqueará su venta automáticamente en la web y en Caja POS.\n" +
      "• Podrás ajustar las unidades iniciales con los botones + / - o editando cada ítem."
    );
    if (!confirmed) return;

    setIsEnablingUniversalStock(true);
    try {
      const res = await enableUniversalStockAction(restaurant.id);
      if (res?.success) {
        alert(`¡Listo! Se activó el control de stock universal en ${res.updatedCount} productos.`);
        loadInventory();
      } else {
        alert(res?.error || "Error al activar el control de stock.");
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setIsEnablingUniversalStock(false);
    }
  };

  useEffect(() => {
    loadInventory();

    // Auto-actualización periódica en segundo plano cada 15 segundos
    const interval = setInterval(() => {
      loadInventory(true);
    }, 15000);

    // Actualización inmediata al volver a enfocar la pestaña del navegador
    const handleFocus = () => {
      loadInventory(true);
    };
    window.addEventListener("focus", handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
    };
  }, [restaurant.id]);

  // Métricas financieras calculadas
  const inventoryMetrics = useMemo(() => {
    let totalRetailValue = 0;
    let totalCostValue = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    dishes.forEach((d) => {
      const stock = typeof d.stock === "number" ? d.stock : 0;
      const min = typeof d.minStock === "number" ? d.minStock : 0;
      const cost = typeof d.costPrice === "number" ? d.costPrice : 0;
      const price = typeof d.price === "number" ? d.price : 0;

      if (d.trackStock) {
        totalRetailValue += stock * price;
        totalCostValue += stock * cost;

        if (stock <= 0) outOfStockCount++;
        else if (stock <= min) lowStockCount++;
      }
    });

    supplyItems.forEach((s) => {
      const stock = Number(s.currentStock) || 0;
      const cost = Number(s.costPerUnit) || 0;
      const min = Number(s.minStock) || 0;

      totalCostValue += stock * cost;
      if (stock <= 0) outOfStockCount++;
      else if (stock <= min) lowStockCount++;
    });

    const estimatedMargin =
      totalRetailValue > 0
        ? Math.round(((totalRetailValue - totalCostValue) / totalRetailValue) * 100)
        : 0;

    return {
      totalRetailValue: Math.round(totalRetailValue * 100) / 100,
      totalCostValue: Math.round(totalCostValue * 100) / 100,
      lowStockCount,
      outOfStockCount,
      estimatedMargin,
    };
  }, [dishes, supplyItems]);

  // Filtrado de productos/platos en la pestaña de Stock
  const filteredDishes = useMemo(() => {
    return dishes.filter((d) => {
      const matchesSearch =
        d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (d.barcode && d.barcode.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (d.sku && d.sku.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;

      const stock = typeof d.stock === "number" ? d.stock : 0;
      const min = typeof d.minStock === "number" ? d.minStock : 0;

      if (stockStatusFilter === "LOW") return stock > 0 && stock <= min;
      if (stockStatusFilter === "OUT") return stock <= 0;
      return true;
    });
  }, [dishes, searchQuery, stockStatusFilter]);

  // Filtrado de insumos
  const filteredSupplies = useMemo(() => {
    return supplyItems.filter((s) => {
      const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;

      const stock = Number(s.currentStock) || 0;
      const min = Number(s.minStock) || 0;

      if (stockStatusFilter === "LOW") return stock > 0 && stock <= min;
      if (stockStatusFilter === "OUT") return stock <= 0;
      return true;
    });
  }, [supplyItems, searchQuery, stockStatusFilter]);

  // Ajuste rápido de stock
  const handleQuickAdjust = async (type: "DISH" | "SUPPLY", id: string, delta: number) => {
    try {
      const res = await adjustInventoryStockAction({
        itemType: type,
        itemId: id,
        delta,
        reason: "Ajuste rápido desde panel",
      });
      if (res?.error) {
        alert(res.error);
        return;
      }
      loadInventory(true);
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  // Guardar merma
  const handleConfirmWaste = async () => {
    if (!wasteItem || wasteQty <= 0) return;
    try {
      const res = await adjustInventoryStockAction({
        itemType: wasteItem.type,
        itemId: wasteItem.item.id,
        delta: -Math.abs(wasteQty),
        reason: `Merma registrada: ${wasteReason}`,
      });
      if (res?.error) {
        alert(res.error);
        return;
      }
      setIsWasteModalOpen(false);
      setWasteItem(null);
      loadInventory(true);
      alert("¡Merma registrada exitosamente!");
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* ========================================================= */}
      {/* CABECERA PRINCIPAL Y SELECTOR DE SUB-PESTAÑAS */}
      {/* ========================================================= */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-900/60 p-5 rounded-2xl border border-slate-800 backdrop-blur-md">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500/20 to-red-500/20 text-amber-400 border border-amber-500/30">
              <Boxes className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white flex items-center gap-2">
                <span>{bLabels.inventoryTabTitle}</span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/30">
                  {bLabels.isGastro ? "Gastronomía & Insumos" : "Retail & Bodega"}
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {bLabels.isGastro
                  ? "Control integral de materias primas, recetas, porciones y pedidos a proveedores."
                  : "Control estricto de existencias físicas, conversión de cajas a unidades, costos y proveedores."}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => loadInventory(true)}
            disabled={refreshing}
            className="p-2.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-750 border border-slate-700 transition active:scale-95 disabled:opacity-50"
            title="Refrescar inventario"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin text-amber-400" : ""}`} />
          </button>

          {/* Sub-tabs pills */}
          <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveSubTab("stock")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeSubTab === "stock"
                  ? "bg-gradient-to-r from-red-600 to-amber-600 text-white shadow-md"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Package className="h-3.5 w-3.5" />
              <span>Existencias & Precios</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab("suppliers")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeSubTab === "suppliers"
                  ? "bg-gradient-to-r from-red-600 to-amber-600 text-white shadow-md"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Truck className="h-3.5 w-3.5" />
              <span>Proveedores ({suppliers.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab("purchases")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeSubTab === "purchases"
                  ? "bg-gradient-to-r from-red-600 to-amber-600 text-white shadow-md"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <PackagePlus className="h-3.5 w-3.5" />
              <span>Órdenes de Compra ({purchaseOrders.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab("recipes")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeSubTab === "recipes"
                  ? "bg-gradient-to-r from-red-600 to-amber-600 text-white shadow-md"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <ChefHat className="h-3.5 w-3.5" />
              <span>Recetas & Insumos</span>
            </button>
          </div>
        </div>
      </div>

      {!bLabels.isGastro && (
        <div className="bg-sky-500/10 border border-sky-500/20 px-4 py-3 rounded-2xl flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 text-sky-300">
            <span className="text-base">💡</span>
            <div>
              <strong className="text-white">Control de Stock Rápido:</strong> Las existencias de tus productos se actualizan y venden directamente desde la pestaña <strong className="text-sky-200">&quot;Productos & Stock&quot;</strong>. Usa esta sección de Bodega principalmente si deseas llevar registro de compras a proveedores mayoristas, costos y mermas.
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TARJETAS DE MÉTRICAS GLOBALES DE INVENTARIO */}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Valor Total a Costo */}
        <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-2xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">
              Valor en Bodega (Costo)
            </span>
            <span className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <DollarSign className="h-4 w-4" />
            </span>
          </div>
          <p className="text-2xl font-black text-white mt-2">
            ${inventoryMetrics.totalCostValue.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </p>
          <span className="text-[11px] text-slate-400 block mt-1">Capital invertido en existencia</span>
        </div>

        {/* Valor Proyectado a Venta */}
        <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-2xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">
              Valor Proyectado (Venta)
            </span>
            <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <TrendingUp className="h-4 w-4" />
            </span>
          </div>
          <p className="text-2xl font-black text-emerald-400 mt-2">
            ${inventoryMetrics.totalRetailValue.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </p>
          <span className="text-[11px] text-emerald-500/80 block mt-1">
            Margen bruto promedio: ~{inventoryMetrics.estimatedMargin}%
          </span>
        </div>

        {/* Alertas de Stock Crítico */}
        <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-2xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">
              Stock Crítico / Por Agotar
            </span>
            <span className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <AlertTriangle className="h-4 w-4" />
            </span>
          </div>
          <p className="text-2xl font-black text-amber-400 mt-2">
            {inventoryMetrics.lowStockCount}
          </p>
          <span className="text-[11px] text-amber-500/80 block mt-1">
            Requieren orden de compra urgente
          </span>
        </div>

        {/* Agotados / Quiebre */}
        <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-2xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">
              Quiebre de Stock (Agotados)
            </span>
            <span className="p-2 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20">
              <X className="h-4 w-4" />
            </span>
          </div>
          <p className="text-2xl font-black text-red-400 mt-2">
            {inventoryMetrics.outOfStockCount}
          </p>
          <span className="text-[11px] text-red-400/80 block mt-1">
            Sin existencias en carta digital
          </span>
        </div>
      </div>

      {/* ========================================================= */}
      {/* CONTENIDO SEGÚN SUB-PESTAÑA SELECCIONADA */}
      {/* ========================================================= */}

      {/* SUB-PESTAÑA 1: EXISTENCIAS & PRECIOS */}
      {activeSubTab === "stock" && (
        <div className="space-y-4">
          {/* Barra de Búsqueda y Filtros */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/40 p-3 rounded-2xl border border-slate-800">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por nombre, código de barras o SKU..."
                className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setStockStatusFilter("ALL")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  stockStatusFilter === "ALL"
                    ? "bg-slate-800 text-white border border-slate-700"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Todos
              </button>
              <button
                type="button"
                onClick={() => setStockStatusFilter("LOW")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  stockStatusFilter === "LOW"
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                    : "text-slate-400 hover:text-amber-300"
                }`}
              >
                Críticos ({inventoryMetrics.lowStockCount})
              </button>
              <button
                type="button"
                onClick={() => setStockStatusFilter("OUT")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  stockStatusFilter === "OUT"
                    ? "bg-red-500/20 text-red-300 border border-red-500/40"
                    : "text-slate-400 hover:text-red-300"
                }`}
              >
                Agotados ({inventoryMetrics.outOfStockCount})
              </button>
            </div>
          </div>

          {/* Tabla de Existencias de Productos / Platos de la Carta */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
            <div className="px-5 py-3 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/80">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-amber-400" />
                <h3 className="text-sm font-bold text-white">
                  Catálogo de Venta ({filteredDishes.length})
                </h3>
                <span className="text-xs text-slate-400 font-mono hidden sm:inline">
                  · {bLabels.stockUnitPlural} controladas
                </span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => loadInventory(true)}
                  disabled={refreshing}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-bold transition shadow-sm"
                  title="Refrescar existencias en tiempo real"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin text-amber-400" : ""}`} />
                  <span className="hidden sm:inline">Refrescar</span>
                </button>
                <button
                  type="button"
                  onClick={handleEnableUniversalStock}
                  disabled={isEnablingUniversalStock}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold transition shadow-sm active:scale-95"
                  title="Activar control de stock estricto a todos los productos 'Sin límite'"
                >
                  <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                  <span>{isEnablingUniversalStock ? "Activando..." : "⚡ Activar Stock a Todo"}</span>
                </button>
                <Link
                  href="/caja"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold transition shadow-sm"
                  title="Abrir Caja POS móvil con escáner de cámara para entradas y ventas"
                >
                  <Barcode className="h-3.5 w-3.5 text-emerald-400" />
                  <span>📱 Abrir Caja POS</span>
                </Link>
                <button
                  type="button"
                  onClick={handleExportInventoryExcel}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/30 text-xs font-bold transition shadow-sm"
                  title="Descargar documento completo de inventario en Excel (.xlsx)"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Descargar Excel</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsBatchInventoryModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-600 to-emerald-600 hover:from-amber-500 hover:to-emerald-500 text-white text-xs font-bold transition shadow-sm"
                  title="Subir o actualizar existencias, costos y proveedores en lote con Excel"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  <span>Subir en Lotes (.xlsx)</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/70 text-slate-400 uppercase font-bold text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3">Ítem / Código</th>
                    <th className="px-4 py-3">Stock Actual</th>
                    <th className="px-4 py-3">Costo Compra</th>
                    <th className="px-4 py-3">Precio Venta</th>
                    <th className="px-4 py-3">Margen %</th>
                    <th className="px-4 py-3">Proveedor Habitual</th>
                    <th className="px-4 py-3 text-right">Ajuste Rápido / Merma</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredDishes.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-slate-500">
                        No se encontraron productos con los criterios de búsqueda.
                      </td>
                    </tr>
                  ) : (
                    filteredDishes.map((dish) => {
                      const stock = typeof dish.stock === "number" ? dish.stock : 0;
                      const minStock = typeof dish.minStock === "number" ? dish.minStock : 0;
                      const cost = typeof dish.costPrice === "number" ? dish.costPrice : 0;
                      const price = typeof dish.price === "number" ? dish.price : 0;
                      const unitMargin = price > 0 ? ((price - cost) / price) * 100 : 0;
                      const isLow = stock > 0 && stock <= minStock;
                      const isOut = stock <= 0;

                      return (
                        <tr key={dish.id} className="hover:bg-slate-800/30 transition">
                          <td className="px-4 py-3">
                            <div className="font-bold text-white text-sm">{dish.name}</div>
                            <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono mt-0.5">
                              {dish.barcode && (
                                <span className="flex items-center gap-1 text-slate-400">
                                  <Barcode className="h-3 w-3 text-amber-400" />
                                  {dish.barcode}
                                </span>
                              )}
                              {dish.category?.name && (
                                <span className="text-slate-500">[{dish.category.name}]</span>
                              )}
                            </div>
                          </td>

                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span
                                className={`px-2.5 py-1 rounded-xl font-mono font-bold text-xs ${
                                  isOut
                                    ? "bg-red-500/20 text-red-400 border border-red-500/30"
                                    : isLow
                                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                                    : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                }`}
                              >
                                {dish.trackStock ? `${stock} ${bLabels.stockUnitPlural}` : "Sin límite"}
                              </span>
                              {isLow && <span className="text-[10px] text-amber-400 font-bold">⚠️ Mín: {minStock}</span>}
                            </div>
                          </td>

                          <td className="px-4 py-3 font-mono text-slate-300">
                            <button
                              type="button"
                              onClick={() => setQuickEditDish(dish)}
                              className="group flex items-center gap-1.5 hover:text-amber-400 transition cursor-pointer text-left font-mono py-1 px-1.5 -ml-1.5 rounded-lg hover:bg-slate-800/60"
                              title="Clic para editar costo de compra"
                            >
                              <span>${cost.toFixed(2)}</span>
                              <Edit3 className="h-3 w-3 text-slate-600 group-hover:text-amber-400 opacity-60 group-hover:opacity-100 transition" />
                            </button>
                          </td>

                          <td className="px-4 py-3 font-mono font-bold text-white">
                            ${price.toFixed(2)}
                          </td>

                          <td className="px-4 py-3">
                            <span
                              className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                                unitMargin > 50
                                  ? "bg-emerald-500/20 text-emerald-300"
                                  : unitMargin > 20
                                  ? "bg-blue-500/20 text-blue-300"
                                  : unitMargin < 0
                                  ? "bg-red-500/20 text-red-300"
                                  : "bg-amber-500/20 text-amber-300"
                              }`}
                            >
                              {unitMargin >= 0 ? `+${unitMargin.toFixed(0)}%` : `${unitMargin.toFixed(0)}%`}
                            </span>
                          </td>

                          <td className="px-4 py-3 text-slate-400">
                            <button
                              type="button"
                              onClick={() => setQuickEditDish(dish)}
                              className="group flex items-center gap-1.5 hover:text-amber-300 transition cursor-pointer text-left py-1 px-1.5 -ml-1.5 rounded-lg hover:bg-slate-800/60"
                              title="Clic para asignar o cambiar proveedor habitual"
                            >
                              {dish.supplier?.name ? (
                                <span className="flex items-center gap-1 font-medium text-slate-300 group-hover:text-amber-300">
                                  <Truck className="h-3 w-3 text-amber-500/70" />
                                  <span>{dish.supplier.name}</span>
                                </span>
                              ) : (
                                <span className="text-slate-500 italic group-hover:text-amber-400 flex items-center gap-1">
                                  <span>No asignado</span>
                                  <span className="text-[10px] text-amber-500/80 font-normal underline">(Asignar)</span>
                                </span>
                              )}
                              <Edit3 className="h-3 w-3 text-slate-600 group-hover:text-amber-400 opacity-60 group-hover:opacity-100 transition" />
                            </button>
                          </td>

                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => setQuickEditDish(dish)}
                                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-750 text-amber-400 border border-amber-500/20 hover:border-amber-500/40 text-xs font-bold transition flex items-center gap-1 mr-1 shadow-sm"
                                title="Editar costo de compra, proveedor habitual y stock"
                              >
                                <Edit3 className="h-3 w-3" />
                                <span>Editar</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleQuickAdjust("DISH", dish.id, -1)}
                                className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition"
                                title="Restar 1 porción/unidad"
                              >
                                -1
                              </button>
                              <button
                                type="button"
                                onClick={() => handleQuickAdjust("DISH", dish.id, 1)}
                                className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition"
                                title="Sumar 1 porción/unidad"
                              >
                                +1
                              </button>
                              <button
                                type="button"
                                onClick={() => handleQuickAdjust("DISH", dish.id, 5)}
                                className="px-2 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold text-xs transition"
                                title="Sumar 5 unidades"
                              >
                                +5
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setWasteItem({ type: "DISH", item: dish });
                                  setWasteQty(1);
                                  setIsWasteModalOpen(true);
                                }}
                                className="px-2.5 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-bold transition ml-1"
                                title="Registrar merma, daño o caducidad"
                              >
                                Merma
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-PESTAÑA 2: PROVEEDORES */}
      {activeSubTab === "suppliers" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Truck className="h-5 w-5 text-amber-400" />
                Directorio de Proveedores
              </h3>
              <p className="text-xs text-slate-400">
                Contactos comerciales, días de visita y generación de pedidos directos por WhatsApp.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setEditingSupplier(null);
                setIsSupplierModalOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white text-xs font-bold transition shadow-lg"
            >
              <Plus className="h-4 w-4" />
              <span>Nuevo Proveedor</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {suppliers.length === 0 ? (
              <div className="col-span-full text-center py-12 bg-slate-900/30 rounded-2xl border border-dashed border-slate-800 text-slate-500">
                <Truck className="h-10 w-10 mx-auto mb-2 text-slate-600 opacity-60" />
                <p className="text-sm font-bold text-slate-400">No hay proveedores registrados todavía.</p>
                <p className="text-xs text-slate-500 mt-1">Registra distribuidores para coordinar pedidos rápidamente.</p>
              </div>
            ) : (
              suppliers.map((sup) => (
                <div
                  key={sup.id}
                  className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 space-y-3 hover:border-slate-700 transition"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-white text-base">{sup.name}</h4>
                      {sup.contactName && (
                        <p className="text-xs text-slate-400">Contacto: {sup.contactName}</p>
                      )}
                      {sup.taxId && (
                        <span className="text-[10px] text-slate-500 font-mono">RUC/NIT: {sup.taxId}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingSupplier(sup);
                          setIsSupplierModalOpen(true);
                        }}
                        className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          if (confirm(`¿Eliminar al proveedor "${sup.name}"?`)) {
                            await deleteSupplierAction(sup.id);
                            loadInventory(true);
                          }
                        }}
                        className="p-1.5 text-red-400 hover:text-red-300 rounded-lg hover:bg-red-500/10 transition"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {sup.notes && (
                    <p className="text-xs text-amber-300/80 bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20">
                      💡 {sup.notes}
                    </p>
                  )}

                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2 text-xs">
                    <span className="text-slate-400 text-[11px]">
                      {sup._count?.dishes || 0} ítems vinculados
                    </span>
                    {sup.phone ? (
                      <a
                        href={`https://wa.me/${sup.phone.replace(/\D/g, "")}?text=${encodeURIComponent(
                          `Hola ${sup.contactName || sup.name}, te escribo de ${restaurant.name} para coordinar pedido.`
                        )}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 font-bold transition"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                        <span>Chat WhatsApp</span>
                      </a>
                    ) : (
                      <span className="text-[10px] text-slate-500 italic">Sin teléfono</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* SUB-PESTAÑA 3: ÓRDENES DE COMPRA (CONVERSOR DE CAJAS A UNIDADES) */}
      {activeSubTab === "purchases" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <PackagePlus className="h-5 w-5 text-amber-400" />
                Órdenes de Compra & Recepción
              </h3>
              <p className="text-xs text-slate-400">
                Conversor automático de cajas/packs a unidades y entrada directa al stock.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsPoModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white text-xs font-bold transition shadow-lg"
            >
              <Plus className="h-4 w-4" />
              <span>Nueva Orden de Compra</span>
            </button>
          </div>

          <div className="space-y-3">
            {purchaseOrders.length === 0 ? (
              <div className="text-center py-12 bg-slate-900/30 rounded-2xl border border-dashed border-slate-800 text-slate-500">
                <PackagePlus className="h-10 w-10 mx-auto mb-2 text-slate-600 opacity-60" />
                <p className="text-sm font-bold text-slate-400">No hay órdenes de compra registradas.</p>
                <p className="text-xs text-slate-500 mt-1">Crea una orden para pedir mercancía a tus proveedores.</p>
              </div>
            ) : (
              purchaseOrders.map((po) => {
                const isPending = po.status === "PENDING";
                const isReceived = po.status === "RECEIVED";
                const isCancelled = po.status === "CANCELLED";

                return (
                  <div
                    key={po.id}
                    className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold text-sm text-amber-400">
                          OC-#{String(po.orderNumber).padStart(4, "0")}
                        </span>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                            isReceived
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                              : isPending
                              ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse"
                              : "bg-red-500/20 text-red-300 border border-red-500/30"
                          }`}
                        >
                          {isReceived ? "✓ Recibida en Bodega" : isPending ? "⏳ Pendiente de Entrega" : "✕ Cancelada"}
                        </span>
                        {po.supplier?.name && (
                          <span className="text-xs text-slate-300 font-semibold flex items-center gap-1">
                            <Truck className="h-3 w-3 text-slate-500" />
                            {po.supplier.name}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400">
                          {new Date(po.createdAt).toLocaleDateString()}
                        </span>
                        <span className="text-sm font-black text-white font-mono">
                          Total: ${Number(po.totalCost || 0).toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {/* Detalle de ítems con conversor */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 text-xs">
                      {po.items?.map((it: any) => (
                        <div
                          key={it.id}
                          className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800/80 flex items-center justify-between"
                        >
                          <div>
                            <span className="font-bold text-white block">{it.name}</span>
                            <span className="text-[11px] text-amber-400 font-mono">
                              {it.packageQuantity} {it.packageType}{it.packageQuantity > 1 ? "s" : ""}
                              {it.unitsPerPackage > 1 && (
                                <span className="text-slate-400">
                                  {" "}× {it.unitsPerPackage} u. ={" "}
                                  <strong className="text-emerald-400">{it.totalUnits} u.</strong>
                                </span>
                              )}
                            </span>
                          </div>
                          <div className="text-right font-mono">
                            <span className="text-slate-300 block font-bold">
                              ${Number(it.totalCost || 0).toFixed(2)}
                            </span>
                            <span className="text-[10px] text-slate-500">
                              (${Number(it.costPerUnit || 0).toFixed(2)}/u)
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Acciones de la orden */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                      <div>
                        {po.notes && (
                          <span className="text-xs text-slate-400 italic">Nota: {po.notes}</span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Botón copiar formato para WhatsApp */}
                        <button
                          type="button"
                          onClick={() => {
                            const lines = [
                              `📦 *ORDEN DE COMPRA OC-#${String(po.orderNumber).padStart(4, "0")}*`,
                              `Negocio: *${restaurant.name}*`,
                              `Proveedor: *${po.supplier?.name || "General"}*`,
                              `Fecha: ${new Date(po.createdAt).toLocaleDateString()}`,
                              ``,
                              `*DETALLE DEL PEDIDO:*`,
                              ...(po.items || []).map(
                                (it: any) =>
                                  `• ${it.packageQuantity} ${it.packageType}(s) de ${it.name} ${
                                    it.unitsPerPackage > 1 ? `(Total: ${it.totalUnits} unid.)` : ""
                                  } - $${Number(it.totalCost || 0).toFixed(2)}`
                              ),
                              ``,
                              `*TOTAL ESTIMADO: $${Number(po.totalCost || 0).toFixed(2)}*`,
                              po.notes ? `Nota: ${po.notes}` : "",
                            ].filter(Boolean);

                            navigator.clipboard.writeText(lines.join("\n"));
                            alert("¡Texto de la orden copiado al portapapeles! Listo para pegar en WhatsApp.");
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-bold transition"
                        >
                          <Copy className="h-3.5 w-3.5" />
                          <span>Copiar para WhatsApp</span>
                        </button>

                        {isPending && (
                          <>
                            <button
                              type="button"
                              onClick={async () => {
                                if (
                                  confirm(
                                    `¿Confirmar recepción de la orden OC-#${po.orderNumber}? Esto sumará automáticamente las unidades al stock en el catálogo y actualizará los costos de compra.`
                                  )
                                ) {
                                  const res = await receivePurchaseOrderAction(po.id, true);
                                  if (res?.error) {
                                    alert(res.error);
                                    return;
                                  }
                                  loadInventory(true);
                                  alert("¡Mercadería recibida y stock actualizado con éxito!");
                                }
                              }}
                              className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-md active:scale-95"
                            >
                              <PackageCheck className="h-3.5 w-3.5" />
                              <span>Recibir Mercadería (+Stock)</span>
                            </button>

                            <button
                              type="button"
                              onClick={async () => {
                                if (confirm(`¿Cancelar la orden OC-#${po.orderNumber}?`)) {
                                  await cancelPurchaseOrderAction(po.id);
                                  loadInventory(true);
                                }
                              }}
                              className="px-3 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-bold transition"
                            >
                              Cancelar
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* SUB-PESTAÑA 4: RECETAS & INSUMOS (ESCANDALLO BÁSICO) */}
      {activeSubTab === "recipes" && (
        <div className="space-y-6">
          {/* Sección A: Insumos y Materias Primas */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <ChefHat className="h-5 w-5 text-amber-400" />
                  Insumos & Materias Primas ({supplyItems.length})
                </h3>
                <p className="text-xs text-slate-400">
                  Ingredientes clave (café, leche, quesos, pan, empaques) para el costeo de platos y bebidas.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingSupply(null);
                  setIsSupplyModalOpen(true);
                }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white text-xs font-bold transition shadow-lg"
              >
                <Plus className="h-4 w-4" />
                <span>Nuevo Insumo</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredSupplies.length === 0 ? (
                <div className="col-span-full text-center py-8 bg-slate-900/30 rounded-2xl border border-dashed border-slate-800 text-slate-500 text-xs">
                  No hay insumos creados aún. Haz clic en &quot;Nuevo Insumo&quot; para registrar café, leche, salsas, etc.
                </div>
              ) : (
                filteredSupplies.map((s) => (
                  <div
                    key={s.id}
                    className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 space-y-2 hover:border-slate-700 transition"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-bold text-white text-sm">{s.name}</h4>
                        <span className="text-[10px] text-slate-400 font-mono">
                          Unidad: {s.unit} | Proveedor: {s.supplier?.name || "No asignado"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingSupply(s);
                            setIsSupplyModalOpen(true);
                          }}
                          className="p-1 text-slate-400 hover:text-white rounded"
                        >
                          <Edit3 className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            if (confirm(`¿Eliminar insumo "${s.name}"?`)) {
                              await deleteSupplyItemAction(s.id);
                              loadInventory(true);
                            }
                          }}
                          className="p-1 text-red-400 hover:text-red-300 rounded"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800/80">
                      <div>
                        <span className="text-slate-400 block text-[10px]">Existencia Actual:</span>
                        <span className="font-bold font-mono text-white">
                          {s.currentStock} {s.unit}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-slate-400 block text-[10px]">Costo x {s.unit}:</span>
                        <span className="font-bold font-mono text-amber-400">
                          ${Number(s.costPerUnit || 0).toFixed(3)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => handleQuickAdjust("SUPPLY", s.id, -1)}
                        className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-700"
                      >
                        -1
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickAdjust("SUPPLY", s.id, 1)}
                        className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-700"
                      >
                        +1
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickAdjust("SUPPLY", s.id, 5)}
                        className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 text-xs font-bold hover:bg-amber-500/20 border border-amber-500/30"
                      >
                        +5
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Sección B: Configuración de Recetas en Platos */}
          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div>
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Calculator className="h-4 w-4 text-emerald-400" />
                Asignación de Recetas a Platos de la Carta
              </h4>
              <p className="text-xs text-slate-400">
                Selecciona un plato para vincular los insumos que lo componen. El sistema calculará el costo de producción teórico automáticamente.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {dishes.map((dish) => {
                const recipeCount = dish.recipeItems?.length || 0;
                return (
                  <div
                    key={dish.id}
                    className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between gap-2"
                  >
                    <div>
                      <span className="font-bold text-white text-xs block">{dish.name}</span>
                      <span className="text-[11px] text-slate-400 font-mono">
                        PVP: ${Number(dish.price).toFixed(2)} | Costo: ${Number(dish.costPrice || 0).toFixed(2)}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setRecipeDish(dish);
                        setIsRecipeModalOpen(true);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                        recipeCount > 0
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                          : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                      }`}
                    >
                      <ChefHat className="h-3.5 w-3.5" />
                      <span>{recipeCount > 0 ? `${recipeCount} insumos` : "Crear Receta"}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: PROVEEDOR (CREAR / EDITAR) */}
      {/* ========================================================= */}
      {isSupplierModalOpen && (
        <SupplierModal
          supplier={editingSupplier}
          restaurantId={restaurant.id}
          onClose={() => setIsSupplierModalOpen(false)}
          onSaved={() => {
            setIsSupplierModalOpen(false);
            loadInventory(true);
          }}
        />
      )}

      {/* ========================================================= */}
      {/* MODAL: INSUMO (CREAR / EDITAR) */}
      {/* ========================================================= */}
      {isSupplyModalOpen && (
        <SupplyModal
          supply={editingSupply}
          suppliers={suppliers}
          restaurantId={restaurant.id}
          onClose={() => setIsSupplyModalOpen(false)}
          onSaved={() => {
            setIsSupplyModalOpen(false);
            loadInventory(true);
          }}
        />
      )}

      {/* ========================================================= */}
      {/* MODAL: NUEVA ORDEN DE COMPRA (CONVERSOR DE CAJAS) */}
      {/* ========================================================= */}
      {isPoModalOpen && (
        <PurchaseOrderModal
          restaurant={restaurant}
          suppliers={suppliers}
          dishes={dishes}
          supplyItems={supplyItems}
          onClose={() => setIsPoModalOpen(false)}
          onSaved={() => {
            setIsPoModalOpen(false);
            loadInventory(true);
          }}
        />
      )}

      {/* ========================================================= */}
      {/* MODAL: RECETA SENCILLA DE PLATO */}
      {/* ========================================================= */}
      {isRecipeModalOpen && recipeDish && (
        <RecipeModal
          dish={recipeDish}
          supplyItems={supplyItems}
          onClose={() => {
            setIsRecipeModalOpen(false);
            setRecipeDish(null);
          }}
          onSaved={() => {
            setIsRecipeModalOpen(false);
            setRecipeDish(null);
            loadInventory(true);
          }}
        />
      )}

      {/* ========================================================= */}
      {/* MODAL: REGISTRAR MERMA / ROTURA */}
      {/* ========================================================= */}
      {isWasteModalOpen && wasteItem && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                Registrar Merma o Pérdida
              </h3>
              <button
                type="button"
                onClick={() => setIsWasteModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Registrar salida justificada del producto <strong>{wasteItem.item.name}</strong> sin descuadrar la caja.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                Cantidad a dar de baja
              </label>
              <input
                type="number"
                min="1"
                value={wasteQty}
                onChange={(e) => setWasteQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:border-red-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Motivo de la Merma</label>
              <select
                value={wasteReason}
                onChange={(e) => setWasteReason(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-xs focus:border-red-500 focus:outline-none"
              >
                <option value="Vencido / Caducado">Vencido / Caducado</option>
                <option value="Rotura de Botella / Empaque Roto">Rotura de Botella / Empaque Roto</option>
                <option value="Consumo Interno / Degustación">Consumo Interno / Degustación</option>
                <option value="Merma de Cocina / Desperdicio">Merma de Cocina / Desperdicio</option>
                <option value="Ajuste de Conteo Físico">Ajuste de Conteo Físico</option>
              </select>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsWasteModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmWaste}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-500 text-white shadow-lg transition"
              >
                Confirmar Baja
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE EDICIÓN RÁPIDA DE COSTO & PROVEEDOR */}
      <QuickEditDishInventoryModal
        isOpen={Boolean(quickEditDish)}
        dish={quickEditDish}
        suppliers={suppliers}
        onClose={() => setQuickEditDish(null)}
        onSuccess={(updatedDish) => {
          setDishes((prev) =>
            prev.map((d) => (d.id === updatedDish.id ? { ...d, ...updatedDish } : d))
          );
          setQuickEditDish(null);
        }}
        onOpenNewSupplier={() => {
          setQuickEditDish(null);
          setEditingSupplier(null);
          setIsSupplierModalOpen(true);
        }}
        restaurantId={restaurant.id}
        bLabels={bLabels}
      />

      {/* MODAL DE CARGA MASIVA DE INVENTARIO EN EXCEL */}
      <BatchInventoryModal
        isOpen={isBatchInventoryModalOpen}
        onClose={() => setIsBatchInventoryModalOpen(false)}
        onSuccess={() => {
          loadInventory(true);
        }}
        restaurantId={restaurant.id}
        restaurantSlug={restaurant.slug}
        existingDishes={dishes}
        existingSuppliers={suppliers}
        bLabels={bLabels}
      />
    </div>
  );
}

// =========================================================================
// SUB-COMPONENTES Y MODALES MODULARES
// =========================================================================

function SupplierModal({
  supplier,
  restaurantId,
  onClose,
  onSaved,
}: {
  supplier: any | null;
  restaurantId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(supplier?.name || "");
  const [contactName, setContactName] = useState(supplier?.contactName || "");
  const [phone, setPhone] = useState(supplier?.phone || "");
  const [email, setEmail] = useState(supplier?.email || "");
  const [taxId, setTaxId] = useState(supplier?.taxId || "");
  const [address, setAddress] = useState(supplier?.address || "");
  const [notes, setNotes] = useState(supplier?.notes || "");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert("El nombre del proveedor es obligatorio.");
      return;
    }

    setSaving(true);
    try {
      if (supplier) {
        const res = await updateSupplierAction(supplier.id, {
          name,
          contactName,
          phone,
          email,
          taxId,
          address,
          notes,
        });
        if (res?.error) {
          alert(res.error);
          return;
        }
      } else {
        const res = await createSupplierAction(restaurantId, {
          name,
          contactName,
          phone,
          email,
          taxId,
          address,
          notes,
        });
        if (res?.error) {
          alert(res.error);
          return;
        }
      }
      onSaved();
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-lg space-y-4 shadow-2xl my-8">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="font-bold text-white text-base flex items-center gap-2">
            <Truck className="h-5 w-5 text-amber-400" />
            {supplier ? "Editar Proveedor" : "Nuevo Proveedor"}
          </h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="block text-slate-300 font-semibold mb-1">
              Nombre de la Empresa / Distribuidora *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Distribuidora Nacional de Bebidas S.A."
              className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-3 py-2 text-white focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Persona de Contacto</label>
              <input
                type="text"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="Ej: Carlos Mendoza (Vendedor)"
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-3 py-2 text-white focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1">WhatsApp / Teléfono</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Ej: 593991234567"
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-3 py-2 text-white focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">RUC / NIT / Identificación</label>
              <input
                type="text"
                value={taxId}
                onChange={(e) => setTaxId(e.target.value)}
                placeholder="Ej: 0992345678001"
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-3 py-2 text-white font-mono focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Correo Electrónico</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="pedidos@proveedor.com"
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-3 py-2 text-white focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Días de Visita / Condiciones de Pedido</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: Toma pedido los lunes, entrega los miércoles. Mínimo 3 cajas."
              className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-3 py-2 text-white focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl font-bold bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-xl font-bold bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white shadow-lg transition disabled:opacity-50"
            >
              {saving ? "Guardando..." : "Guardar Proveedor"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SupplyModal({
  supply,
  suppliers,
  restaurantId,
  onClose,
  onSaved,
}: {
  supply: any | null;
  suppliers: any[];
  restaurantId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(supply?.name || "");
  const [unit, setUnit] = useState(supply?.unit || "kg");
  const [currentStock, setCurrentStock] = useState(supply?.currentStock || "10");
  const [minStock, setMinStock] = useState(supply?.minStock || "3");
  const [costPerUnit, setCostPerUnit] = useState(supply?.costPerUnit || "1.5");
  const [supplierId, setSupplierId] = useState(supply?.supplierId || "");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return alert("El nombre del insumo es obligatorio.");

    setSaving(true);
    try {
      const data = {
        name,
        unit,
        currentStock: parseFloat(currentStock) || 0,
        minStock: parseFloat(minStock) || 0,
        costPerUnit: parseFloat(costPerUnit) || 0,
        supplierId: supplierId || null,
      };

      if (supply) {
        const res = await updateSupplyItemAction(supply.id, data);
        if (res?.error) return alert(res.error);
      } else {
        const res = await createSupplyItemAction(restaurantId, data);
        if (res?.error) return alert(res.error);
      }
      onSaved();
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="font-bold text-white text-base flex items-center gap-2">
            <ChefHat className="h-5 w-5 text-amber-400" />
            {supply ? "Editar Insumo" : "Nuevo Insumo / Materia Prima"}
          </h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="block text-slate-300 font-semibold mb-1">Nombre del Insumo *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Café Especial en Grano, Leche Entera, Queso"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-amber-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Unidad de Medida</label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-amber-500 focus:outline-none"
              >
                <option value="kg">Kilogramos (kg)</option>
                <option value="g">Gramos (g)</option>
                <option value="L">Litros (L)</option>
                <option value="ml">Mililitros (ml)</option>
                <option value="unidad">Unidades (u)</option>
                <option value="porcion">Porciones</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Costo x {unit} ($)</label>
              <input
                type="number"
                step="0.001"
                value={costPerUnit}
                onChange={(e) => setCostPerUnit(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Stock Actual ({unit})</label>
              <input
                type="number"
                step="0.01"
                value={currentStock}
                onChange={(e) => setCurrentStock(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:border-amber-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Stock Mínimo Alerta</label>
              <input
                type="number"
                step="0.01"
                value={minStock}
                onChange={(e) => setMinStock(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Proveedor Habitual</label>
            <select
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-amber-500 focus:outline-none"
            >
              <option value="">Seleccione proveedor (opcional)...</option>
              {suppliers.map((sup) => (
                <option key={sup.id} value={sup.id}>
                  {sup.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl font-bold bg-slate-800 text-slate-300 hover:bg-slate-700"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-xl font-bold bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white shadow-lg disabled:opacity-50"
            >
              {saving ? "Guardando..." : "Guardar Insumo"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// =========================================================================
// MODAL: ÓRDENES DE COMPRA CON CONVERSOR DE CAJAS A UNIDADES
// =========================================================================
function PurchaseOrderModal({
  restaurant,
  suppliers,
  dishes,
  supplyItems,
  onClose,
  onSaved,
}: {
  restaurant: any;
  suppliers: any[];
  dishes: any[];
  supplyItems: any[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [supplierId, setSupplierId] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Lista de items a pedir
  const [items, setItems] = useState<
    Array<{
      itemType: "DISH" | "SUPPLY";
      dishId?: string;
      supplyItemId?: string;
      name: string;
      packageType: string; // UNIDAD, CAJA, PACK, FARDO
      packageQuantity: number;
      unitsPerPackage: number;
      costPerPackage: number;
    }>
  >([]);

  // Item temporal para agregar
  const [selectedSourceType, setSelectedSourceType] = useState<"DISH" | "SUPPLY">("DISH");
  const [selectedItemId, setSelectedItemId] = useState("");
  const [tempPackType, setTempPackType] = useState("CAJA");
  const [tempPackQty, setTempPackQty] = useState(1);
  const [tempUnitsPerPack, setTempUnitsPerPack] = useState(24);
  const [tempCostPerPack, setTempCostPerPack] = useState(24.0);

  // Cuando cambia el ítem seleccionado, pre-llenar costos si existen
  useEffect(() => {
    if (selectedSourceType === "DISH") {
      const d = dishes.find((item) => item.id === selectedItemId);
      if (d) {
        setTempCostPerPack((d.costPrice || 1.0) * tempUnitsPerPack);
      }
    } else {
      const s = supplyItems.find((item) => item.id === selectedItemId);
      if (s) {
        setTempCostPerPack((s.costPerUnit || 1.0) * tempUnitsPerPack);
      }
    }
  }, [selectedItemId, selectedSourceType, tempUnitsPerPack, dishes, supplyItems]);

  const handleAddItem = () => {
    let name = "";
    if (selectedSourceType === "DISH") {
      const d = dishes.find((item) => item.id === selectedItemId);
      if (!d) return alert("Selecciona un producto.");
      name = d.name;
    } else {
      const s = supplyItems.find((item) => item.id === selectedItemId);
      if (!s) return alert("Selecciona un insumo.");
      name = s.name;
    }

    setItems((prev) => [
      ...prev,
      {
        itemType: selectedSourceType,
        dishId: selectedSourceType === "DISH" ? selectedItemId : undefined,
        supplyItemId: selectedSourceType === "SUPPLY" ? selectedItemId : undefined,
        name,
        packageType: tempPackType,
        packageQuantity: tempPackQty,
        unitsPerPackage: tempUnitsPerPack,
        costPerPackage: tempCostPerPack,
      },
    ]);

    setSelectedItemId("");
    setTempPackQty(1);
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const totalCalculated = useMemo(() => {
    return items.reduce((acc, it) => acc + it.packageQuantity * it.costPerPackage, 0);
  }, [items]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) return alert("Agrega al menos un producto a la orden.");

    setSaving(true);
    try {
      const res = await createPurchaseOrderAction(restaurant.id, {
        supplierId: supplierId || null,
        notes,
        items,
      });

      if (res?.error) return alert(res.error);
      alert("¡Orden de compra generada exitosamente!");
      onSaved();
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-2xl space-y-4 shadow-2xl my-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 className="font-bold text-white text-base flex items-center gap-2">
              <PackagePlus className="h-5 w-5 text-amber-400" />
              Nueva Orden de Compra (Conversor de Cajas a Unidades)
            </h3>
            <p className="text-xs text-slate-400">
              Registra compras por cajas o unidades. Al recibir la mercadería, el inventario se sumará automáticamente.
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Proveedor Destinatario</label>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-amber-500 focus:outline-none"
              >
                <option value="">Seleccione proveedor (opcional)...</option>
                {suppliers.map((sup) => (
                  <option key={sup.id} value={sup.id}>
                    {sup.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Instrucciones o Notas</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ej: Facturar a crédito 15 días, entregar antes de las 11:00 AM"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Formulario para agregar ítem con conversor */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-amber-400 text-xs flex items-center gap-1.5">
                <Calculator className="h-4 w-4" />
                Agregar Ítem con Conversor de Empaque
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSourceType("DISH");
                    setSelectedItemId("");
                  }}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold ${
                    selectedSourceType === "DISH" ? "bg-amber-500/20 text-amber-300" : "text-slate-500"
                  }`}
                >
                  Producto Catálogo
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSourceType("SUPPLY");
                    setSelectedItemId("");
                  }}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold ${
                    selectedSourceType === "SUPPLY" ? "bg-amber-500/20 text-amber-300" : "text-slate-500"
                  }`}
                >
                  Insumo / Cocina
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-slate-400 font-semibold mb-1">
                  Seleccionar {selectedSourceType === "DISH" ? "Producto" : "Insumo"} *
                </label>
                <select
                  value={selectedItemId}
                  onChange={(e) => setSelectedItemId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-amber-500 focus:outline-none"
                >
                  <option value="">Seleccione un ítem...</option>
                  {(selectedSourceType === "DISH" ? dishes : supplyItems).map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.name} (Stock: {selectedSourceType === "DISH" ? it.stock || 0 : it.currentStock || 0})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Tipo de Empaque</label>
                <select
                  value={tempPackType}
                  onChange={(e) => setTempPackType(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white"
                >
                  <option value="CAJA">Caja</option>
                  <option value="PACK">Pack / Six-Pack</option>
                  <option value="FARDO">Fardo / Bulto</option>
                  <option value="UNIDAD">Unidad Suelta</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Cantidad de {tempPackType}s</label>
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={tempPackQty}
                  onChange={(e) => setTempPackQty(parseFloat(e.target.value) || 1)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">
                  Unidades que contiene 1 {tempPackType} (Factor)
                </label>
                <input
                  type="number"
                  min="1"
                  value={tempUnitsPerPack}
                  onChange={(e) => setTempUnitsPerPack(parseInt(e.target.value, 10) || 1)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono"
                  placeholder="Ej: 24 botellas por caja"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">
                  Costo pagado por cada {tempPackType} ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={tempCostPerPack}
                  onChange={(e) => setTempCostPerPack(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>
            </div>

            {/* Banner de cálculo en vivo del conversor */}
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center justify-between text-xs text-amber-300">
              <span>
                🧮 <strong>Conversión:</strong> {tempPackQty} {tempPackType}(s) × {tempUnitsPerPack} u. ={" "}
                <strong className="text-white font-bold">{tempPackQty * tempUnitsPerPack} unidades</strong> ingresarán al inventario.
              </span>
              <span className="font-mono font-bold">
                Costo unitario: ${tempUnitsPerPack > 0 ? (tempCostPerPack / tempUnitsPerPack).toFixed(3) : 0}/u
              </span>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleAddItem}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold flex items-center gap-1.5 transition"
              >
                <Plus className="h-4 w-4" />
                <span>Agregar a la Orden</span>
              </button>
            </div>
          </div>

          {/* Tabla de ítems en la orden */}
          <div className="space-y-2">
            <h4 className="font-bold text-white text-xs">Productos en la Orden ({items.length})</h4>
            {items.length === 0 ? (
              <p className="text-xs text-slate-500 italic">No has añadido productos aún.</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {items.map((it, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between"
                  >
                    <div>
                      <span className="font-bold text-white">{it.name}</span>
                      <div className="text-[11px] text-slate-400 font-mono">
                        {it.packageQuantity} {it.packageType}(s) × {it.unitsPerPackage} ={" "}
                        <strong className="text-emerald-400">{it.packageQuantity * it.unitsPerPackage} unidades</strong>{" "}
                        (${it.costPerPackage.toFixed(2)} c/{it.packageType.toLowerCase()})
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-white text-sm">
                        ${(it.packageQuantity * it.costPerPackage).toFixed(2)}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className="p-1 text-red-400 hover:text-red-300"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-slate-800">
            <div>
              <span className="text-slate-400 text-xs block">Total de la Orden:</span>
              <span className="font-mono font-black text-xl text-emerald-400">
                ${totalCalculated.toFixed(2)}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl font-bold bg-slate-800 text-slate-300 hover:bg-slate-700"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving || items.length === 0}
                className="px-5 py-2 rounded-xl font-bold bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white shadow-lg disabled:opacity-50"
              >
                {saving ? "Generando..." : "Crear Orden de Compra"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

// =========================================================================
// MODAL: RECETA SENCILLA DE PLATO (GASTRONOMÍA / CAFETERÍAS)
// =========================================================================
function RecipeModal({
  dish,
  supplyItems,
  onClose,
  onSaved,
}: {
  dish: any;
  supplyItems: any[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [ingredients, setIngredients] = useState<
    Array<{
      supplyItemId: string;
      quantity: number;
    }>
  >(
    dish.recipeItems?.map((ri: any) => ({
      supplyItemId: ri.supplyItemId,
      quantity: ri.quantity,
    })) || []
  );

  const [selectedSupplyId, setSelectedSupplyId] = useState("");
  const [selectedQty, setSelectedQty] = useState(1);
  const [saving, setSaving] = useState(false);

  const supplyMap = useMemo(() => {
    return new Map(supplyItems.map((s) => [s.id, s]));
  }, [supplyItems]);

  const handleAddIngredient = () => {
    if (!selectedSupplyId) return alert("Selecciona un insumo.");
    if (ingredients.some((i) => i.supplyItemId === selectedSupplyId)) {
      return alert("Este insumo ya está en la receta. Ajusta su cantidad en la lista.");
    }

    setIngredients((prev) => [
      ...prev,
      {
        supplyItemId: selectedSupplyId,
        quantity: Math.max(0.001, selectedQty),
      },
    ]);

    setSelectedSupplyId("");
    setSelectedQty(1);
  };

  const handleRemoveIngredient = (supplyId: string) => {
    setIngredients((prev) => prev.filter((i) => i.supplyItemId !== supplyId));
  };

  // Costo teórico total de la receta
  const theoreticalCost = useMemo(() => {
    return ingredients.reduce((acc, ing) => {
      const s = supplyMap.get(ing.supplyItemId);
      return acc + (s?.costPerUnit || 0) * ing.quantity;
    }, 0);
  }, [ingredients, supplyMap]);

  const profitMargin = useMemo(() => {
    const price = Number(dish.price) || 0;
    if (price <= 0) return 0;
    return Math.round(((price - theoreticalCost) / price) * 100);
  }, [dish.price, theoreticalCost]);

  const handleSaveRecipe = async () => {
    setSaving(true);
    try {
      const res = await saveDishRecipeAction(dish.id, ingredients);
      if (res?.error) return alert(res.error);
      alert(
        `¡Receta guardada! El costo teórico de "${dish.name}" se actualizó a $${theoreticalCost.toFixed(
          2
        )} con un margen de ${profitMargin}%.`
      );
      onSaved();
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-lg space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 className="font-bold text-white text-base flex items-center gap-2">
              <ChefHat className="h-5 w-5 text-amber-400" />
              Receta / Escandallo de: {dish.name}
            </h3>
            <p className="text-xs text-slate-400">
              PVP en Carta: ${Number(dish.price).toFixed(2)}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Agregar insumo a la receta */}
        <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2 text-xs">
          <label className="block text-slate-300 font-semibold">Agregar Ingrediente a la Receta</label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="sm:col-span-2">
              <select
                value={selectedSupplyId}
                onChange={(e) => setSelectedSupplyId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white"
              >
                <option value="">Seleccione insumo...</option>
                {supplyItems.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} (${s.costPerUnit}/{s.unit})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <input
                type="number"
                step="0.001"
                min="0.001"
                value={selectedQty}
                onChange={(e) => setSelectedQty(parseFloat(e.target.value) || 0.001)}
                placeholder="Cantidad"
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono"
              />
            </div>
          </div>
          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={handleAddIngredient}
              className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold flex items-center gap-1"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Agregar Insumo</span>
            </button>
          </div>
        </div>

        {/* Lista de ingredientes */}
        <div className="space-y-2">
          <h4 className="font-bold text-white text-xs">Ingredientes en la Receta ({ingredients.length})</h4>
          {ingredients.length === 0 ? (
            <p className="text-xs text-slate-500 italic">No hay ingredientes asignados a este plato.</p>
          ) : (
            <div className="space-y-1.5 max-h-48 overflow-y-auto text-xs">
              {ingredients.map((ing) => {
                const s = supplyMap.get(ing.supplyItemId);
                const subCost = (s?.costPerUnit || 0) * ing.quantity;

                return (
                  <div
                    key={ing.supplyItemId}
                    className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between"
                  >
                    <div>
                      <span className="font-bold text-white">{s?.name || "Insumo"}</span>
                      <span className="text-[11px] text-slate-400 block font-mono">
                        {ing.quantity} {s?.unit} × ${Number(s?.costPerUnit || 0).toFixed(3)}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-amber-400">
                        ${subCost.toFixed(3)}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveIngredient(ing.supplyItemId)}
                        className="p-1 text-red-400 hover:text-red-300"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Banner de Rentabilidad */}
        <div className="p-3 bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent border border-emerald-500/30 rounded-xl flex items-center justify-between text-xs">
          <div>
            <span className="text-slate-400 block text-[11px]">Costo Teórico de Producción:</span>
            <span className="font-mono font-black text-white text-base">
              ${theoreticalCost.toFixed(2)}
            </span>
          </div>
          <div className="text-right">
            <span className="text-slate-400 block text-[11px]">Margen Bruto de Utilidad:</span>
            <span
              className={`font-mono font-black text-base ${
                profitMargin > 50 ? "text-emerald-400" : "text-amber-400"
              }`}
            >
              {profitMargin}% (~+${(Number(dish.price) - theoreticalCost).toFixed(2)})
            </span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 text-slate-300 hover:bg-slate-700"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSaveRecipe}
            disabled={saving}
            className="px-5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white shadow-lg disabled:opacity-50"
          >
            {saving ? "Guardando..." : "Guardar Receta y Actualizar Costo"}
          </button>
        </div>
      </div>
    </div>
  );
}
