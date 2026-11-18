"use client";

import { useState } from "react";
import { 
  X, 
  Upload, 
  Download, 
  FileArchive, 
  CheckCircle2, 
  AlertTriangle, 
  Sparkles, 
  RefreshCw, 
  ShieldCheck,
  Store,
  Layers,
  Image as ImageIcon
} from "lucide-react";
import type { BackupInspectionResult, RestoreBackupResult } from "@/lib/business-backup";

interface TenantBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  restaurantId: string;
  restaurantName: string;
  restaurantSlug: string;
  onRestoredSuccess?: () => void;
}

export function TenantBackupModal({
  isOpen,
  onClose,
  restaurantId,
  restaurantName,
  restaurantSlug,
  onRestoredSuccess,
}: TenantBackupModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [confirmedByUser, setConfirmedByUser] = useState<boolean>(false);
  const [confirmMergeConflicts, setConfirmMergeConflicts] = useState<boolean>(false);

  // Estados de inspección y restauración
  const [isInspecting, setIsInspecting] = useState<boolean>(false);
  const [inspectionResult, setInspectionResult] = useState<BackupInspectionResult | null>(null);
  const [inspectionError, setInspectionError] = useState<string | null>(null);

  const [isRestoring, setIsRestoring] = useState<boolean>(false);
  const [restoreResult, setRestoreResult] = useState<RestoreBackupResult | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleDownloadZip = () => {
    window.open(`/api/admin/backup/export?restaurantId=${encodeURIComponent(restaurantId)}`, "_blank");
  };

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
      formData.append("restaurantId", restaurantId);

      const res = await fetch("/api/admin/backup/inspect", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Error al inspeccionar el archivo de respaldo.");
      }

      setInspectionResult(data.inspection);
    } catch (err: any) {
      setInspectionError(err.message || "Error al conectar con el servidor.");
    } finally {
      setIsInspecting(false);
    }
  };

  const handleRestore = async () => {
    if (!selectedFile) {
      setRestoreError("Debe seleccionar un archivo ZIP válido.");
      return;
    }

    if (!confirmedByUser) {
      setRestoreError("Por favor confirma que deseas aplicar los datos del respaldo en tu negocio.");
      return;
    }

    setIsRestoring(true);
    setRestoreError(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("restaurantId", restaurantId);
      formData.append("confirmed", "true");
      if (confirmMergeConflicts) {
        formData.append("confirmMergeConflicts", "true");
      }

      const res = await fetch("/api/admin/backup/restore", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Ocurrió un error al restaurar el respaldo.");
      }

      setRestoreResult(data.result);
      if (onRestoredSuccess) {
        onRestoredSuccess();
      }
    } catch (err: any) {
      setRestoreError(err.message || "Error inesperado durante la restauración.");
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full p-6 space-y-6 shadow-2xl my-8">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-center text-amber-400">
              <FileArchive className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Copia de Seguridad y Restauración</h3>
              <p className="text-xs text-slate-400">Respalda o recupera tu landing, catálogo y fotos en formato ZIP</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Sección 1: Descargar Copia Actual */}
        <div className="bg-slate-950 border border-slate-800/80 p-4 rounded-2xl space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                Descargar Respaldo Completo a tu PC
              </h4>
              <p className="text-xs text-slate-400 mt-1">
                Descarga un paquete ZIP seguro con toda la información de <strong>{restaurantName}</strong>: textos de landing page, datos de contacto, horarios, categorías, productos con precios y todas las fotos reales.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleDownloadZip}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 shadow-md shadow-amber-500/10 transition cursor-pointer"
          >
            <Download className="h-4 w-4" />
            Descargar Respaldo ZIP
          </button>
        </div>

        {/* Sección 2: Restaurar / Subir por Lotes */}
        <div className="space-y-4 pt-2 border-t border-slate-800">
          <div>
            <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
              <Upload className="h-4 w-4 text-sky-400" />
              Restaurar o Subir por Lotes desde ZIP
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              Carga un archivo ZIP previamente exportado para recuperar o actualizar tu catálogo y datos de negocio sin perder órdenes de tus clientes.
            </p>
          </div>

          {/* Selector de Archivo */}
          <div className="border-2 border-dashed border-slate-800 hover:border-slate-700 rounded-2xl p-4 text-center transition cursor-pointer relative bg-slate-950/40">
            <input
              type="file"
              accept=".zip"
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div className="space-y-1.5 pointer-events-none">
              <FileArchive className="h-8 w-8 text-slate-500 mx-auto" />
              <p className="text-xs text-slate-300 font-semibold">
                {selectedFile ? selectedFile.name : "Haz clic o arrastra aquí tu archivo .zip de respaldo"}
              </p>
              <p className="text-[11px] text-slate-500">
                {selectedFile ? `${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB` : "Límite máximo 50 MB"}
              </p>
            </div>
          </div>

          {selectedFile && !inspectionResult && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleInspect}
                disabled={isInspecting}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-sky-600 hover:bg-sky-500 transition disabled:opacity-50 cursor-pointer"
              >
                {isInspecting ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    Inspeccionando archivo...
                  </>
                ) : (
                  <>
                    <Layers className="h-3.5 w-3.5" />
                    Inspeccionar y Previsualizar
                  </>
                )}
              </button>
            </div>
          )}

          {/* Error de Inspección */}
          {inspectionError && (
            <div className="p-3.5 rounded-xl border bg-red-500/10 border-red-500/30 text-red-400 text-xs font-semibold flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>{inspectionError}</div>
            </div>
          )}

          {/* Resultado de Inspección (Previsualización de Lotes) */}
          {inspectionResult && !restoreResult && (
            <div className="bg-slate-950 border border-slate-800 p-4 rounded-2xl space-y-3">
              <div className="flex items-center justify-between border-b border-slate-900 pb-2">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  Archivo de respaldo verificado
                </span>
                <span className="text-[10px] text-slate-400">
                  Origen: <strong>{inspectionResult.manifest.sourceRestaurant.name}</strong>
                </span>
              </div>

              {/* Estadísticas de Contenido */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Categorías</span>
                  <span className="text-base font-black text-white">{inspectionResult.manifest.counts.categories}</span>
                </div>
                <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Productos</span>
                  <span className="text-base font-black text-white">{inspectionResult.manifest.counts.dishes}</span>
                </div>
                <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Fotos Físicas</span>
                  <span className="text-base font-black text-emerald-400">{inspectionResult.manifest.photos.included}</span>
                </div>
              </div>

              {/* Resumen de Coincidencias */}
              {inspectionResult.targetStatus && (
                <div className="text-xs text-slate-300 space-y-1 bg-slate-900/40 p-3 rounded-xl border border-slate-850">
                  <p>
                    • Se conservarán intactos tus pedidos históricos, clientes y reportes.
                  </p>
                  <p>
                    • Coincidencias encontradas: <strong className="text-emerald-400">{inspectionResult.conflicts.categoryNamesConflict.length} categorías</strong> y <strong className="text-emerald-400">{inspectionResult.conflicts.dishNamesConflict.length} productos</strong> que serán actualizados de forma segura.
                  </p>
                </div>
              )}

              {/* Checkbox de Confirmación */}
              <div className="space-y-2 pt-2 border-t border-slate-900">
                <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={confirmedByUser}
                    onChange={(e) => setConfirmedByUser(e.target.checked)}
                    className="rounded bg-slate-950 border-slate-800 text-emerald-500 focus:ring-0 h-4 w-4 mt-0.5"
                  />
                  <span>
                    Confirmo restaurar los datos de landing page, catálogo y fotos en mi negocio <strong>{restaurantName}</strong>.
                  </span>
                </label>

                {(inspectionResult.conflicts.categoryNamesConflict.length > 0 || inspectionResult.conflicts.dishNamesConflict.length > 0) && (
                  <label className="flex items-start gap-2.5 cursor-pointer text-xs text-amber-300">
                    <input
                      type="checkbox"
                      checked={confirmMergeConflicts}
                      onChange={(e) => setConfirmMergeConflicts(e.target.checked)}
                      className="rounded bg-slate-950 border-slate-800 text-amber-500 focus:ring-0 h-4 w-4 mt-0.5"
                    />
                    <span>
                      Acepto actualizar los elementos coincidentes sin duplicar registros.
                    </span>
                  </label>
                )}
              </div>

              {/* Botón de Restauración */}
              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleRestore}
                  disabled={isRestoring || !confirmedByUser || ((inspectionResult.conflicts.categoryNamesConflict.length > 0 || inspectionResult.conflicts.dishNamesConflict.length > 0) && !confirmMergeConflicts)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-lg shadow-emerald-900/20 transition disabled:opacity-50 cursor-pointer"
                >
                  {isRestoring ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Restaurando por lotes...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Confirmar y Restaurar Negocio
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Error de Restauración */}
          {restoreError && (
            <div className="p-3.5 rounded-xl border bg-red-500/10 border-red-500/30 text-red-400 text-xs font-semibold flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>{restoreError}</div>
            </div>
          )}

          {/* Éxito de Restauración */}
          {restoreResult && (
            <div className="bg-emerald-950/30 border border-emerald-500/40 p-5 rounded-2xl space-y-3 text-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-400 mx-auto" />
              <div>
                <h4 className="text-sm font-bold text-white">¡Restauración Completada con Éxito!</h4>
                <p className="text-xs text-slate-300 mt-1">
                  Tu landing page, categorías, productos y {restoreResult.restoredCounts.photosWritten + restoreResult.restoredCounts.photosReused} fotos han sido sincronizados correctamente.
                </p>
              </div>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 transition shadow-md"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Recargar y Ver Catálogo Actualizado
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
