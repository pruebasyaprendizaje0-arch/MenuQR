"use client";

import React, { useState, useRef } from "react";
import * as XLSX from "xlsx";
import {
  FileSpreadsheet,
  Upload,
  Download,
  CheckCircle2,
  AlertTriangle,
  X,
  FileCheck,
  Trash2,
  Layers,
  ArrowRight,
  TrendingUp,
  Truck,
  Package,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import { extractDishRow, parsePriceValue, fixMojibake } from "@/lib/batch-dishes-parser";
import {
  batchImportOrUpdateInventoryAction,
  BatchInventoryDishInput,
} from "@/lib/inventory-actions";
import { ResolvedBusinessLabels } from "@/lib/business-labels";

interface ParsedInventoryRow {
  id: string;
  name: string;
  categoryName: string;
  description: string;
  price: number;
  costPrice: number;
  stock: number | null;
  minStock: number;
  supplierName?: string;
  barcode?: string;
  sku?: string;
  isAvailable: boolean;
  isExistingMatch: boolean;
  existingDishId?: string;
  isSupplierExisting: boolean;
  hasError: boolean;
  errorMessage?: string;
}

interface BatchInventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  restaurantId: string;
  restaurantSlug: string;
  existingDishes: any[];
  existingSuppliers: any[];
  bLabels: ResolvedBusinessLabels;
}

