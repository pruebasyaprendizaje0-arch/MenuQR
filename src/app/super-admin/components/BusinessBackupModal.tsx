"use client";

import { useEffect, useRef, useState } from "react";
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
    typeof manifest!.counts.dishes === "number" &&
    typeof manifest!.counts.modifierGroups === "number";
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
    typeof dataPreview!.dishesCount === "number" &&
    typeof dataPreview!.modifierGroupsCount === "number";
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

  const hasContradictoryPhotoCounts =
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
  } else if (invalidImages.length > 0 || isCompleteFlag === false || hasContradictoryPhotoCounts) {
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
  if (hasContradictoryPhotoCounts) {
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
  const [inspectedBinding, setInspectedBinding] = useState<{
    fileKey: string;
    requestedTargetId: string;
    resolvedTargetId: string;
  } | null>(null);
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
      setTargetRestaurantId("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setSelectedFile(file);
    invalidateInspectionState();
  };

  const handleTargetRestaurantChange = (nextId: string) => {
    setTargetRestaurantId(nextId);
    if (isInspecting || inspectionResult || inspectionError || restoreResult) {
      invalidateInspectionState();
    }
  };

  const handleInspect = async () => {
    if (!selectedFile) {
      setInspectionError("Por favor selecciona un archivo .zip de respaldo.");
      return;
    }

    const gen = ++inspectGenRef.current;
    const reqFile = selectedFile;
    const reqFileKey = getFileKey(reqFile);
    const reqTargetId = targetRestaurantId;

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
      if (reqTargetId) {
        formData.append("targetRestaurantId", reqTargetId);
      }

      const res = await fetch("/api/superadmin/backup/inspect", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (inspectGenRef.current !== gen) return;
      if (!res.ok || !data.success || !data.inspection) {
        throw new Error(data.error || "Error al inspeccionar el archivo de respaldo.");
      }

      const resolvedTargetId = data.inspection.targetStatus?.targetId || reqTargetId;
      setInspectionResult(data.inspection);
      setInspectedBinding({
        fileKey: reqFileKey,
        requestedTargetId: reqTargetId,
        resolvedTargetId,
      });

      if (data.inspection.targetStatus?.targetId) {
        setTargetRestaurantId(data.inspection.targetStatus.targetId);
        setMode("UPDATE_EXISTING");
      } else {
        setMode("CREATE_NEW");
        setCustomNewSlug(data.inspection.dataPreview?.slug || data.inspection.manifest?.sourceRestaurant?.slug || "");
      }
    } catch (err: any) {
      if (inspectGenRef.current !== gen) return;
      setInspectionResult(null);
      setInspectedBinding(null);
      setRestoreResult(null);
      setRestoreError(null);
      setConfirmedByUser(false);
      setConfirmMergeConflicts(false);
      setInspectionError(err?.message || "Ocurrió un error al procesar el archivo ZIP.");
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
    (targetRestaurantId === inspectedBinding!.resolvedTargetId ||
      targetRestaurantId === inspectedBinding!.requestedTargetId);
  const inspectionEval = evaluateBackupInspection(inspectionResult, inspectionError, isInspecting);
  const canRestoreCurrent = Boolean(inspectionEval?.canRestore && bindingMatchesCurrent && !isInspecting);

  const handleExecuteRestore = async () => {
    if (!selectedFile) return;

    if (isInspecting || !inspectionResult || !bindingMatchesCurrent || !canRestoreCurrent) {
      setRestoreError("No se puede restaurar: la inspección vigente no es válida o no coincide con el archivo/destino actual.");
      return;
    }

    if (!confirmedByUser) return;

    // Validación estricta de slug sin sufijos aleatorios
    if (mode === "CREATE_NEW") {
      const cleanSlug = customNewSlug.trim().toLowerCase();
      if (!cleanSlug) {
        setRestoreError("Debe ingresar un slug válido para el nuevo negocio.");
        return;
      }
      if (
        inspectionResult?.conflicts?.slugTakenByOther &&
        cleanSlug === (inspectionResult.dataPreview?.slug || "").toLowerCase()
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
    invalidateInspectionState();
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
                onChange={(e) => handleTargetRestaurantChange(e.target.value)}
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
              <div className="bg-red-950/30 border border-red-500/40 rounded-xl p-4 text-xs text-red-300 space-y-1">
                <div className="font-bold text-red-400 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>Validación del ZIP: No se pudo validar</span>
                </div>
                <p>{inspectionError}</p>
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
          <div className="space-y-5">
            {/* Tarjeta de Negocio Origen y Estados Separados */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
              {inspectionEval && (
                <div className="flex flex-wrap items-center gap-2 border-b border-slate-800/80 pb-3">
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
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    )}
                    {inspectionEval.photoLabel}
                  </span>
                </div>
              )}

              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Negocio Origen en el Respaldo
                  </div>
                  <h3 className="text-base font-bold text-white mt-0.5 break-words">
                    {inspectionResult.dataPreview?.name || inspectionResult.manifest?.sourceRestaurant?.name || "No disponible"}
                  </h3>
                  <div className="text-xs text-slate-400 break-all">
                    /{inspectionResult.dataPreview?.slug || inspectionResult.manifest?.sourceRestaurant?.slug || "—"}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-red-500/10 text-red-400 border border-red-500/20">
                    {inspectionResult.dataPreview?.businessType || inspectionResult.manifest?.sourceRestaurant?.businessType || "N/D"}
                  </span>
                  <div className="text-[10px] text-slate-500 mt-1">
                    Plan: {inspectionResult.dataPreview?.plan || inspectionResult.manifest?.sourceRestaurant?.plan || "No disponible"}
                  </div>
                </div>
              </div>

              {/* Contadores */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-850">
                <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/80">
                  <div className="text-xs font-semibold text-slate-400">Categorías</div>
                  <div className="text-lg font-bold text-white mt-0.5">
                    {typeof inspectionResult.dataPreview?.categoriesCount === "number"
                      ? inspectionResult.dataPreview.categoriesCount
                      : "No disponible"}
                  </div>
                </div>
                <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/80">
                  <div className="text-xs font-semibold text-slate-400">Platos/Productos</div>
                  <div className="text-lg font-bold text-white mt-0.5">
                    {typeof inspectionResult.dataPreview?.dishesCount === "number"
                      ? inspectionResult.dataPreview.dishesCount
                      : "No disponible"}
                  </div>
                </div>
                <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/80">
                  <div className="text-xs font-semibold text-slate-400">Modificadores</div>
                  <div className="text-lg font-bold text-white mt-0.5">
                    {typeof inspectionResult.dataPreview?.modifierGroupsCount === "number"
                      ? inspectionResult.dataPreview.modifierGroupsCount
                      : "No disponible"}
                  </div>
                </div>
                <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/80">
                  <div className="text-xs font-semibold text-slate-400">Fotos válidas ZIP</div>
                  <div
                    className={`text-lg font-bold mt-0.5 ${
                      inspectionEval?.zipStatus === "valid" ? "text-emerald-400" : "text-amber-300"
                    }`}
                  >
                    {typeof inspectionResult.photosSummary?.validImages === "number" &&
                    typeof inspectionResult.photosSummary?.totalInZip === "number"
                      ? `${inspectionResult.photosSummary.validImages}/${inspectionResult.photosSummary.totalInZip}`
                      : "No disponible"}
                  </div>
                </div>
              </div>

              {/* Desglose de cobertura de fotos */}
              {inspectionEval && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs bg-slate-900/50 p-3 rounded-xl border border-slate-800">
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
              )}

              {/* Bloqueo por ZIP inválido o imágenes inválidas */}
              {inspectionEval && !inspectionEval.canRestore && (
                <div className="p-3 rounded-xl border bg-red-950/30 border-red-500/40 text-red-300 text-xs space-y-1">
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
              {inspectionEval?.canRestore && inspectionEval.externalList && inspectionEval.externalList.length > 0 && (
                <div className="p-3 rounded-xl border bg-sky-500/10 border-sky-500/30 text-sky-200 text-xs">
                  El archivo ZIP es estructuralmente válido (no está corrupto). Las imágenes con enlace externo no se empaquetan por seguridad, pero sus URLs se conservan al restaurar.
                </div>
              )}

              {/* Aviso visible de alcance */}
              <div className="p-3 rounded-xl border bg-slate-900/70 border-slate-800 text-[11px] text-slate-300 leading-relaxed">
                {BACKUP_SCOPE_NOTICE}
              </div>

              {/* Advertencias del paquete */}
              {inspectionEval && inspectionEval.warnings.length > 0 && (
                <div className="p-3 rounded-xl border bg-amber-950/20 border-amber-500/30 text-amber-200 text-xs space-y-1.5">
                  <div className="font-bold text-amber-400 flex items-center gap-1.5">
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
              {Boolean(inspectionResult.conflicts?.slugTakenByOther) && mode === "CREATE_NEW" && (
                <div className="bg-red-950/30 border border-red-500/40 rounded-xl p-3.5 text-xs text-red-300 space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-red-400">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    Slug ocupado en este servidor
                  </div>
                  <div>
                    {inspectionResult.conflicts?.slugConflictMessage ||
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
              {((inspectionResult.conflicts?.categoryNamesConflict?.length ?? 0) > 0 ||
                (inspectionResult.conflicts?.dishNamesConflict?.length ?? 0) > 0 ||
                (inspectionResult.conflicts?.dishSkusConflict?.length ?? 0) > 0) && (
                <div className="bg-slate-900/80 border border-amber-500/20 rounded-xl p-3.5 space-y-2 text-xs text-slate-300">
                  <div className="font-bold text-amber-400 flex items-center gap-1.5">
                    <Info className="h-3.5 w-3.5" />
                    Elementos coincidentes detectados en el destino:
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {inspectionResult.conflicts?.categoryNamesConflict?.length ?? 0} categoría(s) y{" "}
                    {inspectionResult.conflicts?.dishNamesConflict?.length ?? 0} plato(s) con nombres coincidentes.
                    {(inspectionResult.conflicts?.dishSkusConflict?.length ?? 0) > 0 && (
                      <span> ({inspectionResult.conflicts?.dishSkusConflict?.length} coinciden por SKU).</span>
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
            {(inspectionResult.reconnectionNotes?.length ?? 0) > 0 && (
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
                    disabled={!canRestoreCurrent}
                    className="mt-1 h-4 w-4 rounded border-slate-700 text-red-600 focus:ring-red-500 bg-slate-900 disabled:opacity-50"
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
              <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white transition text-center"
                >
                  Volver a Seleccionar Archivo
                </button>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition text-center"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleExecuteRestore}
                    disabled={
                      isInspecting ||
                      !canRestoreCurrent ||
                      !confirmedByUser ||
                      isRestoring ||
                      (mode === "UPDATE_EXISTING" && !targetRestaurantId) ||
                      (mode === "CREATE_NEW" && !customNewSlug.trim())
                    }
                    className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 disabled:opacity-50 transition shadow-lg shadow-red-600/20"
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
