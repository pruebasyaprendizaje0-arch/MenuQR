"use client";

import React, { useState, useEffect } from "react";
import {
  Sliders,
  Sparkles,
  Save,
  Check,
  AlertCircle,
  Plus,
  Trash2,
  Tag,
  Coffee,
  Fish,
  Flame,
  Pizza,
  Eye,
  CheckCircle2,
  RefreshCw,
  Star,
  Award,
  CircleDot,
  Edit2,
} from "lucide-react";
import {
  ElementFiltersConfig,
  ElementTag,
  StockLevel,
  BusinessPresetType,
  PRESET_CONFIGS,
  DEFAULT_ELEMENT_FILTERS_CONFIG,
} from "@/lib/element-filters-types";
import {
  getElementFiltersConfigAction,
  saveElementFiltersConfigAction,
} from "@/lib/element-filters-actions";

interface ElementFiltersAdminTabProps {
  restaurant: {
    id: string;
    name: string;
    slug: string;
    themeColor?: string;
  };
}

// Icon helper per label
function getElementEmoji(label: string, icon?: string): string {
  const norm = label.toLowerCase();
  if (norm.includes("camaron") || norm.includes("camarón")) return "🦐";
  if (norm.includes("pescado") || norm.includes("corvina") || norm.includes("salmon") || norm.includes("atun")) return "🐟";
  if (norm.includes("pulpo") || norm.includes("calamar")) return "🐙";
  if (norm.includes("cangrejo") || norm.includes("concha")) return "🦀";
  if (norm.includes("carne") || norm.includes("res") || norm.includes("bife") || norm.includes("picaña")) return "🥩";
  if (norm.includes("pollo") || norm.includes("alitas") || norm.includes("pechuga")) return "🍗";
  if (norm.includes("costilla") || norm.includes("cerdo")) return "🍖";
  if (norm.includes("cafe") || norm.includes("café") || norm.includes("espresso")) return "☕";
  if (norm.includes("frio") || norm.includes("frappe") || norm.includes("ice")) return "🧋";
  if (norm.includes("te") || norm.includes("té") || norm.includes("matcha")) return "🍵";
  if (norm.includes("leche") || norm.includes("avena") || norm.includes("almendra")) return "🥛";
  if (norm.includes("postre") || norm.includes("torta") || norm.includes("dulce")) return "🍰";
  if (norm.includes("sandwich") || norm.includes("panini") || norm.includes("tostada")) return "🥪";
  if (norm.includes("pizza") || norm.includes("mozzarella") || norm.includes("queso")) return "🍕";
  if (norm.includes("pasta") || norm.includes("lasagna") || norm.includes("spaghetti")) return "🍝";
  if (norm.includes("hamburguesa") || norm.includes("burger")) return "🍔";
  return "✨";
}

