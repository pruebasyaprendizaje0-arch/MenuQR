"use client";

import { useEffect, useRef, useState } from "react";
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

const BACKUP_SCOPE_NOTICE =
  "Incluye perfil, configuración, menú o catálogo y fotos empaquetadas. No incluye pedidos históricos, clientes ni arqueos de caja. Las integraciones y credenciales indicadas requieren reconexión.";

interface InspectionEvaluation {
  zipStatus: "valid" | "invalid" | "unverified" | "error";
  zipLabel: string;
  canRestore: boolean;
  photoStatus: "complete" | "incomplete" | "unverified";
  photoLabel: string;
  referencedCount: number | null;
  includedCount: number | null;
  missingList: string[] | null;
  externalList: string[] | null;
  invalidImages: string[];
  warnings: string[];
  reconnectionNotes: string[];
}

function getFileKey(file: File | null): string {
  return file ? `${file.name}:${file.size}:${file.lastModified}` : "";
}

function evaluateBackupInspection(
  inspectionResult: BackupInspectionResult | null,
  inspectionError: string | null,
  isInspecting: boolean
): InspectionEvaluation | null {
  if (inspectionError && !inspectionResult) {
    return {
      zipStatus: "error",
      zipLabel: "Validación del ZIP: No se pudo validar",
      canRestore: false,
      photoStatus: "unverified",
      photoLabel: "Completitud no comprobada",
      referencedCount: null,
      includedCount: null,
      missingList: null,
      externalList: null,
      invalidImages: [],
      warnings: [],
      reconnectionNotes: [],
    };
  }
  if (!inspectionResult) return null;

  const hasValidFlag = typeof inspectionResult.isValid === "boolean";
  const manifest = inspectionResult.manifest && typeof inspectionResult.manifest === "object" ? inspectionResult.manifest : null;
  const hasManifestIdentity =
    Boolean(manifest) &&
    typeof manifest!.version === "string" &&
    manifest!.version.length > 0 &&
    typeof manifest!.schemaVersion === "number" &&
    Boolean(manifest!.sourceRestaurant && typeof manifest!.sourceRestaurant === "object") &&
    typeof manifest!.sourceRestaurant.name === "string" &&
    typeof manifest!.sourceRestaurant.slug === "string";
  const hasManifestCounts =
    Boolean(manifest?.counts && typeof manifest.counts === "object") &&
    typeof manifest!.counts.categories === "number" &&
    typeof manifest!.counts.dishes === "number";
  const photosObj = manifest?.photos && typeof manifest.photos === "object" ? manifest.photos : null;
  const hasManifestPhotos =
    Boolean(photosObj) &&
    typeof photosObj!.totalReferenced === "number" &&
    typeof photosObj!.included === "number" &&
    Array.isArray(photosObj!.missing) &&
    Array.isArray(photosObj!.external);
  const hasManifestCompleteness = typeof manifest?.isComplete === "boolean";
  const dataPreview =
    inspectionResult.dataPreview && typeof inspectionResult.dataPreview === "object"
      ? inspectionResult.dataPreview
      : null;
  const hasDataPreview =
    Boolean(dataPreview) &&
    typeof dataPreview!.name === "string" &&
    typeof dataPreview!.slug === "string" &&
    typeof dataPreview!.categoriesCount === "number" &&
    typeof dataPreview!.dishesCount === "number";
  const targetStatus =
    inspectionResult.targetStatus && typeof inspectionResult.targetStatus === "object"
      ? inspectionResult.targetStatus
      : null;
  const hasTargetStatus = Boolean(targetStatus) && typeof targetStatus!.exists === "boolean";
  const conflicts =
    inspectionResult.conflicts && typeof inspectionResult.conflicts === "object"
      ? inspectionResult.conflicts
      : null;
  const hasConflicts =
    Boolean(conflicts) &&
    typeof conflicts!.slugTakenByOther === "boolean" &&
    Array.isArray(conflicts!.categoryNamesConflict) &&
    Array.isArray(conflicts!.dishNamesConflict) &&
    Array.isArray(conflicts!.dishSkusConflict);
  const photosSummary =
    inspectionResult.photosSummary && typeof inspectionResult.photosSummary === "object"
      ? inspectionResult.photosSummary
      : null;
  const hasPhotosSummary =
    Boolean(photosSummary) &&
    typeof photosSummary!.totalInZip === "number" &&
    typeof photosSummary!.validImages === "number" &&
    Array.isArray(photosSummary!.invalidImages);
  const hasLists = Array.isArray(inspectionResult.warnings) && Array.isArray(inspectionResult.reconnectionNotes);

  const hasRequiredStructure =
    hasValidFlag &&
    hasManifestIdentity &&
    hasManifestCounts &&
    hasManifestPhotos &&
    hasManifestCompleteness &&
    hasDataPreview &&
    hasTargetStatus &&
    hasConflicts &&
    hasPhotosSummary &&
    hasLists;

  const invalidImages = hasPhotosSummary ? photosSummary!.invalidImages : [];

  let zipStatus: InspectionEvaluation["zipStatus"] = "unverified";
  let zipLabel = "Validación del ZIP: No comprobado";
  let canRestore = false;

  if (inspectionError) {
    zipStatus = "error";
    zipLabel = "Validación del ZIP: No se pudo validar";
  } else if (!hasRequiredStructure) {
    zipStatus = "unverified";
    zipLabel = "Validación del ZIP: No comprobado";
  } else if (inspectionResult.isValid !== true || invalidImages.length > 0) {
    zipStatus = "invalid";
    zipLabel = "Validación del ZIP: Inválido";
  } else if (!isInspecting) {
    zipStatus = "valid";
    zipLabel = "Validación del ZIP: correcta";
    canRestore = true;
  }

  const referencedCount = hasManifestPhotos ? photosObj!.totalReferenced : null;
  const includedCount = hasManifestPhotos ? photosObj!.included : null;
  const missingList = hasManifestPhotos ? photosObj!.missing : null;
  const externalList = hasManifestPhotos ? photosObj!.external : null;
  const isCompleteFlag = hasManifestCompleteness ? manifest!.isComplete : null;
  const totalInZip = hasPhotosSummary ? photosSummary!.totalInZip : null;
  const validImagesCount = hasPhotosSummary ? photosSummary!.validImages : null;

  const hasContradictoryCounts =
    referencedCount !== null &&
    includedCount !== null &&
    missingList !== null &&
    externalList !== null &&
    (includedCount > referencedCount ||
      includedCount + missingList.length + externalList.length !== referencedCount ||
      (totalInZip !== null && totalInZip !== includedCount) ||
      (isCompleteFlag === true &&
        (missingList.length > 0 ||
          externalList.length > 0 ||
          invalidImages.length > 0 ||
          includedCount < referencedCount ||
          (validImagesCount !== null && totalInZip !== null && validImagesCount < totalInZip))));

  let photoStatus: InspectionEvaluation["photoStatus"] = "unverified";
  let photoLabel = "Completitud no comprobada";
  if (!hasRequiredStructure) {
    photoStatus = "unverified";
    photoLabel = "Completitud no comprobada";
  } else if (invalidImages.length > 0 || isCompleteFlag === false || hasContradictoryCounts) {
    photoStatus = "incomplete";
    photoLabel = "Fotos incompletas";
  } else if (zipStatus === "valid" && isCompleteFlag === true) {
    photoStatus = "complete";
    photoLabel = "Fotos del alcance exportado: completas";
  }

  const warningsSet = new Set<string>();
  if (Array.isArray(inspectionResult.warnings)) {
    for (const w of inspectionResult.warnings) if (typeof w === "string" && w.trim()) warningsSet.add(w);
  }
  if (Array.isArray(manifest?.warnings)) {
    for (const w of manifest!.warnings) if (typeof w === "string" && w.trim()) warningsSet.add(w);
  }
  if (hasContradictoryCounts) {
    warningsSet.add("Los conteos de fotos o el indicador isComplete del manifiesto son contradictorios.");
  }
  const reconnectionNotes = Array.isArray(inspectionResult.reconnectionNotes)
    ? inspectionResult.reconnectionNotes.filter((n) => typeof n === "string" && n.trim())
    : [];

  return {
    zipStatus,
    zipLabel,
    canRestore,
    photoStatus,
    photoLabel,
    referencedCount,
    includedCount,
    missingList,
    externalList,
    invalidImages,
    warnings: Array.from(warningsSet),
    reconnectionNotes,
  };
}

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
  const [inspectedBinding, setInspectedBinding] = useState<{ fileKey: string; restaurantId: string } | null>(null);
  const [inspectionError, setInspectionError] = useState<string | null>(null);
  const inspectGenRef = useRef<number>(0);

  const [isRestoring, setIsRestoring] = useState<boolean>(false);
  const [restoreResult, setRestoreResult] = useState<RestoreBackupResult | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  const invalidateInspectionState = () => {
    inspectGenRef.current += 1;
    setIsInspecting(false);
    setInspectionResult(null);
    setInspectedBinding(null);
    setInspectionError(null);
    setRestoreResult(null);
    setRestoreError(null);
    setConfirmedByUser(false);
    setConfirmMergeConflicts(false);
  };

  useEffect(() => {
    invalidateInspectionState();
    if (!isOpen) {
      setSelectedFile(null);
    }
  }, [isOpen, restaurantId]);

  if (!isOpen) return null;

  const handleDownloadZip = () => {
    window.open(`/api/admin/backup/export?restaurantId=${encodeURIComponent(restaurantId)}`, "_blank");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setSelectedFile(file);
    invalidateInspectionState();
  };

  const handleInspect = async () => {
    if (!selectedFile) {
      setInspectionError("Por favor selecciona un archivo .zip de respaldo.");
      return;
    }

    const gen = ++inspectGenRef.current;
    const reqFile = selectedFile;
    const reqFileKey = getFileKey(reqFile);
    const reqRestaurantId = restaurantId;

    setIsInspecting(true);
    setInspectionError(null);
    setInspectionResult(null);
    setInspectedBinding(null);
    setRestoreResult(null);
    setRestoreError(null);
    setConfirmedByUser(false);
    setConfirmMergeConflicts(false);

    try {
      const formData = new FormData();
      formData.append("file", reqFile);
      formData.append("restaurantId", reqRestaurantId);

      const res = await fetch("/api/admin/backup/inspect", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (inspectGenRef.current !== gen) return;
      if (!res.ok || !data.success || !data.inspection) {
        throw new Error(data.error || "Error al inspeccionar el archivo de respaldo.");
      }

      setInspectionResult(data.inspection);
      setInspectedBinding({ fileKey: reqFileKey, restaurantId: reqRestaurantId });
    } catch (err: any) {
      if (inspectGenRef.current !== gen) return;
      setInspectionResult(null);
      setInspectedBinding(null);
      setRestoreResult(null);
      setRestoreError(null);
      setConfirmedByUser(false);
      setConfirmMergeConflicts(false);
      setInspectionError(err?.message || "Error al conectar con el servidor.");
    } finally {
      if (inspectGenRef.current === gen) {
        setIsInspecting(false);
      }
    }
  };

  const currentFileKey = getFileKey(selectedFile);
  const bindingMatchesCurrent =
    Boolean(inspectedBinding) &&
    inspectedBinding!.fileKey === currentFileKey &&
    inspectedBinding!.restaurantId === restaurantId;
  const inspectionEval = evaluateBackupInspection(inspectionResult, inspectionError, isInspecting);
  const canRestoreCurrent = Boolean(inspectionEval?.canRestore && bindingMatchesCurrent && !isInspecting);
  const categoryConflicts = Array.isArray(inspectionResult?.conflicts?.categoryNamesConflict)
    ? inspectionResult!.conflicts.categoryNamesConflict
    : [];
  const dishConflicts = Array.isArray(inspectionResult?.conflicts?.dishNamesConflict)
    ? inspectionResult!.conflicts.dishNamesConflict
    : [];
  const hasMergeConflicts = categoryConflicts.length > 0 || dishConflicts.length > 0;

  const handleRestore = async () => {
    if (!selectedFile) {
      setRestoreError("Debe seleccionar un archivo ZIP válido.");
      return;
    }

    if (isInspecting || !inspectionResult || !bindingMatchesCurrent || !canRestoreCurrent) {
      setRestoreError("No se puede restaurar: la inspección vigente no es válida o no coincide con el archivo/negocio actual.");
      return;
    }

    if (!confirmedByUser) {
      setRestoreError("Por favor confirma que deseas aplicar los datos del respaldo en tu negocio.");
      return;
    }

    if (hasMergeConflicts && !confirmMergeConflicts) {
      setRestoreError("Debes confirmar la actualización de categorías o productos coincidentes.");
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
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full p-4 sm:p-6 space-y-5 shadow-2xl my-4 sm:my-8 max-h-[92vh] overflow-y-auto">
        
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
                Descargar Respaldo del Negocio (ZIP)
              </h4>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Descarga un paquete ZIP de <strong>{restaurantName}</strong> con su perfil, configuración, menú o catálogo y las fotos locales disponibles empaquetadas. No incluye pedidos históricos, clientes ni arqueos de caja. Si existen enlaces externos o integraciones con credenciales privadas, requerirán reconexión al restaurar.
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
            <div className="p-3.5 rounded-xl border bg-red-500/10 border-red-500/30 text-red-300 text-xs space-y-1">
              <div className="font-bold text-red-400 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>Validación del ZIP: No se pudo validar</span>
              </div>
              <p>{inspectionError}</p>
            </div>
          )}

          {/* Resultado de Inspección (Previsualización de Lotes) */}
          {inspectionResult && inspectionEval && !restoreResult && (
            <div className="bg-slate-950 border border-slate-800 p-4 rounded-2xl space-y-3">
              {/* Cabecera: Validación del ZIP separada de Cobertura de Fotos */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-900 pb-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
                      inspectionEval.zipStatus === "valid"
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                        : inspectionEval.zipStatus === "unverified"
                        ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
                        : "bg-red-500/10 border-red-500/30 text-red-400"
                    }`}
                  >
                    {inspectionEval.zipStatus === "valid" ? (
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    )}
                    {inspectionEval.zipLabel}
                  </span>

                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
                      inspectionEval.photoStatus === "complete"
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                        : "bg-amber-500/10 border-amber-500/30 text-amber-300"
                    }`}
                  >
                    {inspectionEval.photoStatus === "complete" ? (
                      <ImageIcon className="h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    )}
                    {inspectionEval.photoLabel}
                  </span>
                </div>

                <span className="text-[11px] text-slate-400 break-words">
                  Origen: <strong>{inspectionResult.manifest?.sourceRestaurant?.name || "No disponible"}</strong>
                </span>
              </div>

              {/* Estadísticas de Contenido */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-center">
                <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Categorías</span>
                  <span className="text-base font-black text-white">
                    {typeof inspectionResult.manifest?.counts?.categories === "number"
                      ? inspectionResult.manifest.counts.categories
                      : "No disponible"}
                  </span>
                </div>
                <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Productos</span>
                  <span className="text-base font-black text-white">
                    {typeof inspectionResult.manifest?.counts?.dishes === "number"
                      ? inspectionResult.manifest.counts.dishes
                      : "No disponible"}
                  </span>
                </div>
                <div className="col-span-2 sm:col-span-1 bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Fotos empaquetadas</span>
                  <span
                    className={`text-base font-black ${
                      inspectionEval.photoStatus === "complete" ? "text-emerald-400" : "text-amber-300"
                    }`}
                  >
                    {inspectionEval.includedCount !== null ? inspectionEval.includedCount : "No disponible"}
                  </span>
                </div>
              </div>

              {/* Desglose de cobertura de fotos */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs bg-slate-900/50 p-2.5 rounded-xl border border-slate-800">
                <div>
                  <span className="text-[10px] text-slate-400 block">Referenciadas</span>
                  <strong className="text-white">
                    {inspectionEval.referencedCount !== null ? inspectionEval.referencedCount : "No disponible"}
                  </strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Empaquetadas</span>
                  <strong className="text-white">
                    {inspectionEval.includedCount !== null ? inspectionEval.includedCount : "No disponible"}
                  </strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Faltantes</span>
                  <strong className={inspectionEval.missingList && inspectionEval.missingList.length > 0 ? "text-amber-300" : "text-white"}>
                    {inspectionEval.missingList !== null ? inspectionEval.missingList.length : "No disponible"}
                  </strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Enlaces externos</span>
                  <strong className={inspectionEval.externalList && inspectionEval.externalList.length > 0 ? "text-amber-300" : "text-white"}>
                    {inspectionEval.externalList !== null ? inspectionEval.externalList.length : "No disponible"}
                  </strong>
                </div>
              </div>

              {/* Bloqueo por ZIP inválido o imágenes inválidas */}
              {!inspectionEval.canRestore && (
                <div className="p-3 rounded-xl border bg-red-500/10 border-red-500/30 text-red-300 text-xs space-y-1">
                  <p className="font-bold text-red-400">
                    Restauración bloqueada: el archivo no superó la validación del ZIP.
                  </p>
                  {inspectionEval.invalidImages.length > 0 && (
                    <p>
                      Imágenes inválidas o corruptas detectadas ({inspectionEval.invalidImages.length}):{" "}
                      <span className="break-all">{inspectionEval.invalidImages.join(", ")}</span>
                    </p>
                  )}
                </div>
              )}

              {/* Distinción: fotos externas no empaquetadas vs ZIP corrupto */}
              {inspectionEval.canRestore && inspectionEval.externalList && inspectionEval.externalList.length > 0 && (
                <div className="p-3 rounded-xl border bg-sky-500/10 border-sky-500/30 text-sky-200 text-xs">
                  El archivo ZIP es estructuralmente válido (no está corrupto). Las imágenes con enlace externo no se empaquetan por seguridad, pero sus URLs se conservan si decides restaurar.
                </div>
              )}

              {/* Aviso visible de alcance */}
              <div className="p-3 rounded-xl border bg-slate-900/70 border-slate-800 text-[11px] text-slate-300 leading-relaxed">
                {BACKUP_SCOPE_NOTICE}
              </div>

              {/* Advertencias del paquete */}
              {inspectionEval.warnings.length > 0 && (
                <div className="p-3 rounded-xl border bg-amber-500/10 border-amber-500/30 text-amber-200 text-xs space-y-1.5">
                  <div className="font-bold text-amber-300 flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    Advertencias del respaldo
                  </div>
                  <ul className="list-disc pl-4 space-y-1">
                    {inspectionEval.warnings.map((w, i) => (
                      <li key={i} className="break-words">{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Notas de reconexión */}
              {inspectionEval.reconnectionNotes.length > 0 && (
                <div className="p-3 rounded-xl border bg-amber-950/30 border-amber-500/30 text-amber-200/90 text-xs space-y-1.5">
                  <div className="font-bold text-amber-300">Elementos que requieren reconexión manual:</div>
                  <ul className="list-disc pl-4 space-y-1">
                    {inspectionEval.reconnectionNotes.map((note, i) => (
                      <li key={i} className="break-words">{note}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Resumen de Coincidencias */}
              {inspectionResult.targetStatus && (
                <div className="text-xs text-slate-300 space-y-1 bg-slate-900/40 p-3 rounded-xl border border-slate-850">
                  <p>
                    • Se conservarán intactos tus pedidos históricos, clientes y reportes.
                  </p>
                  <p>
                    • Coincidencias encontradas: <strong className="text-emerald-400">{categoryConflicts.length} categorías</strong> y <strong className="text-emerald-400">{dishConflicts.length} productos</strong> que serán actualizados de forma segura.
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
                    disabled={!canRestoreCurrent}
                    className="rounded bg-slate-950 border-slate-800 text-emerald-500 focus:ring-0 h-4 w-4 mt-0.5 disabled:opacity-50"
                  />
                  <span>
                    Confirmo restaurar los datos de landing page, catálogo y fotos en mi negocio <strong>{restaurantName}</strong>.
                  </span>
                </label>

                {hasMergeConflicts && (
                  <label className="flex items-start gap-2.5 cursor-pointer text-xs text-amber-300">
                    <input
                      type="checkbox"
                      checked={confirmMergeConflicts}
                      onChange={(e) => setConfirmMergeConflicts(e.target.checked)}
                      disabled={!canRestoreCurrent}
                      className="rounded bg-slate-950 border-slate-800 text-amber-500 focus:ring-0 h-4 w-4 mt-0.5 disabled:opacity-50"
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
                  disabled={
                    isInspecting ||
                    isRestoring ||
                    !canRestoreCurrent ||
                    !confirmedByUser ||
                    (hasMergeConflicts && !confirmMergeConflicts)
                  }
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-lg shadow-emerald-900/20 transition disabled:opacity-50 cursor-pointer"
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
