"use client";

import React, { useState, useRef, useMemo, useTransition } from "react";
import {
  Camera,
  UtensilsCrossed,
  Sparkles,
  Plus,
  Trash2,
  Check,
  Loader2,
  AlertCircle,
  Eye,
  EyeOff,
  Clock,
} from "lucide-react";
import {
  createDailyMenuCategoryAction,
  saveDailyMenuDishAction,
  saveDailyMenuAvailabilityAction,
  toggleDailyMenuDishVisibilityAction,
  toggleAllDailyMenuDishesAction,
  deleteDailyMenuDishAction,
} from "@/lib/actions";
import { isDailyMenuCategoryName, MAX_VISIBLE_DAILY_MENU_DISHES } from "@/lib/daily-menu";

export interface DailyMenuDish {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  imageUrl?: string | null;
  isAvailable: boolean;
  isVisible?: boolean;
  trackStock?: boolean;
  stock?: number | null;
  categoryId: string;
}

interface DailyMenuCategory {
  id: string;
  name: string;
  order: number;
  dishes: DailyMenuDish[];
}

interface DailyMenuBoardProps {
  restaurantId: string;
  restaurantSlug: string;
  categories: DailyMenuCategory[];
}

interface DailyMenuCardState {
  localKey: string;
  dishId?: string;
  name: string;
  price: string;
  description: string;
  isAvailable: boolean;
  isVisible: boolean;
  trackStock: boolean;
  stockInput: string;
  persistedIsAvailable: boolean;
  persistedTrackStock: boolean;
  persistedStock: number | null;
  availabilityConflict?: {
    currentTrackStock: boolean;
    currentStock: number | null;
    currentIsAvailable: boolean;
    message: string;
  } | null;
  imageUrl: string;
  tempPreview?: string;
}

/**
 * Comprime cualquier foto tomada desde el celular a formato WebP optimizado.
 * Si falla la lectura o la codificación WebP, rechaza con error explícito
 * para nunca subir el original sin avisar.
 */
export async function compressImageToWebP(
  file: File,
  maxDim = 1000,
  quality = 0.82
): Promise<File> {
  if (!file || !file.type.startsWith("image/")) {
    throw new Error("El archivo seleccionado no es una imagen válida.");
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result;
      if (typeof dataUrl !== "string") {
        reject(new Error("No se pudo leer la imagen seleccionada."));
        return;
      }

      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width <= 0 || height <= 0) {
          reject(new Error("La imagen no tiene dimensiones válidas."));
          return;
        }
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("No se pudo inicializar el compresor WebP en el navegador."));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (!blob || blob.size === 0 || blob.type !== "image/webp") {
              reject(
                new Error(
                  "No se pudo comprimir la foto a WebP. Intenta con otra imagen; no se subió el archivo original."
                )
              );
              return;
            }
            const cleanName = file.name.replace(/\.[^.]+$/, "") || "foto-menu-dia";
            const compressed = new File([blob], `${cleanName}.webp`, {
              type: "image/webp",
              lastModified: Date.now(),
            });
            resolve(compressed);
          },
          "image/webp",
          quality
        );
      };
      img.onerror = () =>
        reject(new Error("No se pudo decodificar la imagen para comprimirla a WebP."));
      img.src = dataUrl;
    };
    reader.onerror = () =>
      reject(new Error("Error al leer el archivo de imagen antes de comprimir."));
    reader.readAsDataURL(file);
  });
}

function buildCardsFromDishes(dishes: DailyMenuDish[]): DailyMenuCardState[] {
  if (dishes.length === 0) {
    return [0, 1].map((idx) => ({
      localKey: `draft-init-${idx}`,
      name: idx === 0 ? "Almuerzo Ejecutivo: Pollo" : "Almuerzo Ejecutivo: Carne",
      price: "3.50",
      description: "Incluye sopa del día, arroz con menestra y bebida natural.",
      isAvailable: true,
      isVisible: true,
      trackStock: false,
      stockInput: "",
      persistedIsAvailable: true,
      persistedTrackStock: false,
      persistedStock: null,
      availabilityConflict: null,
      imageUrl: "",
    }));
  }
  return dishes.map((existing) => {
    const track = existing.trackStock === true;
    const stockVal = typeof existing.stock === "number" ? existing.stock : null;
    return {
      localKey: existing.id,
      dishId: existing.id,
      name: existing.name,
      price: existing.price !== undefined ? existing.price.toString() : "3.50",
      description: existing.description || "",
      isAvailable: existing.isAvailable !== false,
      isVisible: existing.isVisible !== false,
      trackStock: track,
      stockInput: stockVal !== null ? String(stockVal) : "",
      persistedIsAvailable: existing.isAvailable !== false,
      persistedTrackStock: track,
      persistedStock: stockVal,
      availabilityConflict: null,
      imageUrl: existing.imageUrl || "",
    };
  });
}