export default function ElementFiltersAdminTab({ restaurant }: ElementFiltersAdminTabProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [editingKeywordsId, setEditingKeywordsId] = useState<string | null>(null);

  const [config, setConfig] = useState<ElementFiltersConfig>(DEFAULT_ELEMENT_FILTERS_CONFIG);

  useEffect(() => {
    async function loadConfig() {
      try {
        setLoading(true);
        const data = await getElementFiltersConfigAction(restaurant.id);
        setConfig(data);
      } catch (err) {
        console.error("Error al cargar configuración de filtros:", err);
      } finally {
        setLoading(false);
      }
    }
    loadConfig();
  }, [restaurant.id]);

  const handleToggleEnabled = () => {
    setConfig((prev) => ({ ...prev, enabled: !prev.enabled }));
  };

  const handleApplyPreset = (preset: BusinessPresetType) => {
    if (preset === "personalizado") {
      setConfig((prev) => ({ ...prev, preset }));
      return;
    }
    const template = PRESET_CONFIGS[preset];
    if (template) {
      setConfig((prev) => ({
        ...prev,
        preset,
        title: template.title,
        subtitle: template.subtitle,
        elements: template.elements.map((el) => ({
          ...el,
          id: `${preset}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        })),
      }));
    }
  };

  const handleAddElement = () => {
    const newElement: ElementTag = {
      id: `el-${Date.now()}`,
      label: "Nueva Proteína / Ingrediente",
      colorHex: restaurant.themeColor || "#ef4444",
      keywords: ["palabra1", "palabra2"],
      stockLevel: "MUCHO",
      priority: 4,
      isAvailableToday: true,
    };
    setConfig((prev) => ({
      ...prev,
      elements: [...prev.elements, newElement],
    }));
  };

  const handleSetStockLevel = (index: number, stockLevel: StockLevel) => {
    setConfig((prev) => {
      const updated = [...prev.elements];
      updated[index] = {
        ...updated[index],
        stockLevel,
        isAvailableToday: stockLevel !== "AGOTADO",
      };
      return { ...prev, elements: updated };
    });
  };

  const handleSetPriority = (index: number, priority: number) => {
    setConfig((prev) => {
      const updated = [...prev.elements];
      updated[index] = { ...updated[index], priority };
      return { ...prev, elements: updated };
    });
  };

  const handleUpdateElement = (index: number, field: keyof ElementTag, value: any) => {
    setConfig((prev) => {
      const updated = [...prev.elements];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, elements: updated };
    });
  };

  const handleDeleteElement = (index: number) => {
    setConfig((prev) => {
      const updated = [...prev.elements];
      updated.splice(index, 1);
      return { ...prev, elements: updated };
    });
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setErrorMsg("");
      setSuccessMsg("");

      const res = await saveElementFiltersConfigAction(restaurant.id, config);
      if (res.success) {
        setSuccessMsg("¡Inventario y configuración de proteínas guardada exitosamente!");
        setTimeout(() => setSuccessMsg(""), 4000);
      } else {
        setErrorMsg(res.error || "No se pudo guardar la configuración.");
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Error al comunicarse con el servidor.");
    } finally {
      setSaving(false);
    }
  };

  const activeCount = config.elements.filter((el) => el.stockLevel !== "AGOTADO").length;

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-400 space-y-3">
        <RefreshCw className="h-6 w-6 animate-spin mx-auto text-amber-500" />
        <p className="text-xs font-semibold">Cargando inventario de proteínas...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl font-sans">
      {/* Header Card */}
      <div className="p-5 bg-slate-900/80 border border-slate-850 rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-2xl backdrop-blur-xl">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-lime-500/10 border border-lime-500/20 text-lime-400 text-[10px] font-black uppercase tracking-wider">
            <Sliders className="h-3 w-3" /> Control Diario de Disponibilidad
          </div>
          <h2 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
            Inventario de Proteínas & Ingredientes Clave
          </h2>
          <p className="text-xs text-slate-400 leading-relaxed max-w-xl">
            Ajusta en tiempo real el stock (Mucho / Poco / Agotado) y la prioridad diaria de tus proteínas o ingredientes. Los comensales verán primero lo que más deseas vender hoy.
          </p>
        </div>

        {/* Switch Maestro ON/OFF */}
        <div className="flex items-center gap-3 bg-slate-950 p-3 rounded-2xl border border-slate-800 shrink-0">
          <span className="text-xs font-bold text-slate-300">
            {config.enabled ? (
              <span className="text-lime-400 flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> Módulo Activo
              </span>
            ) : (
              <span className="text-slate-500">Desactivado</span>
            )}
          </span>
          <button
            type="button"
            onClick={handleToggleEnabled}
            className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${
              config.enabled ? "bg-lime-500 justify-end" : "bg-slate-700 justify-start"
            }`}
          >
            <div className="bg-slate-950 w-4 h-4 rounded-full shadow-md transition-transform" />
          </button>
        </div>
      </div>

      {/* Messages */}
      {successMsg && (
        <div className="p-3 bg-lime-500/10 border border-lime-500/30 rounded-2xl text-xs text-lime-400 font-bold flex items-center gap-2">
          <Check className="h-4 w-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-2xl text-xs text-red-400 font-bold flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Presets Rápidos según el Negocio */}
      <div className="p-5 bg-slate-900/60 border border-slate-800/80 rounded-3xl space-y-3.5">
        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-lime-400" />
          Plantillas Rápidas según Tipo de Establecimiento
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <button
            type="button"
            onClick={() => handleApplyPreset("mariscos")}
            className={`p-3 rounded-2xl border text-left transition space-y-1 cursor-pointer ${
              config.preset === "mariscos" ? "bg-slate-900 border-lime-400/50 shadow-lg" : "bg-slate-950/70 border-slate-800 hover:border-slate-700"
            }`}
          >
            <div className="flex items-center gap-1.5 text-orange-400 font-bold text-xs">
              <Fish className="h-4 w-4" /> Marisquería
            </div>
            <p className="text-[10px] text-slate-400">Camarón, Pescado, Pulpo, Cangrejo...</p>
          </button>

          <button
            type="button"
            onClick={() => handleApplyPreset("cafeteria")}
            className={`p-3 rounded-2xl border text-left transition space-y-1 cursor-pointer ${
              config.preset === "cafeteria" ? "bg-slate-900 border-lime-400/50 shadow-lg" : "bg-slate-950/70 border-slate-800 hover:border-slate-700"
            }`}
          >
            <div className="flex items-center gap-1.5 text-amber-400 font-bold text-xs">
              <Coffee className="h-4 w-4" /> Cafetería / Bakery
            </div>
            <p className="text-[10px] text-slate-400">Café Especial, Leches, Postres...</p>
          </button>

          <button
            type="button"
            onClick={() => handleApplyPreset("pizzeria")}
            className={`p-3 rounded-2xl border text-left transition space-y-1 cursor-pointer ${
              config.preset === "pizzeria" ? "bg-slate-900 border-lime-400/50 shadow-lg" : "bg-slate-950/70 border-slate-800 hover:border-slate-700"
            }`}
          >
            <div className="flex items-center gap-1.5 text-red-400 font-bold text-xs">
              <Pizza className="h-4 w-4" /> Pizzería / Pasta
            </div>
            <p className="text-[10px] text-slate-400">Quesos, Embutidos, Pastas...</p>
          </button>

          <button
            type="button"
            onClick={() => handleApplyPreset("parrillada")}
            className={`p-3 rounded-2xl border text-left transition space-y-1 cursor-pointer ${
              config.preset === "parrillada" ? "bg-slate-900 border-lime-400/50 shadow-lg" : "bg-slate-950/70 border-slate-800 hover:border-slate-700"
            }`}
          >
            <div className="flex items-center gap-1.5 text-rose-400 font-bold text-xs">
              <Flame className="h-4 w-4" /> Parrillada / Asados
            </div>
            <p className="text-[10px] text-slate-400">Cortes Res, Costillas, Pollo...</p>
          </button>
        </div>
      </div>

      {/* SECCIÓN PRINCIPAL: INVENTARIO DE PROTEÍNAS (ESTILO DARK SCREENSHOT) */}
      <div className="p-5 sm:p-7 bg-[#0b1329]/95 border border-slate-800 rounded-3xl shadow-2xl space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
          <div className="flex items-center gap-2.5">
            <h3 className="text-sm sm:text-base font-black text-slate-200 uppercase tracking-widest">
              INVENTARIO PROTEÍNA / INGREDIENTES
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="bg-[#ccff00] text-slate-950 text-xs font-black px-3 py-1 rounded-full shadow-md shadow-[#ccff00]/20">
              {activeCount} activas
            </span>
            <button
              type="button"
              onClick={handleAddElement}
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white transition text-xs font-bold flex items-center gap-1 cursor-pointer"
              title="Añadir elemento"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Lista de Tarjetas de Proteínas / Elementos */}
        <div className="space-y-4">
          {config.elements.map((el, idx) => {
            const stock = el.stockLevel || (el.isAvailableToday === false ? "AGOTADO" : "MUCHO");
            const priority = el.priority || 3;
            const emoji = getElementEmoji(el.label);

            return (
              <div
                key={el.id || idx}
                className="p-4 sm:p-5 rounded-2xl bg-[#0f1b38]/80 border border-slate-800/90 shadow-lg space-y-3.5 transition-all hover:border-slate-700"
              >
                {/* Fila Superior: Icono + Título + Subtítulo + Estrellas + Eliminar */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-[#1e293b] border border-white/10 flex items-center justify-center text-xl shadow-inner shrink-0">
                      {emoji}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={el.label}
                          onChange={(e) => handleUpdateElement(idx, "label", e.target.value)}
                          className="font-extrabold text-white text-sm sm:text-base bg-transparent border-b border-transparent hover:border-slate-700 focus:border-lime-400 focus:outline-none transition py-0.5 px-1"
                        />
                      </div>
                      <div className="text-xs text-slate-400 flex items-center gap-1.5 px-1">
                        <span
                          className={`font-bold ${
                            stock === "MUCHO"
                              ? "text-[#ccff00]"
                              : stock === "POCO"
                              ? "text-amber-400"
                              : "text-red-400 line-through"
                          }`}
                        >
                          {stock === "MUCHO" ? "Mucho stock" : stock === "POCO" ? "Poco stock" : "Agotado"}
                        </span>
                        <span className="text-slate-600">•</span>
                        <span className="text-slate-400">Prioridad {priority}</span>
                      </div>
                    </div>
                  </div>

                  {/* Rating Stars & Remove */}
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((starVal) => (
                        <Star
                          key={starVal}
                          className={`h-3.5 w-3.5 ${
                            starVal <= priority
                              ? "fill-[#ccff00] text-[#ccff00]"
                              : "text-slate-700 fill-slate-800"
                          }`}
                        />
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteElement(idx)}
                      className="text-slate-600 hover:text-red-400 p-1 transition cursor-pointer"
                      title="Eliminar elemento"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Segmented 3-Button Pill Selector for Stock (MUCHO | POCO | AGOTADO) */}
                <div className="grid grid-cols-3 gap-1.5 bg-[#070d1e] p-1 rounded-2xl border border-slate-850">
                  <button
                    type="button"
                    onClick={() => handleSetStockLevel(idx, "MUCHO")}
                    className={`py-2 px-3 rounded-xl text-xs font-black transition-all cursor-pointer ${
                      stock === "MUCHO"
                        ? "bg-[#ccff00] text-slate-950 shadow-md shadow-[#ccff00]/20"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    MUCHO
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetStockLevel(idx, "POCO")}
                    className={`py-2 px-3 rounded-xl text-xs font-black transition-all cursor-pointer ${
                      stock === "POCO"
                        ? "bg-[#fbbf24] text-slate-950 shadow-md shadow-amber-500/20"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    POCO
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetStockLevel(idx, "AGOTADO")}
                    className={`py-2 px-3 rounded-xl text-xs font-black transition-all cursor-pointer ${
                      stock === "AGOTADO"
                        ? "bg-[#ef4444] text-white shadow-md shadow-red-500/20"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    AGOTADO
                  </button>
                </div>

                {/* Slider for Prioridad Hoy */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex justify-between items-center text-[10px] uppercase font-extrabold text-slate-400 tracking-wider">
                    <span>PRIORIDAD HOY</span>
                    <span className="text-[#ccff00] font-mono">{priority} / 5</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    step="1"
                    value={priority}
                    onChange={(e) => handleSetPriority(idx, Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-[#ccff00]"
                  />
                </div>

                {/* Palabras Clave Toggle / Editor */}
                <div className="pt-1 border-t border-slate-800/40 flex items-center justify-between text-[11px]">
                  {editingKeywordsId === el.id ? (
                    <div className="flex-1 flex gap-2">
                      <input
                        type="text"
                        value={el.keywords.join(", ")}
                        onChange={(e) =>
                          handleUpdateElement(
                            idx,
                            "keywords",
                            e.target.value.split(",").map((k) => k.trim()).filter(Boolean)
                          )
                        }
                        placeholder="ej: camaron, camarones, shrimp"
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-lime-400 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setEditingKeywordsId(null)}
                        className="px-2.5 py-1 bg-lime-500 text-slate-950 rounded-lg font-bold text-xs"
                      >
                        OK
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className="text-slate-500 truncate max-w-xs">
                        Palabras clave: <code className="text-slate-400">{el.keywords.join(", ")}</code>
                      </span>
                      <button
                        type="button"
                        onClick={() => setEditingKeywordsId(el.id)}
                        className="text-lime-400 hover:underline flex items-center gap-1 font-bold shrink-0 cursor-pointer"
                      >
                        <Edit2 className="h-3 w-3" /> Editar Búsqueda
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}

          {config.elements.length === 0 && (
            <div className="p-8 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-2xl space-y-2">
              <p>No tienes proteínas configuradas.</p>
              <button
                type="button"
                onClick={() => handleApplyPreset("mariscos")}
                className="px-4 py-2 rounded-xl bg-lime-500 text-slate-950 font-bold text-xs"
              >
                Cargar Plantilla de Mariscos
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Botón de Guardar Cambios Flotante / Inferior */}
      <div className="flex justify-end pt-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 px-8 py-3.5 rounded-2xl bg-gradient-to-r from-lime-400 via-lime-500 to-amber-500 hover:brightness-110 text-slate-950 font-black text-sm shadow-xl shadow-lime-500/20 transition-all disabled:opacity-50 cursor-pointer active:scale-95"
        >
          {saving ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" /> Guardando...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" /> Guardar Todo el Inventario
            </>
          )}
        </button>
      </div>
    </div>
  );
}
