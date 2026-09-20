"use client";

import React, { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { 
  X, 
  UploadCloud, 
  FileSpreadsheet, 
  Download, 
  CheckCircle2, 
  AlertTriangle, 
  Trash2, 
  RefreshCw, 
  Sparkles, 
  Layers, 
  Info, 
  Check, 
  AlertCircle 
} from "lucide-react";
import { createBatchDishesAction, BatchDishInput } from "@/lib/actions";

interface BatchDishModalProps {
  isOpen: boolean;
  onClose: () => void;
  restaurantId: string;
  categories: Array<{ id: string; name: string }>;
  onSuccess: () => void;
}

interface ParsedDishRow extends BatchDishInput {
  id: string;
  isNewCategory: boolean;
  hasError: boolean;
  errorMessage?: string;
}

export default function BatchDishModal({
  isOpen,
  onClose,
  restaurantId,
  categories,
  onSuccess,
}: BatchDishModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [parsedRows, setParsedRows] = useState<ParsedDishRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const existingCategoryNames = new Set(
    categories.map((c) => c.name.trim().toLowerCase())
  );

  // 1. Generate & Download Template
  const handleDownloadTemplate = (format: "xlsx" | "csv") => {
    const defaultCats = categories.length > 0
      ? categories.slice(0, 3).map((c) => c.name)
      : ["Pizzas", "Pastas", "Bebidas"];

    const templateData = [
      {
        Categoria: defaultCats[0] || "Pizzas",
        Nombre: "Pizza Margherita Especial",
        Descripcion: "Salsa de tomate casera, mozzarella fior di latte, albahaca fresca y aceite de oliva virgen extra.",
        Precio: 12.50,
        Disponible: "SI",
        URL_Imagen: "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=500",
      },
      {
        Categoria: defaultCats[0] || "Pizzas",
        Nombre: "Pizza Cuatro Quesos",
        Descripcion: "Mozzarella, gorgonzola, parmesano reggiano y queso de cabra.",
        Precio: 14.00,
        Disponible: "SI",
        URL_Imagen: "",
      },
      {
        Categoria: defaultCats[1] || "Pastas",
        Nombre: "Fettuccine Alfredo con Pollo",
        Descripcion: "Pasta fresca al huevo con crema de queso parmesano y pechuga a la parrilla.",
        Precio: 15.50,
        Disponible: "SI",
        URL_Imagen: "",
      },
      {
        Categoria: defaultCats[2] || "Bebidas",
        Nombre: "Limonada Natural con Menta",
        Descripcion: "Jugo de limón natural recién exprimido con hojas de menta fresca y hielo.",
        Precio: 3.50,
        Disponible: "SI",
        URL_Imagen: "",
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);

    // Set column widths
    worksheet["!cols"] = [
      { wch: 18 }, // Categoria
      { wch: 30 }, // Nombre
      { wch: 45 }, // Descripcion
      { wch: 12 }, // Precio
      { wch: 12 }, // Disponible
      { wch: 35 }, // URL_Imagen
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Platos");

    if (format === "xlsx") {
      XLSX.writeFile(workbook, "plantilla_menuqr_platos.xlsx");
    } else {
      XLSX.writeFile(workbook, "plantilla_menuqr_platos.csv", { bookType: "csv" });
    }
  };

  // 2. Parse Uploaded File
  const processFile = async (uploadedFile: File) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setFile(uploadedFile);

    try {
      const buffer = await uploadedFile.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
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

      const mappedRows: ParsedDishRow[] = [];

      rawData.forEach((row, index) => {
        // Flexible key lookups
        const getVal = (possibleKeys: string[]) => {
          for (const key of Object.keys(row)) {
            const cleanKey = key.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            for (const target of possibleKeys) {
              if (cleanKey === target.toLowerCase()) {
                return String(row[key] ?? "").trim();
              }
            }
          }
          return "";
        };

        const categoryName = getVal(["categoria", "category", "seccion", "tipo"]) || "General";
        const name = getVal(["nombre", "name", "plato", "nombre del plato", "item"]);
        const description = getVal(["descripcion", "description", "detalle"]);
        const rawPrice = getVal(["precio", "price", "costo", "valor"]);
        const rawAvailable = getVal(["disponible", "available", "activo", "estado"]).toUpperCase();
        const imageUrl = getVal(["url_imagen", "imagen", "image", "url", "imageurl", "foto"]);

        // Clean price
        const parsedPrice = parseFloat(rawPrice.replace(/[^0-9.-]+/g, "")) || 0;
        const isAvailable = rawAvailable !== "NO" && rawAvailable !== "FALSE" && rawAvailable !== "0";

        const isNewCategory = !existingCategoryNames.has(categoryName.toLowerCase());

        let hasError = false;
        let errorMessage = "";

        if (!name || name.length === 0) {
          hasError = true;
          errorMessage = "Falta el nombre del plato.";
        } else if (parsedPrice < 0 || isNaN(parsedPrice)) {
          hasError = true;
          errorMessage = "El precio debe ser un número mayor o igual a 0.";
        }

        // Only include if at least name or category was filled
        if (name || categoryName !== "General" || rawPrice) {
          mappedRows.push({
            id: `row-${index}-${Date.now()}`,
            name,
            description,
            price: parsedPrice,
            categoryName,
            isAvailable,
            imageUrl: imageUrl || undefined,
            isNewCategory,
            hasError,
            errorMessage,
          });
        }
      });

      if (mappedRows.length === 0) {
        setErrorMsg("No se pudieron extraer platos válidos del archivo. Verifica las cabeceras de columna.");
        return;
      }

      setParsedRows(mappedRows);
    } catch (err: any) {
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

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleRemoveRow = (id: string) => {
    setParsedRows((prev) => prev.filter((r) => r.id !== id));
  };

  const handleUpdateRow = (id: string, field: keyof ParsedDishRow, value: any) => {
    setParsedRows((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        const updated = { ...row, [field]: value };
        
        // Re-evaluate error state
        if (field === "name" || field === "price") {
          if (!updated.name || updated.name.trim().length === 0) {
            updated.hasError = true;
            updated.errorMessage = "Falta el nombre del plato.";
          } else if (updated.price < 0 || isNaN(updated.price)) {
            updated.hasError = true;
            updated.errorMessage = "Precio inválido.";
          } else {
            updated.hasError = false;
            updated.errorMessage = undefined;
          }
        }

        if (field === "categoryName") {
          updated.isNewCategory = !existingCategoryNames.has(String(value).trim().toLowerCase());
        }

        return updated;
      })
    );
  };

  // 3. Confirm and Import
  const handleConfirmImport = async () => {
    const validRows = parsedRows.filter((r) => !r.hasError && r.name.trim().length > 0);
    if (validRows.length === 0) {
      setErrorMsg("No hay platos válidos listos para importar. Corrige o elimina las filas con errores.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    const payload: BatchDishInput[] = validRows.map((r) => ({
      name: r.name,
      description: r.description,
      price: r.price,
      categoryName: r.categoryName,
      isAvailable: r.isAvailable,
      imageUrl: r.imageUrl,
    }));

    const res = await createBatchDishesAction(restaurantId, payload);
    setLoading(false);

    if (res.error) {
      setErrorMsg(res.error);
    } else {
      setSuccessMsg(`¡Importación exitosa! Se agregaron ${res.count} platos${res.createdCategoriesCount ? ` y se crearon ${res.createdCategoriesCount} nuevas categorías.` : "."}`);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1800);
    }
  };

  const validCount = parsedRows.filter((r) => !r.hasError && r.name.trim().length > 0).length;
  const errorCount = parsedRows.filter((r) => r.hasError).length;
  const newCatCount = new Set(
    parsedRows.filter((r) => !r.hasError && r.isNewCategory).map((r) => r.categoryName.trim().toLowerCase())
  ).size;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden my-auto flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800/80 bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-red-600 to-amber-500 flex items-center justify-center shadow-lg shadow-red-500/20">
              <FileSpreadsheet className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                Subida de Platos por Lotes
                <span className="text-[10px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  Excel & CSV
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Importa decenas de platos en segundos con categorías y precios automáticos.
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

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
          {/* Messages */}
          {errorMsg && (
            <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-3 animate-shake">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-3">
              <Check className="h-5 w-5 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Step 1: Download Templates */}
          <div className="bg-slate-950/50 border border-slate-800/80 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <Download className="h-4 w-4 text-amber-400" />
                <span>Paso 1: Descarga la Plantilla de Ejemplo</span>
              </div>
              <p className="text-xs text-slate-400 max-w-md">
                Usa nuestro archivo estructurado para llenar tus platos sin errores de formato.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => handleDownloadTemplate("xlsx")}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 transition-all"
              >
                <FileSpreadsheet className="h-4 w-4" />
                Plantilla Excel (.xlsx)
              </button>
              <button
                type="button"
                onClick={() => handleDownloadTemplate("csv")}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-all"
              >
                <Download className="h-4 w-4" />
                CSV (.csv)
              </button>
            </div>
          </div>

          {/* Step 2: Drag & Drop Zone */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-3xl p-8 text-center cursor-pointer transition-all duration-200 ${
              isDragging
                ? "border-amber-500 bg-amber-500/5 scale-[0.99]"
                : file
                ? "border-emerald-500/40 bg-emerald-500/5 hover:border-emerald-500/60"
                : "border-slate-800 bg-slate-950/30 hover:border-slate-700 hover:bg-slate-950/60"
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".xlsx, .xls, .csv"
              className="hidden"
            />
            <div className="flex flex-col items-center justify-center space-y-3">
              <div
                className={`h-14 w-14 rounded-2xl flex items-center justify-center transition-all ${
                  file
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                    : "bg-slate-800/80 text-slate-400 border border-slate-700"
                }`}
              >
                {file ? (
                  <CheckCircle2 className="h-7 w-7 text-emerald-400" />
                ) : (
                  <UploadCloud className="h-7 w-7 text-amber-400" />
                )}
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-white">
                  {file ? file.name : "Arrastra tu archivo aquí o haz clic para examinar"}
                </p>
                <p className="text-xs text-slate-400">
                  Soporta archivos <strong className="text-slate-300">.xlsx</strong>, <strong className="text-slate-300">.xls</strong> y <strong className="text-slate-300">.csv</strong>
                </p>
              </div>
              {file && (
                <span className="text-[11px] text-emerald-400 font-semibold px-3 py-1 bg-emerald-500/10 rounded-full border border-emerald-500/20">
                  Archivo cargado correctamente • Haz clic para cambiar
                </span>
              )}
            </div>
          </div>

          {/* Step 3: Preview Table */}
          {parsedRows.length > 0 && (
            <div className="space-y-4">
              {/* Summary stats bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-slate-950/60 border border-slate-800 rounded-2xl">
                <div className="flex items-center gap-3 text-xs">
                  <span className="font-semibold text-white flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4 text-amber-400" />
                    {parsedRows.length} platos detectados
                  </span>
                  <span className="text-slate-600">|</span>
                  <span className="text-emerald-400 font-medium">
                    ✓ {validCount} listos para importar
                  </span>
                  {newCatCount > 0 && (
                    <>
                      <span className="text-slate-600">|</span>
                      <span className="text-amber-400 font-medium flex items-center gap-1">
                        <Layers className="h-3.5 w-3.5" />
                        {newCatCount} categorías nuevas
                      </span>
                    </>
                  )}
                  {errorCount > 0 && (
                    <>
                      <span className="text-slate-600">|</span>
                      <span className="text-red-400 font-medium">
                        ⚠ {errorCount} con advertencia
                      </span>
                    </>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setParsedRows([]);
                    setFile(null);
                  }}
                  className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Limpiar lista
                </button>
              </div>

              {/* Table */}
              <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950/40">
                <div className="max-h-72 overflow-y-auto custom-scrollbar">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="sticky top-0 bg-slate-900 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[10px] z-10">
                      <tr>
                        <th className="py-3 px-3">Estado</th>
                        <th className="py-3 px-3">Categoría</th>
                        <th className="py-3 px-3">Nombre del Plato</th>
                        <th className="py-3 px-3">Descripción</th>
                        <th className="py-3 px-3 w-24">Precio ($)</th>
                        <th className="py-3 px-3 w-20 text-center">Disp.</th>
                        <th className="py-3 px-3 w-10 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      {parsedRows.map((row) => (
                        <tr
                          key={row.id}
                          className={`hover:bg-slate-800/30 transition-colors ${
                            row.hasError ? "bg-red-500/5" : ""
                          }`}
                        >
                          {/* Status Badge */}
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            {row.hasError ? (
                              <span 
                                title={row.errorMessage}
                                className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-red-500/10 text-red-400 border border-red-500/20"
                              >
                                <AlertTriangle className="h-3 w-3" /> Error
                              </span>
                            ) : row.isNewCategory ? (
                              <span 
                                title="Se creará esta nueva categoría automáticamente"
                                className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20"
                              >
                                + Nueva Cat.
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                <Check className="h-3 w-3" /> Listo
                              </span>
                            )}
                          </td>

                          {/* Category */}
                          <td className="py-2.5 px-3">
                            <input
                              type="text"
                              value={row.categoryName}
                              onChange={(e) => handleUpdateRow(row.id, "categoryName", e.target.value)}
                              className="bg-transparent border border-transparent hover:border-slate-700 focus:border-amber-500/50 rounded px-1.5 py-0.5 text-xs text-white focus:outline-none focus:bg-slate-900 w-28"
                            />
                          </td>

                          {/* Dish Name */}
                          <td className="py-2.5 px-3">
                            <input
                              type="text"
                              value={row.name}
                              onChange={(e) => handleUpdateRow(row.id, "name", e.target.value)}
                              placeholder="Nombre obligatorio"
                              className={`bg-transparent border ${
                                row.hasError && !row.name
                                  ? "border-red-500/60 bg-red-500/10 text-red-300"
                                  : "border-transparent hover:border-slate-700 focus:border-amber-500/50"
                              } rounded px-1.5 py-0.5 text-xs text-white focus:outline-none focus:bg-slate-900 w-full min-w-[130px] font-medium`}
                            />
                          </td>

                          {/* Description */}
                          <td className="py-2.5 px-3">
                            <input
                              type="text"
                              value={row.description || ""}
                              onChange={(e) => handleUpdateRow(row.id, "description", e.target.value)}
                              placeholder="Opcional..."
                              className="bg-transparent border border-transparent hover:border-slate-700 focus:border-amber-500/50 rounded px-1.5 py-0.5 text-xs text-slate-300 focus:outline-none focus:bg-slate-900 w-full min-w-[160px]"
                            />
                          </td>

                          {/* Price */}
                          <td className="py-2.5 px-3">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={row.price}
                              onChange={(e) => handleUpdateRow(row.id, "price", parseFloat(e.target.value) || 0)}
                              className="bg-transparent border border-transparent hover:border-slate-700 focus:border-amber-500/50 rounded px-1.5 py-0.5 text-xs text-amber-400 font-bold focus:outline-none focus:bg-slate-900 w-20 text-right"
                            />
                          </td>

                          {/* Availability Toggle */}
                          <td className="py-2.5 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleUpdateRow(row.id, "isAvailable", !row.isAvailable)}
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase transition-all ${
                                row.isAvailable
                                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                  : "bg-slate-800 text-slate-500 border border-slate-700"
                              }`}
                            >
                              {row.isAvailable ? "SÍ" : "NO"}
                            </button>
                          </td>

                          {/* Delete row */}
                          <td className="py-2.5 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveRow(row.id)}
                              className="text-slate-500 hover:text-red-400 p-1 rounded-md hover:bg-red-500/10 transition-colors"
                              title="Eliminar fila"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex items-start gap-2 text-[11px] text-slate-400 bg-slate-950/40 p-3 rounded-xl border border-slate-800/60">
                <Info className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                <p>
                  <strong>Tip pro:</strong> Puedes editar el nombre, categoría y precio directamente en la tabla antes de confirmar. Las categorías nuevas identificadas se crearán de forma 100% automática.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800/80 bg-slate-950/60 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleConfirmImport}
            disabled={loading || parsedRows.length === 0 || validCount === 0}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-red-600 via-amber-600 to-amber-500 hover:from-red-500 hover:to-amber-400 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-amber-500/20 transition-all duration-200"
          >
            {loading ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Importando {validCount} platos...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Confirmar e Importar {validCount > 0 ? `${validCount} Platos` : ""}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