export default function BatchInventoryModal({
  isOpen,
  onClose,
  onSuccess,
  restaurantId,
  restaurantSlug,
  existingDishes,
  existingSuppliers,
  bLabels,
}: BatchInventoryModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedInventoryRow[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Mapas para verificar coincidencias existentes
  const dishByCode = new Map<string, any>();
  const dishByName = new Map<string, any>();

  existingDishes.forEach((d) => {
    if (d.sku && d.sku.trim()) dishByCode.set(d.sku.trim().toLowerCase(), d);
    if (d.barcode && d.barcode.trim()) dishByCode.set(d.barcode.trim().toLowerCase(), d);
    dishByName.set(d.name.trim().toLowerCase(), d);
  });

  const supplierByName = new Set(
    existingSuppliers.map((s) => s.name.trim().toLowerCase())
  );

  // 1. Descargar Plantilla Oficial
  const handleDownloadTemplate = (format: "xlsx" | "csv") => {
    const templateData = [
      {
        Categoria: "Empanadas",
        Nombre: "Empanada Gigante de Camarón",
        Codigo_Barras_SKU: "EMP-CAM-01",
        Stock_Actual: 25,
        Stock_Minimo: 5,
        Costo_Compra: 1.50,
        Precio_Venta: 4.50,
        Proveedor_Habitual: "Mariscos del Pacífico",
        Disponible: "SI",
        Descripcion: "Rellena de camarones frescos y queso fundido",
      },
      {
        Categoria: "Empanadas",
        Nombre: "Empanada Gigante de Carne y Queso",
        Codigo_Barras_SKU: "EMP-CAR-02",
        Stock_Actual: 30,
        Stock_Minimo: 5,
        Costo_Compra: 1.20,
        Precio_Venta: 3.50,
        Proveedor_Habitual: "Carnes La Andina",
        Disponible: "SI",
        Descripcion: "Carne picada seleccionada y queso mozzarella",
      },
      {
        Categoria: "Bebidas & Cocteles",
        Nombre: "Jugo Natural de Maracuyá",
        Codigo_Barras_SKU: "BEB-MAR-03",
        Stock_Actual: 40,
        Stock_Minimo: 8,
        Costo_Compra: 0.80,
        Precio_Venta: 2.50,
        Proveedor_Habitual: "Frutas del Valle",
        Disponible: "SI",
        Descripcion: "Jugo natural recién preparado con pulpa fresca",
      },
      {
        Categoria: "Bebidas & Cocteles",
        Nombre: "Mojito Playero",
        Codigo_Barras_SKU: "BEB-MOJ-04",
        Stock_Actual: 20,
        Stock_Minimo: 4,
        Costo_Compra: 1.60,
        Precio_Venta: 5.00,
        Proveedor_Habitual: "Licores del Pacífico",
        Disponible: "SI",
        Descripcion: "Ron blanco, menta fresca, limón y soda",
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    worksheet["!cols"] = [
      { wch: 20 }, // Categoria
      { wch: 34 }, // Nombre
      { wch: 20 }, // Codigo_Barras_SKU
      { wch: 14 }, // Stock_Actual
      { wch: 14 }, // Stock_Minimo
      { wch: 14 }, // Costo_Compra
      { wch: 14 }, // Precio_Venta
      { wch: 26 }, // Proveedor_Habitual
      { wch: 12 }, // Disponible
      { wch: 45 }, // Descripcion
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Plantilla_Inventario");

    if (format === "xlsx") {
      XLSX.writeFile(workbook, `plantilla_inventario_${restaurantSlug}.xlsx`);
    } else {
      const csvData = "\uFEFF" + XLSX.utils.sheet_to_csv(worksheet);
      const blob = new Blob([csvData], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `plantilla_inventario_${restaurantSlug}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  };

  // 2. Procesar Archivo Cargado
  const processFile = async (uploadedFile: File) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setFile(uploadedFile);

    try {
      const isCsv = uploadedFile.name.toLowerCase().endsWith(".csv");
      const rawBuffer = await uploadedFile.arrayBuffer();
      let workbook: XLSX.WorkBook;

      if (isCsv) {
        let textContent = new TextDecoder("utf-8").decode(rawBuffer);
        if (textContent.includes("\uFFFD")) {
          try {
            textContent = new TextDecoder("windows-1252").decode(rawBuffer);
          } catch {
            // fallback
          }
        }
        workbook = XLSX.read(textContent, { type: "string", raw: true });
      } else {
        workbook = XLSX.read(rawBuffer, { type: "array", codepage: 65001 });
      }

      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) {
        setErrorMsg("El archivo no contiene ninguna hoja válida.");
        return;
      }

      const worksheet = workbook.Sheets[firstSheetName];
      const rawData = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: "" });

      if (rawData.length === 0) {
        setErrorMsg("El archivo está vacío o no contiene filas de datos.");
        return;
      }

      const mappedRows: ParsedInventoryRow[] = [];

      rawData.forEach((row, index) => {
        const extracted = extractDishRow(row);

        const categoryName = extracted.categoryName || "General";
        const name = extracted.name || "";
        const description = extracted.description || "";
        const price = extracted.price;
        const costPrice = extracted.costPrice || 0;
        const stock = extracted.stock;
        const minStock = extracted.minStock || 0;
        const supplierName = extracted.supplierName;
        const barcode = extracted.barcode;
        const sku = extracted.sku;
        const isAvailable = extracted.isAvailable;

        // Comprobar coincidencia con producto existente
        let matchedDish: any = null;
        if (barcode && dishByCode.has(barcode.toLowerCase())) {
          matchedDish = dishByCode.get(barcode.toLowerCase());
        }
        if (!matchedDish && sku && dishByCode.has(sku.toLowerCase())) {
          matchedDish = dishByCode.get(sku.toLowerCase());
        }
        if (!matchedDish && name && dishByName.has(name.toLowerCase())) {
          matchedDish = dishByName.get(name.toLowerCase());
        }

        const isExistingMatch = Boolean(matchedDish);
        const existingDishId = matchedDish?.id;
        const isSupplierExisting = supplierName
          ? supplierByName.has(supplierName.toLowerCase())
          : false;

        let hasError = false;
        let errorMessage = "";

        if (!name || name.trim().length === 0) {
          hasError = true;
          errorMessage = "Falta el nombre del ítem.";
        } else if (price < 0 || isNaN(price)) {
          hasError = true;
          errorMessage = "Precio inválido.";
        } else if (costPrice < 0 || isNaN(costPrice)) {
          hasError = true;
          errorMessage = "Costo de compra inválido.";
        }

        if (name || categoryName !== "General" || price > 0 || costPrice > 0) {
          mappedRows.push({
            id: `row-${index}-${Date.now()}`,
            name,
            categoryName,
            description,
            price,
            costPrice,
            stock,
            minStock,
            supplierName,
            barcode,
            sku,
            isAvailable,
            isExistingMatch,
            existingDishId,
            isSupplierExisting,
            hasError,
            errorMessage,
          });
        }
      });

      if (mappedRows.length === 0) {
        setErrorMsg("No se pudieron extraer datos válidos del archivo. Verifica las cabeceras de columna.");
        return;
      }

      setParsedRows(mappedRows);
    } catch (err: any) {
      console.error(err);
      setErrorMsg("Ocurrió un error al leer el archivo. Asegúrate de que sea un archivo Excel (.xlsx, .xls) o CSV válido.");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleRemoveRow = (id: string) => {
    setParsedRows((prev) => prev.filter((r) => r.id !== id));
  };

  // 3. Confirmar e Importar / Actualizar
  const handleConfirmImport = async () => {
    const validRows = parsedRows.filter((r) => !r.hasError && r.name.trim().length > 0);
    if (validRows.length === 0) {
      setErrorMsg("No hay filas válidas listas para importar. Corrige o elimina las filas con errores.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    const payload: BatchInventoryDishInput[] = validRows.map((r) => ({
      id: r.existingDishId,
      name: r.name,
      categoryName: r.categoryName,
      description: r.description,
      price: r.price,
      costPrice: r.costPrice,
      stock: r.stock,
      minStock: r.minStock,
      trackStock: r.stock !== null,
      supplierName: r.supplierName,
      barcode: r.barcode,
      sku: r.sku,
      isAvailable: r.isAvailable,
    }));

    try {
      const res = await batchImportOrUpdateInventoryAction(restaurantId, payload);
      setLoading(false);

      if (res.error) {
        setErrorMsg(res.error);
      } else {
        const supInfo = res.suppliersCreated ? ` y se registraron ${res.suppliersCreated} nuevos proveedores.` : ".";
        setSuccessMsg(
          `¡Inventario actualizado con éxito! Se actualizaron ${res.updatedCount || 0} productos existentes, se crearon ${res.createdCount || 0} nuevos${supInfo}`
        );
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1800);
      }
    } catch (err: any) {
      setLoading(false);
      setErrorMsg("Error al procesar lote: " + (err.message || "desconocido"));
    }
  };

  const validCount = parsedRows.filter((r) => !r.hasError && r.name.trim().length > 0).length;
  const updateMatchesCount = parsedRows.filter((r) => !r.hasError && r.isExistingMatch).length;
  const newItemsCount = parsedRows.filter((r) => !r.hasError && !r.isExistingMatch).length;
  const newSuppliersCount = new Set(
    parsedRows
      .filter((r) => !r.hasError && r.supplierName && !r.isSupplierExisting)
      .map((r) => r.supplierName!.trim().toLowerCase())
  ).size;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-5xl rounded-3xl shadow-2xl overflow-hidden my-auto flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800/80 bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-amber-600 to-emerald-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <FileSpreadsheet className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                Actualización de Inventario en Lote
                <span className="text-[10px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Excel & CSV
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Sube o actualiza costos de compra, existencias, precios y proveedores en un solo paso sin duplicar productos.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {errorMsg && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-xs text-red-300 flex items-center gap-2.5">
              <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-xs text-emerald-300 flex items-center gap-2.5 animate-pulse">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
              <span className="font-bold">{successMsg}</span>
            </div>
          )}

          {/* Plantilla y Zona de Carga */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80 space-y-3">
              <div className="flex items-center gap-2 text-white font-bold text-xs">
                <Download className="h-4 w-4 text-amber-400" />
                <span>1. Descarga la Plantilla Oficial</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Usa nuestra plantilla formateada con columnas para <strong>Costo de Compra</strong>, <strong>Proveedor Habitual</strong>, <strong>Stock</strong> y <strong>Código de Barras</strong>.
              </p>
              <div className="flex flex-col gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleDownloadTemplate("xlsx")}
                  className="flex items-center justify-center gap-1.5 w-full py-2 px-3 rounded-xl bg-slate-850 hover:bg-slate-800 border border-slate-750 text-slate-200 text-xs font-bold transition"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Plantilla Excel (.xlsx)</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadTemplate("csv")}
                  className="flex items-center justify-center gap-1.5 w-full py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 text-xs font-semibold transition"
                >
                  <Download className="h-3.5 w-3.5 text-slate-400" />
                  <span>Plantilla CSV (.csv)</span>
                </button>
              </div>
            </div>

            {/* Zona de Drop */}
            <div
              onDrop={handleDrop}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onClick={() => fileInputRef.current?.click()}
              className={`md:col-span-2 border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                isDragging
                  ? "border-amber-500 bg-amber-500/10"
                  : "border-slate-800 hover:border-slate-700 bg-slate-950/30"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                className="hidden"
                onChange={handleFileChange}
              />
              <div className="h-12 w-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mb-3">
                <Upload className="h-5 w-5 text-amber-400" />
              </div>
              <h4 className="text-sm font-bold text-white mb-1">
                {file ? file.name : "Haz clic o arrastra tu archivo aquí"}
              </h4>
              <p className="text-xs text-slate-400 max-w-sm">
                Soporta archivos <strong>.xlsx</strong>, <strong>.xls</strong> o <strong>.csv</strong>. Si el producto ya existe (por nombre o SKU), actualizará sus costos y stock sin duplicarlo.
              </p>
            </div>
          </div>

          {/* Vista previa de filas */}
          {parsedRows.length > 0 && (
            <div className="space-y-3">
              {/* Resumen de Detección */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Total Filas</span>
                  <span className="text-lg font-black text-white font-mono">{validCount}</span>
                </div>
                <div className="p-3 bg-amber-950/20 border border-amber-500/30 rounded-xl">
                  <span className="text-[10px] text-amber-300 uppercase font-bold block">Actualizaciones</span>
                  <span className="text-lg font-black text-amber-400 font-mono">
                    {updateMatchesCount} <span className="text-xs font-normal">existentes</span>
                  </span>
                </div>
                <div className="p-3 bg-emerald-950/20 border border-emerald-500/30 rounded-xl">
                  <span className="text-[10px] text-emerald-300 uppercase font-bold block">Nuevos Ítems</span>
                  <span className="text-lg font-black text-emerald-400 font-mono">
                    {newItemsCount} <span className="text-xs font-normal">a crear</span>
                  </span>
                </div>
                <div className="p-3 bg-sky-950/20 border border-sky-500/30 rounded-xl">
                  <span className="text-[10px] text-sky-300 uppercase font-bold block">Proveedores Nuevos</span>
                  <span className="text-lg font-black text-sky-400 font-mono">
                    {newSuppliersCount} <span className="text-xs font-normal">auto-registro</span>
                  </span>
                </div>
              </div>

              {/* Tabla de Preview */}
              <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950/60 shadow-lg">
                <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-2">
                    <FileCheck className="h-4 w-4 text-emerald-400" />
                    Vista Previa de Ítems Detectados ({parsedRows.length})
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Revisa las acciones automáticas antes de confirmar
                  </span>
                </div>

                <div className="overflow-x-auto max-h-72 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-bold sticky top-0 border-b border-slate-800">
                      <tr>
                        <th className="px-3 py-2.5">Acción</th>
                        <th className="px-3 py-2.5">Producto / Categoría</th>
                        <th className="px-3 py-2.5">Costo Compra</th>
                        <th className="px-3 py-2.5">Precio Venta</th>
                        <th className="px-3 py-2.5">Margen</th>
                        <th className="px-3 py-2.5">Stock</th>
                        <th className="px-3 py-2.5">Proveedor Habitual</th>
                        <th className="px-3 py-2.5 text-right">Quitar</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {parsedRows.map((r) => {
                        const margin = r.price > 0 ? (((r.price - r.costPrice) / r.price) * 100) : 0;
                        return (
                          <tr key={r.id} className="hover:bg-slate-900/40 transition">
                            <td className="px-3 py-2.5 whitespace-nowrap">
                              {r.hasError ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/20 text-red-300 border border-red-500/30">
                                  Error
                                </span>
                              ) : r.isExistingMatch ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1 w-fit">
                                  <RefreshCw className="h-2.5 w-2.5" />
                                  Actualizar
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 w-fit">
                                  <Sparkles className="h-2.5 w-2.5" />
                                  Crear Nuevo
                                </span>
                              )}
                            </td>

                            <td className="px-3 py-2.5">
                              <span className="font-bold text-white block">{r.name}</span>
                              <span className="text-[10px] text-slate-400">
                                [{r.categoryName}] {r.barcode ? `· SKU: ${r.barcode}` : ""}
                              </span>
                            </td>

                            <td className="px-3 py-2.5 font-mono text-amber-300 font-bold whitespace-nowrap">
                              ${r.costPrice.toFixed(2)}
                            </td>

                            <td className="px-3 py-2.5 font-mono text-white font-bold whitespace-nowrap">
                              ${r.price.toFixed(2)}
                            </td>

                            <td className="px-3 py-2.5 whitespace-nowrap">
                              <span
                                className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                  margin > 50
                                    ? "bg-emerald-500/20 text-emerald-300"
                                    : margin > 20
                                    ? "bg-blue-500/20 text-blue-300"
                                    : "bg-amber-500/20 text-amber-300"
                                }`}
                              >
                                +{margin.toFixed(0)}%
                              </span>
                            </td>

                            <td className="px-3 py-2.5 font-mono whitespace-nowrap text-slate-300">
                              {r.stock !== null ? `${r.stock} u.` : "Sin límite"}
                            </td>

                            <td className="px-3 py-2.5 whitespace-nowrap">
                              {r.supplierName ? (
                                <span className="flex items-center gap-1 text-slate-300 font-medium">
                                  <Truck className="h-3 w-3 text-slate-500" />
                                  {r.supplierName}
                                  {!r.isSupplierExisting && (
                                    <span className="text-[9px] bg-sky-500/20 text-sky-300 px-1.5 py-0.2 rounded font-bold">
                                      Nuevo
                                    </span>
                                  )}
                                </span>
                              ) : (
                                <span className="text-slate-600 italic">No asignado</span>
                              )}
                            </td>

                            <td className="px-3 py-2.5 text-right whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => handleRemoveRow(r.id)}
                                className="p-1 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/50 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleConfirmImport}
            disabled={loading || validCount === 0}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-600 to-emerald-600 hover:from-amber-500 hover:to-emerald-500 text-white shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span>Procesando...</span>
            ) : (
              <>
                <FileCheck className="h-4 w-4" />
                <span>Confirmar e Importar ({validCount} Ítems)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