function getStockValidationError(card: DailyMenuCardState): string | null {
  if (!card.trackStock) return null;
  const trimmed = card.stockInput.trim();
  if (!/^\d+$/.test(trimmed)) {
    return "Ingresa un entero válido (0 o mayor).";
  }
  return null;
}

function hasPendingAvailabilityChanges(card: DailyMenuCardState): boolean {
  if (!card.dishId) return false;
  if (card.isAvailable !== card.persistedIsAvailable) return true;
  if (card.trackStock !== card.persistedTrackStock) return true;
  if (card.trackStock) {
    const persistedStr = card.persistedStock === null ? "" : String(card.persistedStock);
    if (card.stockInput.trim() !== persistedStr) return true;
  }
  return false;
}

export function DailyMenuBoard({
  restaurantId,
  restaurantSlug,
  categories,
}: DailyMenuBoardProps) {
  const [isPending, startTransition] = useTransition();
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);

  const dailyCategory = useMemo(() => {
    return categories.find((cat) => isDailyMenuCategoryName(cat.name));
  }, [categories]);

  const savedDishes = useMemo(() => {
    return dailyCategory?.dishes || [];
  }, [dailyCategory]);

  const [cardsState, setCardsState] = useState<DailyMenuCardState[]>(() =>
    buildCardsFromDishes(dailyCategory?.dishes || [])
  );

  React.useEffect(() => {
    setCardsState(buildCardsFromDishes(dailyCategory?.dishes || []));
  }, [dailyCategory]);

  const savedCardsCount = useMemo(
    () => cardsState.filter((c) => Boolean(c.dishId)).length,
    [cardsState]
  );

  const visibleSavedCount = useMemo(
    () => cardsState.filter((c) => Boolean(c.dishId) && c.isVisible).length,
    [cardsState]
  );

  const areAllAvailable = useMemo(() => {
    const persisted = cardsState.filter((c) => Boolean(c.dishId));
    if (persisted.length === 0) return false;
    return persisted.every((d) => d.isAvailable);
  }, [cardsState]);

  const fileInputMapRef = useRef<Record<string, HTMLInputElement | null>>({});

  const handleCreateDailyCategory = () => {
    startTransition(async () => {
      const res = await createDailyMenuCategoryAction(restaurantId);
      if (res?.error) {
        setStatusMessage({ text: res.error, type: "error" });
      } else {
        setStatusMessage({
          text: "¡Categoría 'Menú del Día' creada en el 1er lugar de la carta digital!",
          type: "success",
        });
        window.location.reload();
      }
    });
  };

  const handleAddDraftCard = () => {
    const canShowByDefault = visibleSavedCount < MAX_VISIBLE_DAILY_MENU_DISHES;
    const draftNumber = cardsState.length + 1;
    setCardsState((prev) => [
      ...prev,
      {
        localKey: `draft-${Date.now()}-${draftNumber}`,
        name: `Opción ${draftNumber}`,
        price: "3.50",
        description: "Incluye sopa del día, arroz con menestra y bebida natural.",
        isAvailable: true,
        isVisible: canShowByDefault,
        trackStock: false,
        stockInput: "",
        persistedIsAvailable: true,
        persistedTrackStock: false,
        persistedStock: null,
        availabilityConflict: null,
        imageUrl: "",
      },
    ]);
  };

  const handleSaveCard = async (localKey: string, fileToUpload?: File) => {
    if (!dailyCategory) return;
    const card = cardsState.find((c) => c.localKey === localKey);
    if (!card) return;

    if (
      card.isVisible &&
      !card.dishId &&
      visibleSavedCount >= MAX_VISIBLE_DAILY_MENU_DISHES
    ) {
      setStatusMessage({
        text: `Ya hay ${MAX_VISIBLE_DAILY_MENU_DISHES} platos visibles en el Menú del Día. Oculta otro plato primero o guarda este como oculto.`,
        type: "error",
      });
      return;
    }

    setSavingKey(localKey);
    setStatusMessage(null);

    try {
      const formData = new FormData();
      formData.append("restaurantId", restaurantId);
      formData.append("categoryId", dailyCategory.id);
      if (card.dishId) {
        formData.append("dishId", card.dishId);
      } else {
        const stockErr = getStockValidationError(card);
        if (stockErr) {
          setStatusMessage({ text: stockErr, type: "error" });
          setSavingKey(null);
          return;
        }
        formData.append("isAvailable", card.isAvailable ? "true" : "false");
        formData.append("trackStock", card.trackStock ? "true" : "false");
        if (card.trackStock) {
          formData.append("stock", card.stockInput.trim());
        }
      }
      formData.append("name", card.name.trim() || "Plato del Día");
      formData.append("price", card.price.trim() || "3.50");
      formData.append("description", card.description.trim());
      formData.append("isVisible", card.isVisible ? "true" : "false");
      if (card.imageUrl) {
        formData.append("existingImageUrl", card.imageUrl);
      }

      if (fileToUpload) {
        try {
          const compressed = await compressImageToWebP(fileToUpload);
          formData.append("dishFile", compressed);
        } catch (compErr: any) {
          setCardsState((prev) =>
            prev.map((c) =>
              c.localKey === localKey ? { ...c, tempPreview: undefined } : c
            )
          );
          setStatusMessage({
            text:
              compErr?.message ||
              "Falló la compresión WebP. Se conservó la foto anterior sin subir el original.",
            type: "error",
          });
          return;
        }
      }

      const res = await saveDailyMenuDishAction(formData);
      if (res?.error) {
        setCardsState((prev) =>
          prev.map((c) =>
            c.localKey === localKey ? { ...c, tempPreview: undefined } : c
          )
        );
        setStatusMessage({ text: res.error, type: "error" });
      } else if (res?.dish) {
        setStatusMessage({
          text: `"${res.dish.name}" guardado correctamente.`,
          type: "success",
        });
        setCardsState((prev) =>
          prev.map((c) => {
            if (c.localKey !== localKey) return c;
            const serverTrack = res.dish.trackStock === true;
            const serverStock = typeof res.dish.stock === "number" ? res.dish.stock : null;
            const serverAvail = res.dish.isAvailable !== false;
            const preserveDraftAndRef =
              Boolean(card.dishId) &&
              (hasPendingAvailabilityChanges(c) || Boolean(c.availabilityConflict));
            return {
              ...c,
              localKey: res.dish.id,
              dishId: res.dish.id,
              name: res.dish.name,
              price: res.dish.price !== undefined ? String(res.dish.price) : c.price,
              description: res.dish.description ?? c.description,
              isVisible: res.dish.isVisible !== false,
              persistedIsAvailable: preserveDraftAndRef ? c.persistedIsAvailable : serverAvail,
              persistedTrackStock: preserveDraftAndRef ? c.persistedTrackStock : serverTrack,
              persistedStock: preserveDraftAndRef ? c.persistedStock : serverStock,
              isAvailable: preserveDraftAndRef ? c.isAvailable : serverAvail,
              trackStock: preserveDraftAndRef ? c.trackStock : serverTrack,
              stockInput: preserveDraftAndRef ? c.stockInput : serverStock !== null ? String(serverStock) : "",
              imageUrl: res.dish.imageUrl || c.imageUrl,
              tempPreview: undefined,
            };
          })
        );
      }
    } catch {
      setCardsState((prev) =>
        prev.map((c) =>
          c.localKey === localKey ? { ...c, tempPreview: undefined } : c
        )
      );
      setStatusMessage({
        text: "Error al guardar el plato del día.",
        type: "error",
      });
    } finally {
      setSavingKey(null);
    }
  };

  const handleToggleVisibility = async (localKey: string) => {
    const card = cardsState.find((c) => c.localKey === localKey);
    if (!card) return;
    const nextVisible = !card.isVisible;

    if (!card.dishId) {
      if (nextVisible && visibleSavedCount >= MAX_VISIBLE_DAILY_MENU_DISHES) {
        setStatusMessage({
          text: `Máximo ${MAX_VISIBLE_DAILY_MENU_DISHES} platos visibles. Oculta otro plato antes de mostrar este.`,
          type: "error",
        });
        return;
      }
      setCardsState((prev) =>
        prev.map((c) =>
          c.localKey === localKey ? { ...c, isVisible: nextVisible } : c
        )
      );
      return;
    }

    if (nextVisible && visibleSavedCount >= MAX_VISIBLE_DAILY_MENU_DISHES) {
      setStatusMessage({
        text: `Límite alcanzado: ya hay ${MAX_VISIBLE_DAILY_MENU_DISHES} platos visibles en el Menú del Día. Oculta otro plato antes de mostrar "${card.name}".`,
        type: "error",
      });
      return;
    }

    setSavingKey(localKey);
    setStatusMessage(null);
    try {
      const res = await toggleDailyMenuDishVisibilityAction(
        card.dishId,
        restaurantId,
        nextVisible
      );
      if (res?.error) {
        setStatusMessage({ text: res.error, type: "error" });
      } else {
        setCardsState((prev) =>
          prev.map((c) =>
            c.localKey === localKey
              ? { ...c, isVisible: res?.dish?.isVisible ?? nextVisible }
              : c
          )
        );
        setStatusMessage({
          text: nextVisible
            ? `"${card.name}" ahora está VISIBLE en la carta (disponibilidad y porciones sin cambios).`
            : `"${card.name}" fue OCULTADO de la carta (su disponibilidad y porciones se conservan).`,
          type: "success",
        });
      }
    } finally {
      setSavingKey(null);
    }
  };

  const handleSaveAvailability = async (localKey: string) => {
    const card = cardsState.find((c) => c.localKey === localKey);
    if (!card || !card.dishId) return;

    const stockErr = getStockValidationError(card);
    if (stockErr) {
      setStatusMessage({ text: stockErr, type: "error" });
      return;
    }

    const parsedStock = card.trackStock ? Number(card.stockInput.trim()) : null;
    const effectiveAvail = card.trackStock && parsedStock === 0 ? false : card.isAvailable;

    setSavingKey(localKey);
    setStatusMessage(null);
    try {
      const res: any = await saveDailyMenuAvailabilityAction({
        dishId: card.dishId,
        restaurantId,
        isAvailable: effectiveAvail,
        trackStock: card.trackStock,
        stock: parsedStock,
        expectedIsAvailable: card.persistedIsAvailable,
        expectedTrackStock: card.persistedTrackStock,
        expectedStock: card.persistedStock,
      });

      if (res?.conflict) {
        const curStock = typeof res.currentStock === "number" ? res.currentStock : null;
        const curAvail = Boolean(res.currentIsAvailable);
        const curTrack = Boolean(res.currentTrackStock);
        // NO actualizar persisted* silenciosamente tras un conflicto: exigir revisión explícita del usuario
        setCardsState((prev) =>
          prev.map((c) =>
            c.localKey === localKey
              ? {
                  ...c,
                  availabilityConflict: {
                    currentTrackStock: curTrack,
                    currentStock: curStock,
                    currentIsAvailable: curAvail,
                    message: res.error,
                  },
                }
              : c
          )
        );
        setStatusMessage({ text: res.error, type: "error" });
      } else if (res?.error) {
        // Conserva el borrador ante error sin confundirlo con lo persistido
        setStatusMessage({ text: res.error, type: "error" });
      } else if (res?.dish) {
        const serverTrack = res.dish.trackStock === true;
        const serverStock = typeof res.dish.stock === "number" ? res.dish.stock : null;
        const serverAvail = res.dish.isAvailable !== false;
        setCardsState((prev) =>
          prev.map((c) =>
            c.localKey === localKey
              ? {
                  ...c,
                  isAvailable: serverAvail,
                  trackStock: serverTrack,
                  stockInput: serverStock !== null ? String(serverStock) : "",
                  persistedIsAvailable: serverAvail,
                  persistedTrackStock: serverTrack,
                  persistedStock: serverStock,
                  availabilityConflict: null,
                }
              : c
          )
        );
        setStatusMessage({
          text: serverTrack
            ? `Confirmado: "${res.dish.name}" con ${serverStock ?? 0} porciones (${serverAvail ? "Disponible" : "Agotado"}).`
            : `Confirmado: "${res.dish.name}" en disponibilidad manual (${serverAvail ? "Disponible" : "Agotado"}).`,
          type: "success",
        });
      }
    } catch {
      setStatusMessage({
        text: "Error de conexión al guardar disponibilidad. Tu borrador se conservó.",
        type: "error",
      });
    } finally {
      setSavingKey(null);
    }
  };

  const handlePhotoCapture = async (
    localKey: string,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const localPreviewUrl = URL.createObjectURL(file);
    setCardsState((prev) =>
      prev.map((c) =>
        c.localKey === localKey ? { ...c, tempPreview: localPreviewUrl } : c
      )
    );

    await handleSaveCard(localKey, file);
    URL.revokeObjectURL(localPreviewUrl);
    e.target.value = "";
  };

  // Pausar o reactivar disponibilidad (isAvailable) sin alterar visibilidad (isVisible)
  const handleToggleAll = (targetAvailable: boolean) => {
    if (!dailyCategory) return;
    startTransition(async () => {
      const res = await toggleAllDailyMenuDishesAction(
        dailyCategory.id,
        restaurantId,
        targetAvailable
      );
      if (res?.error) {
        setStatusMessage({ text: res.error, type: "error" });
      } else {
        setStatusMessage({
          text: targetAvailable
            ? "¡Disponibilidad reactivada! Se conservó qué platos estaban visibles u ocultos."
            : "¡Platos marcados como AGOTADOS! Se conservó la visibilidad configurada.",
          type: "success",
        });
        setCardsState((prev) =>
          prev.map((s) => ({
            ...s,
            isAvailable: targetAvailable,
            persistedIsAvailable: s.dishId ? targetAvailable : s.persistedIsAvailable,
          }))
        );
      }
    });
  };

  const handleDeleteCard = async (localKey: string) => {
    const card = cardsState.find((c) => c.localKey === localKey);
    if (!card) return;

    if (!card.dishId) {
      setCardsState((prev) => prev.filter((c) => c.localKey !== localKey));
      return;
    }

    if (!confirm(`¿Eliminar "${card.name}" del Menú del Día?`)) return;

    setSavingKey(localKey);
    try {
      const res = await deleteDailyMenuDishAction(card.dishId, restaurantId);
      if (res?.error) {
        setStatusMessage({ text: res.error, type: "error" });
      } else {
        setStatusMessage({
          text: `"${card.name}" eliminado del Menú del Día.`,
          type: "success",
        });
        setCardsState((prev) => prev.filter((c) => c.localKey !== localKey));
      }
    } finally {
      setSavingKey(null);
    }
  };

  if (!dailyCategory) {
    return (
      <div className="bg-gradient-to-br from-amber-950/40 via-slate-900 to-slate-900 border border-amber-500/30 rounded-3xl p-5 sm:p-6 shadow-2xl relative overflow-hidden backdrop-blur-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-3 bg-amber-500/15 border border-amber-500/30 rounded-2xl text-amber-400 shrink-0">
              <UtensilsCrossed className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-extrabold text-white">
                  Tablero Exprés: Menú & Almuerzo del Día
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Fotos con el Celular
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                Toma la foto del almuerzo servido directamente con la cámara de tu smartphone. Se optimiza a formato WebP ligero y puedes guardar los platos de la semana mostrando hasta 4 visibles en carta.
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={isPending}
            onClick={handleCreateDailyCategory}
            className="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/20 transition-all cursor-pointer disabled:opacity-50 shrink-0"
          >
            {isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            <span>Activar Categoría "Menú del Día"</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-amber-950/30 via-slate-900/90 to-slate-900/90 border border-amber-500/30 rounded-3xl p-4 sm:p-6 shadow-2xl space-y-4 backdrop-blur-md">
      {/* Cabecera del Tablero */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 bg-amber-500/15 border border-amber-500/30 rounded-2xl text-amber-400 shrink-0 mt-0.5">
            <UtensilsCrossed className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm sm:text-base font-extrabold text-white">
                Tablero Exprés: Menú & Almuerzo del Día
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {visibleSavedCount} / {MAX_VISIBLE_DAILY_MENU_DISHES} Visibles en Carta
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                {savedCardsCount} guardados en semana
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Conserva todos los platos de la semana con su foto y muestra hasta 4 visibles hoy en carta (independiente de Disponible/Agotado).
            </p>
          </div>
        </div>

        {/* Acciones Globales del Tablero */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleAddDraftCard}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition shadow-sm cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nuevo Plato</span>
          </button>

          {savedDishes.length > 0 && (
            <button
              type="button"
              disabled={isPending}
              onClick={() => handleToggleAll(!areAllAvailable)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer ${
                areAllAvailable
                  ? "bg-rose-500/15 text-rose-300 border border-rose-500/30 hover:bg-rose-500/25"
                  : "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25"
              }`}
              title="Cambiar disponibilidad (Disponible/Agotado) sin alterar qué platos están visibles u ocultos"
            >
              {areAllAvailable ? (
                <>
                  <EyeOff className="w-3.5 h-3.5 text-rose-400" />
                  <span>Pausar Todos (Agotado)</span>
                </>
              ) : (
                <>
                  <Eye className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Reactivar Disponibilidad</span>
                </>
              )}
            </button>
          )}

          <a
            href={`/${restaurantSlug}#${dailyCategory.id}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700 text-xs font-medium transition"
          >
            <span>Ver en Menú QR</span>
          </a>
        </div>
      </div>

      {/* Alerta de Estado */}
      {statusMessage && (
        <div
          className={`p-3 rounded-xl text-xs flex items-center justify-between gap-2 animate-fadeIn ${
            statusMessage.type === "success"
              ? "bg-emerald-950/60 border border-emerald-500/40 text-emerald-200"
              : "bg-red-950/60 border border-red-500/40 text-red-200"
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMessage.type === "success" ? (
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="text-slate-400 hover:text-white text-[11px] underline cursor-pointer shrink-0"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* Grid de Platos del Menú del Día */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {cardsState.map((card, cardIdx) => {
          const isSlotSaving = savingKey === card.localKey;
          const displayImage = card.tempPreview || card.imageUrl;
          const hasImage = Boolean(displayImage && displayImage.trim() !== "");
          const isDishCreated = Boolean(card.dishId);

          return (
            <div
              key={card.localKey}
              data-daily-card-id={card.dishId || card.localKey}
              className={`rounded-2xl border p-3.5 flex flex-col justify-between transition-all relative ${
                card.isVisible
                  ? card.isAvailable
                    ? "bg-slate-950/90 border-slate-800 hover:border-amber-500/40"
                    : "bg-slate-950/75 border-rose-900/40"
                  : "bg-slate-950/40 border-dashed border-slate-800 opacity-85"
              }`}
            >
              <input
                ref={(el) => {
                  fileInputMapRef.current[card.localKey] = el;
                }}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => handlePhotoCapture(card.localKey, e)}
              />

              <div className="space-y-3">
                {/* Cabecera del Plato */}
                <div className="flex items-center justify-between gap-1.5 flex-wrap">
                  <span className="text-[11px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-lg bg-amber-500/20 text-amber-300 flex items-center justify-center text-[10px]">
                      #{cardIdx + 1}
                    </span>
                    <span>{card.isVisible ? "Visible" : "Oculto"}</span>
                  </span>

                  <div className="flex items-center gap-1 flex-wrap">
                    {/* Mostrar / Ocultar en carta (independiente de Disponible/Agotado) */}
                    <button
                      type="button"
                      disabled={isSlotSaving}
                      onClick={() => handleToggleVisibility(card.localKey)}
                      className={`px-2 py-0.5 rounded-full text-[10px] font-black cursor-pointer transition inline-flex items-center gap-1 disabled:opacity-50 ${
                        card.isVisible
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30"
                          : "bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700"
                      }`}
                      title={
                        card.isVisible
                          ? "Ocultar de la carta sin borrar ni cambiar stock/disponibilidad"
                          : "Mostrar en la carta (máx. 4 visibles)"
                      }
                    >
                      {card.isVisible ? (
                        <>
                          <Eye className="w-3 h-3" />
                          <span>En Carta</span>
                        </>
                      ) : (
                        <>
                          <EyeOff className="w-3 h-3" />
                          <span>Mostrar</span>
                        </>
                      )}
                    </button>

                    {/* Switch Disponible / Agotado (borrador hasta confirmar disponibilidad) */}
                    <button
                      type="button"
                      disabled={isSlotSaving}
                      onClick={() => {
                        setCardsState((prev) =>
                          prev.map((c) =>
                            c.localKey === card.localKey
                              ? { ...c, isAvailable: !c.isAvailable, availabilityConflict: null }
                              : c
                          )
                        );
                      }}
                      className={`px-2 py-0.5 rounded-full text-[10px] font-black cursor-pointer transition disabled:opacity-50 ${
                        card.isAvailable
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                          : "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                      }`}
                    >
                      {card.isAvailable ? "Disponible" : "Agotado"}
                    </button>

                    <button
                      type="button"
                      disabled={isSlotSaving}
                      onClick={() => handleDeleteCard(card.localKey)}
                      className="p-1 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition cursor-pointer disabled:opacity-50"
                      title="Eliminar esta opción del día"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Área de Foto */}
                <div className="relative rounded-xl overflow-hidden aspect-[4/3] bg-slate-900 border border-slate-800 group flex items-center justify-center">
                  {hasImage ? (
                    <>
                      <img
                        src={displayImage}
                        alt={card.name || `Menú ${cardIdx + 1}`}
                        className="w-full h-full object-cover transition duration-300 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-black/20" />
                      <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-xs text-[10px] font-bold text-amber-300 border border-white/10 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-amber-400" />
                        <span>{card.isVisible ? "Visible hoy" : "Guardado (oculto)"}</span>
                      </div>
                    </>
                  ) : (
                    <div className="text-center p-3 space-y-1">
                      <Camera className="w-8 h-8 mx-auto text-slate-600" />
                      <p className="text-[11px] font-bold text-slate-400">Sin foto</p>
                      <p className="text-[9px] text-slate-500">Toca abajo para tomar foto</p>
                    </div>
                  )}

                  {isSlotSaving && (
                    <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs flex flex-col items-center justify-center text-amber-400 text-xs font-bold gap-2">
                      <Loader2 className="w-6 h-6 animate-spin" />
                      <span>Guardando...</span>
                    </div>
                  )}
                </div>

                {/* Botón Cámara */}
                <button
                  type="button"
                  disabled={isSlotSaving}
                  onClick={() => fileInputMapRef.current[card.localKey]?.click()}
                  className="w-full py-2.5 px-3 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 hover:text-white font-extrabold text-xs transition flex items-center justify-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
                >
                  <Camera className="w-4 h-4 text-amber-400" />
                  <span>{hasImage ? "Cambiar Foto" : "Tomar Foto"}</span>
                </button>

                {/* Formulario del Plato */}
                <div className="space-y-2 pt-1 text-xs">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-400 mb-1">
                      Nombre del Plato
                    </label>
                    <input
                      type="text"
                      value={card.name}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCardsState((prev) =>
                          prev.map((c) =>
                            c.localKey === card.localKey ? { ...c, name: val } : c
                          )
                        );
                      }}
                      placeholder="ej: Seco de Pollo con Menestra"
                      className="w-full bg-slate-900 border border-slate-800 px-2.5 py-1.5 rounded-lg text-white text-xs focus:border-amber-500 focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-1">
                      <label className="block text-[10px] font-semibold text-slate-400 mb-1">
                        Precio ($)
                      </label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-2 flex items-center text-slate-500 text-[11px]">
                          $
                        </span>
                        <input
                          type="number"
                          step="0.25"
                          value={card.price}
                          onChange={(e) => {
                            const val = e.target.value;
                            setCardsState((prev) =>
                              prev.map((c) =>
                                c.localKey === card.localKey ? { ...c, price: val } : c
                              )
                            );
                          }}
                          className="w-full bg-slate-900 border border-slate-800 pl-5 pr-2 py-1.5 rounded-lg text-white text-xs focus:border-amber-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="col-span-2">
                      <label className="block text-[10px] font-semibold text-slate-400 mb-1">
                        Guarnición / Sopa
                      </label>
                      <input
                        type="text"
                        value={card.description}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCardsState((prev) =>
                            prev.map((c) =>
                              c.localKey === card.localKey
                                ? { ...c, description: val }
                                : c
                            )
                          );
                        }}
                        placeholder="ej: Sopa + Arroz + Jugo"
                        className="w-full bg-slate-900 border border-slate-800 px-2.5 py-1.5 rounded-lg text-white text-xs focus:border-amber-500 focus:outline-none truncate"
                      />
                    </div>
                  </div>
                </div>

                {/* Disponibilidad y Porciones Diarias Opcionales */}
                {(() => {
                  const stockErr = getStockValidationError(card);
                  const pendingAvail = hasPendingAvailabilityChanges(card);
                  const persistedSummary = card.persistedTrackStock
                    ? `${card.persistedStock ?? 0} porciones (${card.persistedIsAvailable && (card.persistedStock ?? 0) > 0 ? "Disponible" : "Agotado"})`
                    : `Manual (${card.persistedIsAvailable ? "Disponible" : "Agotado"})`;

                  return (
                    <div className="mt-2.5 p-2.5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2 text-[11px]">
                      <div className="flex items-center justify-between gap-1.5 flex-wrap">
                        <span className="font-bold text-slate-300 uppercase tracking-wider text-[10px]">
                          Disponibilidad y porciones
                        </span>
                        {isDishCreated && (
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                              pendingAvail
                                ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                : "bg-emerald-500/15 text-emerald-300 border border-emerald-500/25"
                            }`}
                          >
                            {pendingAvail ? "Cambios pendientes" : "Confirmado"}
                          </span>
                        )}
                      </div>

                      {isDishCreated && (
                        <p className="text-[10px] text-slate-400">
                          Persistido: <strong className="text-slate-200">{persistedSummary}</strong>
                        </p>
                      )}

                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          disabled={isSlotSaving}
                          onClick={() =>
                            setCardsState((prev) =>
                              prev.map((c) =>
                                c.localKey === card.localKey
                                  ? { ...c, trackStock: false, availabilityConflict: null }
                                  : c
                              )
                            )
                          }
                          className={`py-1 px-2 rounded-lg text-[10px] font-bold border transition cursor-pointer ${
                            !card.trackStock
                              ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                              : "bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200"
                          }`}
                        >
                          Manual (sin conteo)
                        </button>
                        <button
                          type="button"
                          disabled={isSlotSaving}
                          onClick={() =>
                            setCardsState((prev) =>
                              prev.map((c) =>
                                c.localKey === card.localKey
                                  ? {
                                      ...c,
                                      trackStock: true,
                                      stockInput:
                                        c.stockInput.trim() !== ""
                                          ? c.stockInput
                                          : c.persistedStock !== null
                                          ? String(c.persistedStock)
                                          : "0",
                                      availabilityConflict: null,
                                    }
                                  : c
                              )
                            )
                          }
                          className={`py-1 px-2 rounded-lg text-[10px] font-bold border transition cursor-pointer ${
                            card.trackStock
                              ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                              : "bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200"
                          }`}
                        >
                          Porciones limitadas
                        </button>
                      </div>

                      {card.trackStock && (
                        <div className="space-y-1">
                          <label className="block text-[10px] font-semibold text-slate-300">
                            Porciones restantes hoy
                          </label>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={card.stockInput}
                            onChange={(e) => {
                              const val = e.target.value;
                              // Aumentar stock no quita una pausa manual (isAvailable se mantiene)
                              setCardsState((prev) =>
                                prev.map((c) =>
                                  c.localKey === card.localKey
                                    ? { ...c, stockInput: val, availabilityConflict: null }
                                    : c
                                )
                              );
                            }}
                            placeholder="ej: 12"
                            className="w-full bg-slate-950 border border-slate-800 px-2.5 py-1.5 rounded-lg text-white text-xs focus:border-amber-500 focus:outline-none"
                          />
                          <p className="text-[9px] text-slate-400 leading-snug">
                            Reemplaza la cantidad restante actual (no suma). 0 deja el plato visible pero agotado.
                          </p>
                          {stockErr && (
                            <p className="text-[10px] text-rose-400 font-semibold">{stockErr}</p>
                          )}
                        </div>
                      )}

                      {card.availabilityConflict && (
                        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-2 text-[10px] text-amber-200 space-y-1.5">
                          <p className="font-semibold">{card.availabilityConflict.message}</p>
                          <p className="text-[9px] text-amber-300/90">
                            Estado actual en servidor:{" "}
                            {card.availabilityConflict.currentTrackStock
                              ? `${card.availabilityConflict.currentStock ?? 0} porciones`
                              : "Manual"}{" "}
                            ({card.availabilityConflict.currentIsAvailable ? "Disponible" : "Agotado"}).
                          </p>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <button
                              type="button"
                              onClick={() =>
                                setCardsState((prev) =>
                                  prev.map((c) => {
                                    if (c.localKey !== card.localKey || !c.availabilityConflict) return c;
                                    const cf = c.availabilityConflict;
                                    return {
                                      ...c,
                                      persistedIsAvailable: cf.currentIsAvailable,
                                      persistedTrackStock: cf.currentTrackStock,
                                      persistedStock: cf.currentStock,
                                      isAvailable: cf.currentIsAvailable,
                                      trackStock: cf.currentTrackStock,
                                      stockInput: cf.currentStock !== null ? String(cf.currentStock) : "",
                                      availabilityConflict: null,
                                    };
                                  })
                                )
                              }
                              className="px-2 py-1 rounded bg-amber-500 text-slate-950 font-bold text-[10px] cursor-pointer"
                            >
                              Aceptar estado actual y revisar
                            </button>
                          </div>
                        </div>
                      )}

                      {isDishCreated && (
                        <button
                          type="button"
                          disabled={isSlotSaving || !pendingAvail || Boolean(stockErr)}
                          onClick={() => handleSaveAvailability(card.localKey)}
                          className="w-full py-1.5 px-2.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 font-bold text-[11px] transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Guardar Disponibilidad
                        </button>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Botón Guardar */}
              <div className="pt-3 border-t border-slate-850 mt-3">
                <button
                  type="button"
                  disabled={isSlotSaving}
                  onClick={() => handleSaveCard(card.localKey)}
                  className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-white font-bold text-xs transition flex items-center justify-center gap-1.5 border border-slate-700 cursor-pointer disabled:opacity-50"
                >
                  {isSlotSaving ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{isDishCreated ? "Guardar Cambios" : "Guardar Plato"}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
