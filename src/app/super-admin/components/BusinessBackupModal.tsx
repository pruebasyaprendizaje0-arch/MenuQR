"use client";

import { useState } from "react";
import { 
  X, 
  Upload, 
  FileArchive, 
  CheckCircle2, 
  AlertTriangle, 
  Info, 
  RefreshCw, 
  ShieldAlert, 
  Sparkles, 
  ExternalLink,
  Store,
  Layers
} from "lucide-react";
import type { BackupInspectionResult, RestoreBackupResult } from "@/lib/business-backup";

interface RestaurantOption {
  id: string;
  name: string;
  slug: string;
}

interface BusinessBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  restaurants: RestaurantOption[];
  onRestoredSuccess?: () => void;
}

export function BusinessBackupModal({
  isOpen,
  onClose,
  restaurants,
  onRestoredSuccess,
}: BusinessBackupModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [targetRestaurantId, setTargetRestaurantId] = useState<string>("");
  const [mode, setMode] = useState<"UPDATE_EXISTING" | "CREATE_NEW">("UPDATE_EXISTING");
  const [customNewSlug, setCustomNewSlug] = useState<string>("");
  const [confirmedByUser, setConfirmedByUser] = useState<boolean>(false);
  const [confirmMergeConflicts, setConfirmMergeConflicts] = useState<boolean>(false);

  // Estados de carga y resultados
  const [isInspecting, setIsInspecting] = useState<boolean>(false);
  const [inspectionResult, setInspectionResult] = useState<BackupInspectionResult | null>(null);
  const [inspectionError, setInspectionError] = useState<string | null>(null);

  const [isRestoring, setIsRestoring] = useState<boolean>(false);
  const [restoreResult, setRestoreResult] = useState<RestoreBackupResult | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setSelectedFile(file);
    setInspectionResult(null);
    setInspectionError(null);
    setRestoreResult(null);
    setRestoreError(null);
    setConfirmedByUser(false);
    setConfirmMergeConflicts(false);
  };

  const handleInspect = async () => {
    if (!selectedFile) {
      setInspectionError("Por favor selecciona un archivo .zip de respaldo.");
      return;
    }

    setIsInspecting(true);
    setInspectionError(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      if (targetRestaurantId) {
        formData.append("targetRestaurantId", targetRestaurantId);
      }

      const res = await fetch("/api/superadmin/backup/inspect", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Error al inspeccionar el archivo de respaldo.");
      }

      setInspectionResult(data.inspection);

      if (data.inspection.targetStatus?.targetId) {
        setTargetRestaurantId(data.inspection.targetStatus.targetId);
        setMode("UPDATE_EXISTING");
      } else {
        setMode("CREATE_NEW");
        setCustomNewSlug(data.inspection.dataPreview.slug);
      }
    } catch (err: any) {
      setInspectionError(err?.message || "Ocurrió un error al procesar el archivo ZIP.");
    } finally {
      setIsInspecting(false);
    }
  };

  const handleExecuteRestore = async () => {
    if (!selectedFile || !confirmedByUser) return;

    // Validación estricta de slug sin sufijos aleatorios
    if (mode === "CREATE_NEW") {
      const cleanSlug = customNewSlug.trim().toLowerCase();
      if (!cleanSlug) {
        setRestoreError("Debe ingresar un slug válido para el nuevo negocio.");
        return;
      }
      if (
        inspectionResult?.conflicts?.slugTakenByOther &&
        cleanSlug === inspectionResult.dataPreview.slug.toLowerCase()
      ) {
        setRestoreError(
          "El slug está ocupado por otro negocio en este servidor. Ingrese un slug diferente o seleccione actualizar el negocio existente."
        );
        return;
      }
    }

    // Validación de conflictos de productos sin confirmación
    const hasProductConflicts =
      (inspectionResult?.conflicts?.dishNamesConflict?.length || 0) > 0 ||
      (inspectionResult?.conflicts?.dishSkusConflict?.length || 0) > 0;

    if (mode === "UPDATE_EXISTING" && hasProductConflicts && !confirmMergeConflicts) {
      setRestoreError(
        "Existen platos con nombres o SKUs coincidentes en el negocio destino. Debe marcar la casilla de confirmación de combinación para autorizar su actualización."
      );
      return;
    }

    setIsRestoring(true);
    setRestoreError(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("confirmed", "true");
      formData.append("mode", mode);
      formData.append("confirmMergeConflicts", confirmMergeConflicts ? "true" : "false");

      if (mode === "UPDATE_EXISTING") {
        if (!targetRestaurantId) {
          throw new Error("Debes seleccionar un negocio destino para actualizar.");
        }
        formData.append("targetRestaurantId", targetRestaurantId);
      } else {
        formData.append("newSlug", customNewSlug.trim());
      }

      const res = await fetch("/api/superadmin/backup/restore", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Error al ejecutar la restauración del negocio.");
      }

      setRestoreResult(data.result);
      if (onRestoredSuccess) {
        onRestoredSuccess();
      }
    } catch (err: any) {
      setRestoreError(err?.message || "Ocurrió un error crítico durante la restauración.");
    } finally {
      setIsRestoring(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setInspectionResult(null);
    setInspectionError(null);
    setRestoreResult(null);
    setRestoreError(null);
    setConfirmedByUser(false);
    setConfirmMergeConflicts(false);
    setTargetRestaurantId("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-3xl w-full p-6 md:p-8 space-y-6 shadow-2xl relative max-h-[92vh] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700">
        {/* Cabecera del Modal */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-red-600 to-amber-500 flex items-center justify-center shadow-lg shadow-red-600/20">
              <FileArchive className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Restauración de Negocio desde ZIP
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
                  SuperAdmin
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Combinación e importación segura sin borrados: Pre-visualización y Confirmación explícita.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              handleReset();
              onClose();
            }}
            className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* PASO 3: RESUMEN DE ÉXITO TRAS RESTAURAR */}
        {restoreResult ? (
          <div className="space-y-6 py-4">
            <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-2xl p-6 text-center space-y-3">
              <div className="h-14 w-14 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 mx-auto flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h3 className="text-lg font-bold text-white">
                ¡Negocio Restaurado Exitosamente!
              </h3>
              <p className="text-sm text-slate-300">
                El negocio <span className="font-bold text-emerald-400">"{restoreResult.restaurantName}"</span> (/{restoreResult.restaurantSlug}) ha sido {restoreResult.createdNew ? "creado" : "actualizado"} sin alterar datos previos.
              </p>
              {restoreResult.isRetry && (
                <div className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-300 border border-blue-500/30">
                  Reintento detectado: los elementos existentes fueron actualizados en lugar de duplicarse.
                </div>
              )}
            </div>

            {/* Recuentos de elementos restaurados */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 text-center">
                <div className="text-2xl font-black text-white">
                  {restoreResult.restoredCounts.categoriesCreated + restoreResult.restoredCounts.categoriesUpdated}
                </div>
                <div className="text-[11px] font-medium text-slate-400 mt-0.5">
                  Categorías ({restoreResult.restoredCounts.categoriesCreated} nuevas, {restoreResult.restoredCounts.categoriesUpdated} act.)
                </div>
              </div>
              <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 text-center">
                <div className="text-2xl font-black text-white">
                  {restoreResult.restoredCounts.dishesCreated + restoreResult.restoredCounts.dishesUpdated}
                </div>
                <div className="text-[11px] font-medium text-slate-400 mt-0.5">
                  Platos ({restoreResult.restoredCounts.dishesCreated} nuevos, {restoreResult.restoredCounts.dishesUpdated} act.)
                </div>
              </div>
              <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 text-center">
                <div className="text-2xl font-black text-white">{restoreResult.restoredCounts.modifierGroupsProcessed}</div>
                <div className="text-[11px] font-medium text-slate-400 mt-0.5">Modificadores</div>
              </div>
              <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 text-center">
                <div className="text-2xl font-black text-emerald-400">
                  {restoreResult.restoredCounts.photosWritten + restoreResult.restoredCounts.photosReused}
                </div>
                <div className="text-[11px] font-medium text-slate-400 mt-0.5">
                  Fotos ({restoreResult.restoredCounts.photosWritten} escritas, {restoreResult.restoredCounts.photosReused} reusadas)
                </div>
              </div>
            </div>

            {/* Lotes aplicados con éxito */}
            <div className="bg-slate-950/40 border border-slate-800 rounded-xl p-3 text-xs text-slate-400 flex items-center gap-2">
              <Layers className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>
                Lotes procesados: <strong className="text-slate-300">{restoreResult.batchesApplied.join(", ")}</strong>
              </span>
            </div>

            {/* Advertencias de reconexión manual */}
            {restoreResult.reconnectionNotes.length > 0 && (
              <div className="bg-amber-950/20 border border-amber-500/30 rounded-2xl p-4 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wider">
                  <ShieldAlert className="h-4 w-4" />
                  Elementos que requieren reconexión manual en este servidor:
                </div>
                <ul className="text-xs text-amber-200/90 space-y-1.5 list-disc pl-5">
                  {restoreResult.reconnectionNotes.map((note, idx) => (
                    <li key={idx}>{note}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
              <a
                href={`/${restoreResult.restaurantSlug}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-slate-200 bg-slate-800 hover:bg-slate-700 transition"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Ver Menú Público
              </a>
              <button
                type="button"
                onClick={() => {
                  handleReset();
                  onClose();
                }}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 transition shadow-lg shadow-red-600/20"
              >
                Finalizar y Cerrar
              </button>
            </div>
          </div>
        ) : !inspectionResult ? (
          /* PASO 1: SELECCIONAR ARCHIVO E INSPECCIONAR */
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 block">
                Seleccionar archivo de Respaldo (.zip):
              </label>
              <div className="border-2 border-dashed border-slate-800 hover:border-slate-700 rounded-2xl p-8 text-center transition bg-slate-950/40">
                <input
                  type="file"
                  accept=".zip"
                  onChange={handleFileChange}
                  className="hidden"
                  id="backup-zip-upload-input"
                />
                <label
                  htmlFor="backup-zip-upload-input"
                  className="cursor-pointer flex flex-col items-center justify-center gap-2"
                >
                  <Upload className="h-8 w-8 text-slate-500" />
                  <div className="text-sm font-semibold text-slate-300">
                    {selectedFile ? selectedFile.name : "Haz clic aquí para seleccionar el archivo .zip"}
                  </div>
                  <p className="text-xs text-slate-500">
                    {selectedFile
                      ? `${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB`
                      : "Paquetes generados por la función 'Exportar ZIP' de Ubícame (máx. 100 MB)."}
                  </p>
                </label>
              </div>
            </div>

            {/* Negocio Objetivo Opcional */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 block">
                Negocio Destino en este servidor (Opcional si se detecta por slug):
              </label>
              <select
                value={targetRestaurantId}
                onChange={(e) => setTargetRestaurantId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-xs rounded-xl px-3.5 py-2.5 text-slate-200 focus:outline-none focus:border-red-500"
              >
                <option value="">-- Detectar automáticamente por slug o crear nuevo --</option>
                {restaurants.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} (/{r.slug})
                  </option>
                ))}
              </select>
            </div>

            {inspectionError && (
              <div className="bg-red-950/30 border border-red-500/40 rounded-xl p-4 flex items-start gap-3 text-xs text-red-300">
                <AlertTriangle className="h-4 w-4 shrink-0 text-red-400 mt-0.5" />
                <span>{inspectionError}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleInspect}
                disabled={!selectedFile || isInspecting}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 disabled:opacity-50 transition shadow-lg shadow-red-600/20"
              >
                {isInspecting ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Inspeccionando ZIP...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Analizar e Inspeccionar Archivo
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          /* PASO 2: PRE-VISUALIZACIÓN Y CONFIRMACIÓN EXPLÍCITA */
          <div className="space-y-6">
            {/* Tarjeta de Negocio Origen */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Negocio Origen en el Respaldo
                  </div>
                  <h3 className="text-base font-bold text-white mt-0.5">
                    {inspectionResult.dataPreview.name}
                  </h3>
                  <div className="text-xs text-slate-400">/{inspectionResult.dataPreview.slug}</div>
                </div>
                <div className="text-right">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-red-500/10 text-red-400 border border-red-500/20">
                    {inspectionResult.dataPreview.businessType}
                  </span>
                  <div className="text-[10px] text-slate-500 mt-1">
                    Plan: {inspectionResult.dataPreview.plan}
                  </div>
                </div>
              </div>

              {/* Contadores */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-850">
                <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/80">
                  <div className="text-xs font-semibold text-slate-400">Categorías</div>
                  <div className="text-lg font-bold text-white mt-0.5">
                    {inspectionResult.dataPreview.categoriesCount}
                  </div>
                </div>
                <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/80">
                  <div className="text-xs font-semibold text-slate-400">Platos/Productos</div>
                  <div className="text-lg font-bold text-white mt-0.5">
                    {inspectionResult.dataPreview.dishesCount}
                  </div>
                </div>
                <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/80">
                  <div className="text-xs font-semibold text-slate-400">Modificadores</div>
                  <div className="text-lg font-bold text-white mt-0.5">
                    {inspectionResult.dataPreview.modifierGroupsCount}
                  </div>
                </div>
                <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/80">
                  <div className="text-xs font-semibold text-slate-400">Fotos en ZIP</div>
                  <div className="text-lg font-bold text-emerald-400 mt-0.5">
                    {inspectionResult.photosSummary.validImages}/{inspectionResult.photosSummary.totalInZip}
                  </div>
                </div>
              </div>
            </div>

            {/* Detección de Conflictos & Destino */}
            <div className="bg-slate-950/40 border border-slate-800 rounded-2xl p-5 space-y-4">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Store className="h-4 w-4 text-amber-400" />
                Configuración del Destino (Combinación Sin Borrados)
              </h4>

              {/* Selector de Modo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label
                  className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition ${
                    mode === "UPDATE_EXISTING"
                      ? "bg-red-950/20 border-red-500/40 text-white"
                      : "bg-slate-900/50 border-slate-800 text-slate-400 hover:border-slate-700"
                  }`}
                >
                  <input
                    type="radio"
                    name="restoreMode"
                    value="UPDATE_EXISTING"
                    checked={mode === "UPDATE_EXISTING"}
                    onChange={() => setMode("UPDATE_EXISTING")}
                    className="mt-1"
                  />
                  <div>
                    <div className="text-xs font-bold">Combinar con Negocio Existente</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Actualiza en lugar de duplicar los platos existentes y agrega los nuevos sin borrar nada.
                    </div>
                  </div>
                </label>

                <label
                  className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition ${
                    mode === "CREATE_NEW"
                      ? "bg-red-950/20 border-red-500/40 text-white"
                      : "bg-slate-900/50 border-slate-800 text-slate-400 hover:border-slate-700"
                  }`}
                >
                  <input
                    type="radio"
                    name="restoreMode"
                    value="CREATE_NEW"
                    checked={mode === "CREATE_NEW"}
                    onChange={() => setMode("CREATE_NEW")}
                    className="mt-1"
                  />
                  <div>
                    <div className="text-xs font-bold">Crear como Nuevo Negocio</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Crea un nuevo registro independiente con slug disponible.
                    </div>
                  </div>
                </label>
              </div>

              {/* Alerta de Conflicto de Slug */}
              {inspectionResult.conflicts.slugTakenByOther && mode === "CREATE_NEW" && (
                <div className="bg-red-950/30 border border-red-500/40 rounded-xl p-3.5 text-xs text-red-300 space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-red-400">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    Slug ocupado en este servidor
                  </div>
                  <div>
                    {inspectionResult.conflicts.slugConflictMessage ||
                      "El slug ya está registrado en este servidor. Debe ingresar explícitamente un slug disponible."}
                  </div>
                </div>
              )}

              {/* Campos condicionales según modo */}
              {mode === "UPDATE_EXISTING" ? (
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-400 block">
                    Seleccionar negocio destino:
                  </label>
                  <select
                    value={targetRestaurantId}
                    onChange={(e) => setTargetRestaurantId(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 text-xs rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-red-500"
                  >
                    <option value="">-- Selecciona el negocio --</option>
                    {restaurants.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} (/{r.slug})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-400 block">
                    Slug para el nuevo negocio:
                  </label>
                  <input
                    type="text"
                    value={customNewSlug}
                    onChange={(e) => setCustomNewSlug(e.target.value)}
                    placeholder="nuevo-slug"
                    className="w-full bg-slate-900 border border-slate-800 text-xs rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-red-500"
                  />
                  <p className="text-[11px] text-slate-500">
                    No se generan sufijos aleatorios automáticos. El slug debe ser único y explícito.
                  </p>
                </div>
              )}

              {/* Reporte de Conflictos / Coincidencias Previas de Platos */}
              {(inspectionResult.conflicts.categoryNamesConflict.length > 0 ||
                inspectionResult.conflicts.dishNamesConflict.length > 0 ||
                inspectionResult.conflicts.dishSkusConflict.length > 0) && (
                <div className="bg-slate-900/80 border border-amber-500/20 rounded-xl p-3.5 space-y-2 text-xs text-slate-300">
                  <div className="font-bold text-amber-400 flex items-center gap-1.5">
                    <Info className="h-3.5 w-3.5" />
                    Elementos coincidentes detectados en el destino:
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {inspectionResult.conflicts.categoryNamesConflict.length} categoría(s) y{" "}
                    {inspectionResult.conflicts.dishNamesConflict.length} plato(s) con nombres coincidentes.
                    {inspectionResult.conflicts.dishSkusConflict.length > 0 && (
                      <span> ({inspectionResult.conflicts.dishSkusConflict.length} coinciden por SKU).</span>
                    )}
                  </div>

                  {mode === "UPDATE_EXISTING" && (
                    <label className="flex items-start gap-2.5 pt-1.5 border-t border-slate-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={confirmMergeConflicts}
                        onChange={(e) => setConfirmMergeConflicts(e.target.checked)}
                        className="mt-0.5 h-3.5 w-3.5 rounded border-slate-700 text-amber-500 bg-slate-950"
                      />
                      <span className="text-[11px] text-amber-300 font-medium">
                        Confirmo la actualización in-place de los platos y categorías con nombres/SKU coincidentes.
                      </span>
                    </label>
                  )}
                </div>
              )}
            </div>

            {/* Elementos de Reconexión Manual */}
            {inspectionResult.reconnectionNotes.length > 0 && (
              <div className="bg-amber-950/20 border border-amber-500/30 rounded-2xl p-4 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wider">
                  <Info className="h-4 w-4" />
                  Avisos de Reconexión (Elementos no transferidos por seguridad):
                </div>
                <ul className="text-xs text-amber-200/90 space-y-1.5 list-disc pl-5">
                  {inspectionResult.reconnectionNotes.map((note, idx) => (
                    <li key={idx}>{note}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Checkbox de Confirmación Explícita */}
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmedByUser}
                  onChange={(e) => setConfirmedByUser(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-slate-700 text-red-600 focus:ring-red-500 bg-slate-900"
                />
                <span className="text-xs text-slate-300 font-medium">
                  He revisado la pre-visualización de datos, recuentos y notas de reconexión. Autorizo expresamente la restauración combinada de este negocio en el servidor.
                </span>
              </label>
            </div>

            {restoreError && (
              <div className="bg-red-950/30 border border-red-500/40 rounded-xl p-4 flex items-start gap-3 text-xs text-red-300">
                <AlertTriangle className="h-4 w-4 shrink-0 text-red-400 mt-0.5" />
                <span>{restoreError}</span>
              </div>
            )}

            {/* Botones de Acción */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white transition"
              >
                Volver a Seleccionar Archivo
              </button>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleExecuteRestore}
                  disabled={
                    !confirmedByUser ||
                    isRestoring ||
                    (mode === "UPDATE_EXISTING" && !targetRestaurantId) ||
                    (mode === "CREATE_NEW" && !customNewSlug.trim())
                  }
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 disabled:opacity-50 transition shadow-lg shadow-red-600/20"
                >
                  {isRestoring ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Restaurando Datos y Fotos...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      Confirmar y Ejecutar Restauración
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
