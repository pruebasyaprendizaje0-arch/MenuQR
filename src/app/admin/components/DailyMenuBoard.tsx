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
  DollarSign,
  Info,
  Clock,
  RefreshCw,
} from "lucide-react";
import {
  createDailyMenuCategoryAction,
  saveDailyMenuDishAction,
  toggleAllDailyMenuDishesAction,
  deleteDailyMenuDishAction,
} from "@/lib/actions";

interface DailyMenuDish {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  imageUrl?: string | null;
  isAvailable: boolean;
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

/**
 * Comprime cualquier foto tomada desde el celular (incluso fotos pesadas de 8MB-12MB)
 * a formato WebP optimizado de ~100KB en menos de 200ms en el navegador.
 */
async function compressImageToWebP(file: File, maxDim = 1000, quality = 0.82): Promise<File> {
  return new Promise((resolve) => {
    // Si no es imagen o FileReader falla, devolver original
    if (!file.type.startsWith("image/")) {
      resolve(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
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
          resolve(file);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(file);
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
      img.onerror = () => resolve(file);
      img.src = e.target?.result as string;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}

export function DailyMenuBoard({
  restaurantId,
  restaurantSlug,
  categories,
}: DailyMenuBoardProps) {
  const [isPending, startTransition] = useTransition();
  const [savingSlot, setSavingSlot] = useState<number | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Buscar categoría existente de Menú del Día o Almuerzo
  const dailyCategory = useMemo(() => {
    return categories.find((cat) => {
      const lower = cat.name.toLowerCase();
      return (
        lower.includes("menú del día") ||
        lower.includes("menu del dia") ||
        lower.includes("almuerzo") ||
        lower.includes("plato del día")
      );
    });
  }, [categories]);

  // Lista de platos vigentes en esta categoría (máximo 4)
  const dailyDishes = useMemo(() => {
    return (dailyCategory?.dishes || []).slice(0, 4);
  }, [dailyCategory]);

  const areAllAvailable = useMemo(() => {
    if (dailyDishes.length === 0) return false;
    return dailyDishes.every((d) => d.isAvailable);
  }, [dailyDishes]);

  // Estado local para los 4 slots de edición rápida
  const [slotsState, setSlotsState] = useState<
    Array<{
      dishId?: string;
      name: string;
      price: string;
      description: string;
      isAvailable: boolean;
      imageUrl: string;
      tempPreview?: string;
    }>
  >(() => {
    return [0, 1, 2, 3].map((idx) => {
      const existing = dailyCategory?.dishes?.[idx];
      return {
        dishId: existing?.id,
        name: existing?.name || `Opción ${idx + 1}`,
        price: existing?.price !== undefined ? existing.price.toString() : "3.50",
        description: existing?.description || "",
        isAvailable: existing?.isAvailable !== undefined ? existing.isAvailable : true,
        imageUrl: existing?.imageUrl || "",
      };
    });
  });

  // Mantener sincronizado cuando cambien los datos del servidor
  React.useEffect(() => {
    setSlotsState(
      [0, 1, 2, 3].map((idx) => {
        const existing = dailyCategory?.dishes?.[idx];
        return {
          dishId: existing?.id,
          name: existing?.name || (idx === 0 ? "Almuerzo Ejecutivo: Pollo" : idx === 1 ? "Almuerzo Ejecutivo: Carne" : idx === 2 ? "Sopa Especial / Pescado" : "Opción 4 / Vegetariano"),
          price: existing?.price !== undefined ? existing.price.toString() : "3.50",
          description: existing?.description || "Incluye sopa del día, arroz con menestra y bebida natural.",
          isAvailable: existing?.isAvailable !== undefined ? existing.isAvailable : true,
          imageUrl: existing?.imageUrl || "",
        };
      })
    );
  }, [dailyCategory]);

  // Referencias a los inputs de tipo archivo para disparar la cámara
  const fileInputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  // Crear la categoría automáticamente si el restaurante no la tiene
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

  // Guardar un slot particular (con o sin foto nueva)
  const handleSaveSlot = async (slotIndex: number, fileToUpload?: File) => {
    if (!dailyCategory) return;
    const slot = slotsState[slotIndex];
    setSavingSlot(slotIndex);

    try {
      const formData = new FormData();
      formData.append("restaurantId", restaurantId);
      formData.append("categoryId", dailyCategory.id);
      if (slot.dishId) {
        formData.append("dishId", slot.dishId);
      }
      formData.append("name", slot.name.trim() || `Almuerzo Opción ${slotIndex + 1}`);
      formData.append("price", slot.price.trim() || "3.50");
      formData.append("description", slot.description.trim());
      formData.append("isAvailable", slot.isAvailable ? "true" : "false");

      if (fileToUpload) {
        // Comprimir en WebP
        const compressed = await compressImageToWebP(fileToUpload);
        formData.append("dishFile", compressed);
      }

      const res = await saveDailyMenuDishAction(formData);
      if (res?.error) {
        setStatusMessage({ text: res.error, type: "error" });
      } else {
        setStatusMessage({
          text: `¡Opción #${slotIndex + 1} actualizada con éxito!`,
          type: "success",
        });
        // Si no tenía dishId, recargamos para que el ID quede asignado
        if (!slot.dishId) {
          window.location.reload();
        } else if (res?.dish) {
          // Actualizar estado local
          setSlotsState((prev) => {
            const next = [...prev];
            next[slotIndex] = {
              ...next[slotIndex],
              dishId: res.dish.id,
              imageUrl: res.dish.imageUrl || next[slotIndex].imageUrl,
              tempPreview: undefined,
            };
            return next;
          });
        }
      }
    } catch (err: any) {
      setStatusMessage({ text: "Error al guardar el plato del día.", type: "error" });
    } finally {
      setSavingSlot(null);
    }
  };

  // Al seleccionar/capturar la foto con la cámara
  const handlePhotoCapture = async (slotIndex: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Vista previa inmediata instantánea en el navegador
    const localPreviewUrl = URL.createObjectURL(file);
    setSlotsState((prev) => {
      const next = [...prev];
      next[slotIndex] = {
        ...next[slotIndex],
        tempPreview: localPreviewUrl,
      };
      return next;
    });

    // Guardar automáticamente la foto
    await handleSaveSlot(slotIndex, file);
    // Limpiar input
    e.target.value = "";
  };

  // Activar o desactivar todos los 4 menús del día en 1 clic
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
            ? "¡Todos los menús del día marcados como DISPONIBLES!"
            : "¡Menús del día marcados como AGOTADOS (Jornada finalizada)!",
          type: "success",
        });
        setSlotsState((prev) => prev.map((s) => ({ ...s, isAvailable: targetAvailable })));
      }
    });
  };

  // Eliminar un slot
  const handleDeleteSlot = async (slotIndex: number) => {
    const slot = slotsState[slotIndex];
    if (!slot.dishId) return;

    if (!confirm(`¿Eliminar la opción #${slotIndex + 1} del menú del día?`)) return;

    setSavingSlot(slotIndex);
    try {
      const res = await deleteDailyMenuDishAction(slot.dishId, restaurantId);
      if (res?.error) {
        setStatusMessage({ text: res.error, type: "error" });
      } else {
        setStatusMessage({
          text: `Opción #${slotIndex + 1} eliminada.`,
          type: "success",
        });
        window.location.reload();
      }
    } finally {
      setSavingSlot(null);
    }
  };

  // Si aún no existe la categoría, mostrar bienvenida para activarla en 1 clic
  if (!dailyCategory) {
    return (
      <div className="bg-gradient-to-br from-amber-950/40 via-slate-900 to-slate-900 border border-amber-500/30 rounded-3xl p-5 sm:p-6 shadow-2xl relative overflow-hidden backdrop-blur-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-3 bg-amber-500/15 border border-amber-500/30 rounded-2xl text-amber-400 shrink-0">
              <UtensilsCrossed className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-white">
                  Tablero Exprés: Menú & Almuerzo del Día
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  📸 Fotos con el Celular
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                Toma la foto del almuerzo servido directamente con la cámara de tu smartphone cada mañana. Se optimiza a WebP ligero (~100 KB) al instante y se publica sin buscar ni copiar URLs externas. Limitado a 4 opciones del día.
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
              <h3 className="text-sm sm:text-base font-extrabold text-white flex items-center gap-2">
                <span>Tablero Exprés: Menú & Almuerzo del Día</span>
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {dailyDishes.length} / 4 Opciones Configuradas
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Toca <strong>"Tomar Foto Hoy"</strong> desde el celular para abrir la cámara y actualizar la imagen al instante.
            </p>
          </div>
        </div>

        {/* Acciones Globales del Tablero */}
        <div className="flex items-center gap-2 flex-wrap">
          {dailyDishes.length > 0 && (
            <button
              type="button"
              disabled={isPending}
              onClick={() => handleToggleAll(!areAllAvailable)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer ${
                areAllAvailable
                  ? "bg-rose-500/15 text-rose-300 border border-rose-500/30 hover:bg-rose-500/25"
                  : "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25"
              }`}
              title="Activar o desactivar los 4 platos del día en la carta QR"
            >
              {areAllAvailable ? (
                <>
                  <EyeOff className="w-3.5 h-3.5 text-rose-400" />
                  <span>Pausar Todos (Agotado Hoy)</span>
                </>
              ) : (
                <>
                  <Eye className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Activar Todos (En Servicio)</span>
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
            className="text-slate-400 hover:text-white text-[11px] underline cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* Grid de 4 Slots Fijos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {[0, 1, 2, 3].map((slotIdx) => {
          const slot = slotsState[slotIdx];
          const isSlotSaving = savingSlot === slotIdx;
          const displayImage = slot.tempPreview || slot.imageUrl;
          const hasImage = Boolean(displayImage && displayImage.trim() !== "");
          const isDishCreated = Boolean(slot.dishId);

          return (
            <div
              key={slotIdx}
              className={`rounded-2xl border p-3.5 flex flex-col justify-between transition-all relative ${
                isDishCreated
                  ? slot.isAvailable
                    ? "bg-slate-950/90 border-slate-800 hover:border-amber-500/40"
                    : "bg-slate-950/50 border-slate-850 opacity-75"
                  : "bg-slate-950/30 border-dashed border-slate-800 hover:border-amber-500/50"
              }`}
            >
              {/* Input invisible que abre la cámara del celular con capture="environment" */}
              <input
                ref={fileInputRefs[slotIdx]}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => handlePhotoCapture(slotIdx, e)}
              />

              <div className="space-y-3">
                {/* Cabecera del Slot */}
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-lg bg-amber-500/20 text-amber-300 flex items-center justify-center text-[10px]">
                      #{slotIdx + 1}
                    </span>
                    <span>Menú {slotIdx + 1}</span>
                  </span>

                  <div className="flex items-center gap-1">
                    {/* Switch Disponible / Agotado */}
                    <button
                      type="button"
                      onClick={() => {
                        setSlotsState((prev) => {
                          const next = [...prev];
                          next[slotIdx].isAvailable = !next[slotIdx].isAvailable;
                          return next;
                        });
                      }}
                      className={`px-2 py-0.5 rounded-full text-[10px] font-black cursor-pointer transition ${
                        slot.isAvailable
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                          : "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                      }`}
                    >
                      {slot.isAvailable ? "Disponible" : "Agotado"}
                    </button>

                    {/* Eliminar Slot */}
                    {isDishCreated && (
                      <button
                        type="button"
                        onClick={() => handleDeleteSlot(slotIdx)}
                        className="p-1 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition cursor-pointer"
                        title="Eliminar esta opción del día"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Área de Foto con Obturador de Cámara */}
                <div className="relative rounded-xl overflow-hidden aspect-[4/3] bg-slate-900 border border-slate-800 group flex items-center justify-center">
                  {hasImage ? (
                    <>
                      <img
                        src={displayImage}
                        alt={`Menú ${slotIdx + 1}`}
                        className="w-full h-full object-cover transition duration-300 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-black/20" />
                      <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-xs text-[10px] font-bold text-amber-300 border border-white/10 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-amber-400" />
                        <span>Foto del Día</span>
                      </div>
                    </>
                  ) : (
                    <div className="text-center p-3 space-y-1">
                      <Camera className="w-8 h-8 mx-auto text-slate-600" />
                      <p className="text-[11px] font-bold text-slate-400">Sin foto de hoy</p>
                      <p className="text-[9px] text-slate-500">Toca abajo para tomar foto</p>
                    </div>
                  )}

                  {/* Overlay cargando foto */}
                  {isSlotSaving && (
                    <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs flex flex-col items-center justify-center text-amber-400 text-xs font-bold gap-2">
                      <Loader2 className="w-6 h-6 animate-spin" />
                      <span>Guardando WebP...</span>
                    </div>
                  )}
                </div>

                {/* Botón Prominente: Tomar Foto con la Cámara del Celular */}
                <button
                  type="button"
                  disabled={isSlotSaving}
                  onClick={() => fileInputRefs[slotIdx].current?.click()}
                  className="w-full py-2.5 px-3 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 hover:text-white font-extrabold text-xs transition flex items-center justify-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
                >
                  <Camera className="w-4 h-4 text-amber-400" />
                  <span>{hasImage ? "📸 Cambiar Foto Hoy" : "📸 Tomar Foto Hoy"}</span>
                </button>

                {/* Formulario Rápido del Slot */}
                <div className="space-y-2 pt-1 text-xs">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-400 mb-1">
                      Nombre del Plato
                    </label>
                    <input
                      type="text"
                      value={slot.name}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSlotsState((prev) => {
                          const next = [...prev];
                          next[slotIdx].name = val;
                          return next;
                        });
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
                        <span className="absolute inset-y-0 left-0 pl-2 flex items-center text-slate-500 text-[11px]">$</span>
                        <input
                          type="number"
                          step="0.25"
                          value={slot.price}
                          onChange={(e) => {
                            const val = e.target.value;
                            setSlotsState((prev) => {
                              const next = [...prev];
                              next[slotIdx].price = val;
                              return next;
                            });
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
                        value={slot.description}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSlotsState((prev) => {
                            const next = [...prev];
                            next[slotIdx].description = val;
                            return next;
                          });
                        }}
                        placeholder="ej: Sopa + Arroz + Jugo"
                        className="w-full bg-slate-900 border border-slate-800 px-2.5 py-1.5 rounded-lg text-white text-xs focus:border-amber-500 focus:outline-none truncate"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Botón Guardar Datos de Texto */}
              <div className="pt-3 border-t border-slate-850 mt-3">
                <button
                  type="button"
                  disabled={isSlotSaving}
                  onClick={() => handleSaveSlot(slotIdx)}
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
                      <span>{isDishCreated ? "Guardar Texto" : "Crear Plato del Día"}</span>
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
