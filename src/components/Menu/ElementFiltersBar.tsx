"use client";

import React, { useState, useMemo } from "react";
import { Sparkles, X, Plus, Check, ShoppingCart, Utensils, Star, Flame, Award, Heart, Ban } from "lucide-react";
import { ElementFiltersConfig } from "@/lib/element-filters-types";

interface Dish {
  id: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  isAvailable: boolean;
}

interface Category {
  id: string;
  name: string;
  dishes: Dish[];
}

interface ElementFiltersBarProps {
  config?: ElementFiltersConfig | null;
  categories: Category[];
  themeColor?: string;
  onAddToCart?: (dish: Dish) => void;
}

function normalizeText(text?: string | null): string {
  if (!text) return "";
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export function ElementFiltersBar({
  config,
  categories,
  themeColor = "#ef4444",
  onAddToCart,
}: ElementFiltersBarProps) {
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  // Si el módulo está apagado o no hay tags, no renderiza NADA (Cero huella visual)
  if (!config || !config.enabled || !config.elements || config.elements.length === 0) {
    return null;
  }

  // Extraer todos los platos disponibles de la carta real
  const allDishes = useMemo(() => {
    const list: { dish: Dish; categoryName: string }[] = [];
    categories.forEach((cat) => {
      cat.dishes.forEach((dish) => {
        if (dish.isAvailable) {
          list.push({ dish, categoryName: cat.name });
        }
      });
    });
    return list;
  }, [categories]);

  // Platos marcados manualmente o destacados como "Plato del Día"
  const dailySpecials = useMemo(() => {
    const ids = config.dailySpecialDishIds || [];
    if (ids.length === 0) return [];
    return allDishes.filter(({ dish }) => ids.includes(dish.id));
  }, [allDishes, config.dailySpecialDishIds]);

  // Ordenar elementos por prioridad (Mayor prioridad primero, agotados al final)
  const sortedElements = useMemo(() => {
    return [...config.elements].sort((a, b) => {
      if (a.stockLevel === "AGOTADO" && b.stockLevel !== "AGOTADO") return 1;
      if (b.stockLevel === "AGOTADO" && a.stockLevel !== "AGOTADO") return -1;
      return (b.priority || 3) - (a.priority || 3);
    });
  }, [config.elements]);

  // Obtener los tags seleccionados
  const activeTags = useMemo(() => {
    return config.elements.filter((el) => selectedTagIds.includes(el.id));
  }, [config.elements, selectedTagIds]);

  // Filtrar platos reales que coincidan con las palabras clave de los tags seleccionados
  const matchingDishes = useMemo(() => {
    if (activeTags.length === 0) return [];

    return allDishes.filter(({ dish }) => {
      const normName = normalizeText(dish.name);
      const normDesc = normalizeText(dish.description);
      const combined = `${normName} ${normDesc}`;

      // Comprobar si coincide con al menos uno de los tags seleccionados
      return activeTags.some((tag) => {
        return tag.keywords.some((kw) => {
          const normKw = normalizeText(kw);
          return normKw && combined.includes(normKw);
        });
      });
    });
  }, [allDishes, activeTags]);

  const toggleTag = (tagId: string, isAgotado: boolean) => {
    if (isAgotado) return;
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  const clearFilters = () => {
    setSelectedTagIds([]);
  };

  return (
    <div className="w-full my-6 relative z-20 space-y-4 font-sans">
      {/* SECCIÓN DESTACADA: PLATO DEL DÍA / ESPECIAL DE HOY */}
      {dailySpecials.length > 0 && selectedTagIds.length === 0 && (
        <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-amber-500/15 via-slate-900/90 to-slate-950 border border-amber-500/30 shadow-2xl backdrop-blur-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3 relative z-10">
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center h-7 w-7 rounded-xl bg-gradient-to-tr from-amber-500 to-red-500 text-white shadow-lg shadow-amber-500/20">
                <Star className="h-4 w-4 fill-white text-white animate-spin-slow" />
              </span>
              <div>
                <h3 className="text-sm sm:text-base font-black text-white tracking-tight flex items-center gap-1.5">
                  <span>{config.dailySpecialTitle || "Plato del Día / Especial de Hoy"}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-extrabold border border-amber-500/30 uppercase tracking-wider">
                    Recomendado
                  </span>
                </h3>
                <p className="text-[11px] text-slate-400">
                  {config.dailySpecialSubtitle || "Nuestra especialidad seleccionada para tu deleite hoy"}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 relative z-10">
            {dailySpecials.map(({ dish, categoryName }) => (
              <div
                key={dish.id}
                className="p-3.5 bg-slate-950/90 rounded-2xl border border-amber-500/20 flex items-center justify-between gap-3.5 hover:border-amber-500/50 transition-all duration-300 shadow-lg"
              >
                {dish.imageUrl && (
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden bg-slate-900 shrink-0 border border-white/10">
                    <img
                      src={dish.imageUrl}
                      alt={dish.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <span className="text-[9px] uppercase font-black tracking-wider text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20 inline-block mb-1">
                    {categoryName}
                  </span>
                  <h4 className="text-xs sm:text-sm font-black text-white truncate">{dish.name}</h4>
                  {dish.description && (
                    <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5 leading-snug">
                      {dish.description}
                    </p>
                  )}
                  <div className="text-xs sm:text-sm font-extrabold text-amber-400 mt-1">
                    ${dish.price.toFixed(2)}
                  </div>
                </div>

                {onAddToCart && (
                  <button
                    type="button"
                    onClick={() => onAddToCart(dish)}
                    className="px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-xl font-black text-xs text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 shadow-md transition-all active:scale-95 shrink-0 flex items-center gap-1.5 cursor-pointer"
                    title="Pedir Plato del Día"
                  >
                    <ShoppingCart className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Pedir</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* FILTRO INTERACTIVO POR PROTEÍNA / INGREDIENTE */}
      <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800/90 rounded-2xl p-4 sm:p-5 shadow-2xl space-y-3.5">
        {/* Encabezado del Módulo */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/60 pb-3">
          <div className="flex items-center gap-2">
            <div
              className="h-7 w-7 rounded-lg flex items-center justify-center text-white shrink-0 shadow-md"
              style={{ backgroundColor: themeColor }}
            >
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-white text-sm sm:text-base tracking-tight leading-tight">
                {config.title || "¿Qué se te antoja hoy?"}
              </h3>
              <p className="text-[11px] text-slate-400">
                {config.subtitle || "Selecciona ingredientes para filtrar la carta al instante"}
              </p>
            </div>
          </div>

          {selectedTagIds.length > 0 && (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-800 px-2.5 py-1 rounded-full transition-all self-start sm:self-auto cursor-pointer"
            >
              <X className="h-3 w-3" /> Limpiar ({selectedTagIds.length})
            </button>
          )}
        </div>

        {/* Botones / Píldoras de Elementos interactivos */}
        <div className="flex flex-wrap gap-2 pt-1">
          {sortedElements.map((el) => {
            const isAgotado = el.stockLevel === "AGOTADO";
            const isPoco = el.stockLevel === "POCO";
            const isSelected = selectedTagIds.includes(el.id);
            const isTopPriority = (el.priority || 3) >= 5;

            return (
              <button
                key={el.id}
                type="button"
                disabled={isAgotado}
                onClick={() => toggleTag(el.id, isAgotado)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 border ${
                  isAgotado
                    ? "bg-slate-950/40 border-slate-900 text-slate-600 line-through cursor-not-allowed opacity-50"
                    : isSelected
                    ? "text-white shadow-lg scale-105 cursor-pointer"
                    : "bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white cursor-pointer"
                }`}
                style={
                  isSelected
                    ? {
                        backgroundColor: el.colorHex || themeColor,
                        borderColor: el.colorHex || themeColor,
                      }
                    : undefined
                }
              >
                {isAgotado ? (
                  <Ban className="h-3 w-3 text-red-500/70 shrink-0" />
                ) : isSelected ? (
                  <Check className="h-3.5 w-3.5 shrink-0" />
                ) : isTopPriority ? (
                  <span className="text-[#ccff00]">🔥</span>
                ) : (
                  <Plus className="h-3 w-3 opacity-60 shrink-0" />
                )}
                <span>{el.label}</span>
                {isPoco && !isAgotado && !isSelected && (
                  <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 font-normal">
                    Pocas
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Resultados de búsqueda en tiempo real dentro del Menú */}
        {selectedTagIds.length > 0 && (
          <div className="pt-3 border-t border-slate-800/80 space-y-3 animate-in fade-in duration-300">
            <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
              <span>
                Platos disponibles con:{" "}
                <strong className="text-white font-bold">
                  {activeTags.map((t) => t.label).join(" + ")}
                </strong>
              </span>
              <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full text-[10px] font-mono">
                {matchingDishes.length} plato(s)
              </span>
            </div>

            {matchingDishes.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-72 overflow-y-auto pr-1">
                {matchingDishes.map(({ dish, categoryName }) => {
                  const isDaily = config.dailySpecialDishIds?.includes(dish.id);
                  return (
                    <div
                      key={dish.id}
                      className={`p-3 bg-slate-950/80 rounded-xl border flex items-center justify-between gap-3 hover:border-slate-700 transition ${
                        isDaily ? "border-amber-500/50 bg-amber-500/5" : "border-slate-800/90"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] uppercase font-bold text-amber-500/90 bg-amber-500/10 px-1.5 py-0.5 rounded">
                            {categoryName}
                          </span>
                          {isDaily && (
                            <span className="text-[9px] uppercase font-extrabold text-amber-300 bg-amber-500/20 px-1.5 py-0.5 rounded border border-amber-500/30 flex items-center gap-0.5">
                              <Star className="h-2.5 w-2.5 fill-amber-300 text-amber-300" /> Especial del Día
                            </span>
                          )}
                        </div>
                        <h4 className="text-xs font-bold text-white truncate mt-1">{dish.name}</h4>
                        {dish.description && (
                          <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                            {dish.description}
                          </p>
                        )}
                        <div className="text-xs font-extrabold text-amber-400 mt-1">
                          ${dish.price.toFixed(2)}
                        </div>
                      </div>

                      {onAddToCart && (
                        <button
                          type="button"
                          onClick={() => onAddToCart(dish)}
                          className="h-8 w-8 rounded-lg flex items-center justify-center text-white shrink-0 shadow-md transition-transform hover:scale-105 active:scale-95 cursor-pointer"
                          style={{ backgroundColor: themeColor }}
                          title="Agregar al pedido"
                        >
                          <ShoppingCart className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800/80 text-center space-y-2">
                <Utensils className="h-6 w-6 text-slate-600 mx-auto" />
                <p className="text-xs text-slate-400">
                  No se encontraron platos activos que contengan estos ingredientes específicos.
                </p>
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-[11px] text-amber-400 hover:underline font-bold"
                >
                  Ver toda la carta disponible
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
