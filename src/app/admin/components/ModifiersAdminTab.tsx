"use client";

import React, { useState, useEffect, useTransition } from "react";
import {
  SlidersHorizontal,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Layers,
  UtensilsCrossed,
  Sparkles,
  Info,
  DollarSign,
} from "lucide-react";
import {
  getDishModifierGroupsAction,
  createModifierGroupAction,
  deleteModifierGroupAction,
  createModifierOptionAction,
  deleteModifierOptionAction,
} from "@/lib/modifier-actions";

interface DishOption {
  id: string;
  name: string;
  categoryName: string;
  price: number;
}

interface ModifiersAdminTabProps {
  restaurant: {
    id: string;
    name: string;
    slug: string;
    themeColor?: string;
    categories: Array<{
      id: string;
      name: string;
      dishes: Array<{
        id: string;
        name: string;
        price: number;
        imageUrl?: string | null;
      }>;
    }>;
  };
}

export function ModifiersAdminTab({ restaurant }: ModifiersAdminTabProps) {
  const [selectedDishId, setSelectedDishId] = useState<string>("");
  const [groups, setGroups] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  // New Group Form state
  const [isNewGroupModalOpen, setIsNewGroupModalOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupMin, setNewGroupMin] = useState("0");
  const [newGroupMax, setNewGroupMax] = useState("1");
  const [newGroupRequired, setNewGroupRequired] = useState(false);

  // New Option Form state
  const [activeGroupIdForOption, setActiveGroupIdForOption] = useState<string | null>(null);
  const [newOptionName, setNewOptionName] = useState("");
  const [newOptionPrice, setNewOptionPrice] = useState("0.00");

  // Flatten all dishes
  const allDishes: DishOption[] = React.useMemo(() => {
    const list: DishOption[] = [];
    for (const cat of restaurant.categories || []) {
      for (const d of cat.dishes || []) {
        list.push({
          id: d.id,
          name: d.name,
          categoryName: cat.name,
          price: d.price,
        });
      }
    }
    return list;
  }, [restaurant.categories]);

  // Set default selected dish
  useEffect(() => {
    if (!selectedDishId && allDishes.length > 0) {
      setSelectedDishId(allDishes[0].id);
    }
  }, [allDishes, selectedDishId]);

  // Load modifier groups for selected dish
  const loadGroups = async (dishId: string) => {
    if (!dishId) return;
    setIsLoading(true);
    try {
      const res = await getDishModifierGroupsAction(dishId);
      if (res.success && res.groups) {
        setGroups(res.groups);
      } else {
        setGroups([]);
      }
    } catch (err) {
      console.error("Error loading modifier groups:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedDishId) {
      loadGroups(selectedDishId);
    }
  }, [selectedDishId]);

  const handleCreateGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDishId || !newGroupName.trim()) return;

    startTransition(async () => {
      const res = await createModifierGroupAction(selectedDishId, {
        name: newGroupName.trim(),
        minSelect: parseInt(newGroupMin, 10) || 0,
        maxSelect: parseInt(newGroupMax, 10) || 1,
        isRequired: newGroupRequired,
      });

      if (res.success && res.group) {
        setGroups((prev) => [...prev, res.group]);
        setIsNewGroupModalOpen(false);
        setNewGroupName("");
        setNewGroupMin("0");
        setNewGroupMax("1");
        setNewGroupRequired(false);
      } else {
        alert(res.error || "Error al crear grupo.");
      }
    });
  };

  const handleDeleteGroup = (groupId: string) => {
    if (!confirm("¿Seguro que deseas eliminar este grupo de modificadores y todas sus opciones?")) {
      return;
    }
    startTransition(async () => {
      const res = await deleteModifierGroupAction(groupId);
      if (res.success) {
        setGroups((prev) => prev.filter((g) => g.id !== groupId));
      } else {
        alert(res.error || "Error al eliminar grupo.");
      }
    });
  };

  const handleCreateOption = (groupId: string, e: React.FormEvent) => {
    e.preventDefault();
    if (!groupId || !newOptionName.trim()) return;

    const extraPrice = parseFloat(newOptionPrice) || 0;

    startTransition(async () => {
      const res = await createModifierOptionAction(groupId, {
        name: newOptionName.trim(),
        extraPrice,
      });

      if (res.success && res.option) {
        setGroups((prev) =>
          prev.map((g) => {
            if (g.id === groupId) {
              return {
                ...g,
                options: [...(g.options || []), res.option],
              };
            }
            return g;
          })
        );
        setActiveGroupIdForOption(null);
        setNewOptionName("");
        setNewOptionPrice("0.00");
      } else {
        alert(res.error || "Error al agregar opción.");
      }
    });
  };

  const handleDeleteOption = (groupId: string, optionId: string) => {
    startTransition(async () => {
      const res = await deleteModifierOptionAction(optionId);
      if (res.success) {
        setGroups((prev) =>
          prev.map((g) => {
            if (g.id === groupId) {
              return {
                ...g,
                options: (g.options || []).filter((o: any) => o.id !== optionId),
              };
            }
            return g;
          })
        );
      } else {
        alert(res.error || "Error al eliminar opción.");
      }
    });
  };

  const selectedDish = allDishes.find((d) => d.id === selectedDishId);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold uppercase tracking-wider mb-2">
            <SlidersHorizontal className="w-3.5 h-3.5" /> Modificadores Gastronómicos
          </div>
          <h2 className="text-2xl font-black text-white">Opciones, Términos y Extras</h2>
          <p className="text-slate-400 text-xs mt-1">
            Personaliza términos de cocción (término medio, bien cocido), salsas, tipos de queso o guarniciones adicionales con costo extra.
          </p>
        </div>

        {selectedDishId && (
          <button
            type="button"
            onClick={() => setIsNewGroupModalOpen(true)}
            className="px-5 py-3 rounded-2xl bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-bold text-sm transition shadow-lg shadow-red-600/20 flex items-center justify-center gap-2 cursor-pointer self-start md:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Grupo para {selectedDish?.name ? `"${selectedDish.name.slice(0, 16)}..."` : "este plato"}</span>
          </button>
        )}
      </div>

      {/* Selector de Plato */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
          Seleccionar Plato o Bebida de la Carta:
        </label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <select
            value={selectedDishId}
            onChange={(e) => setSelectedDishId(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 focus:border-red-500 px-4 py-3 rounded-2xl text-white font-medium text-sm focus:outline-none"
          >
            {allDishes.map((d) => (
              <option key={d.id} value={d.id}>
                [{d.categoryName}] {d.name} (${d.price.toFixed(2)})
              </option>
            ))}
          </select>

          {selectedDish && (
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-950 border border-slate-800 text-xs">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center font-bold shrink-0">
                <UtensilsCrossed className="w-5 h-5" />
              </div>
              <div className="truncate">
                <p className="font-bold text-white truncate">{selectedDish.name}</p>
                <p className="text-slate-400">
                  {selectedDish.categoryName} • Base:{" "}
                  <strong className="text-emerald-400">${selectedDish.price.toFixed(2)}</strong>
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Lista de Grupos de Modificadores */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="p-12 text-center text-slate-400">Cargando modificadores...</div>
        ) : groups.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-10 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
              <Layers className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-white text-base">Este plato no tiene modificadores aún</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Puedes agregar grupos como &quot;Término de la carne&quot; (obligatorio, máx 1), &quot;Tipo de Queso&quot; o &quot;Ingredientes Extra (+costo)&quot;.
            </p>
            <button
              type="button"
              onClick={() => setIsNewGroupModalOpen(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs transition"
            >
              <Plus className="w-4 h-4" /> Crear Primer Grupo
            </button>
          </div>
        ) : (
          groups.map((group) => (
            <div
              key={group.id}
              className="bg-slate-900 border border-slate-800 rounded-3xl p-5 md:p-6 shadow-xl space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-black text-white text-base">{group.name}</h4>
                  {group.isRequired ? (
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/30">
                      Obligatorio (Min: {group.minSelect})
                    </span>
                  ) : (
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                      Opcional
                    </span>
                  )}
                  <span className="text-[10px] text-slate-400">
                    Máx selecciones: <strong>{group.maxSelect}</strong>
                  </span>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setActiveGroupIdForOption(group.id)}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5 text-amber-400" />
                    <span>Agregar Opción</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteGroup(group.id)}
                    className="p-1.5 text-slate-500 hover:text-rose-400 transition rounded-xl hover:bg-rose-500/10"
                    title="Eliminar grupo"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Opciones del grupo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {(group.options || []).map((opt: any) => (
                  <div
                    key={opt.id}
                    className="p-3 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-2"
                  >
                    <div>
                      <p className="font-bold text-white text-xs">{opt.name}</p>
                      <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                        {opt.extraPrice > 0 ? (
                          <span className="text-emerald-400 font-bold">+${opt.extraPrice.toFixed(2)}</span>
                        ) : (
                          <span className="text-slate-500">Sin costo extra</span>
                        )}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteOption(group.id, opt.id)}
                      className="text-slate-600 hover:text-rose-400 transition p-1"
                      title="Eliminar opción"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Formulario Inline para agregar opción a este grupo */}
              {activeGroupIdForOption === group.id && (
                <form
                  onSubmit={(e) => handleCreateOption(group.id, e)}
                  className="p-4 rounded-2xl bg-slate-950/80 border border-amber-500/30 space-y-3 animate-fadeIn"
                >
                  <p className="text-xs font-bold text-amber-400 uppercase">Nueva opción para {group.name}:</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="sm:col-span-2">
                      <input
                        type="text"
                        autoFocus
                        value={newOptionName}
                        onChange={(e) => setNewOptionName(e.target.value)}
                        placeholder="Ej: Término Medio, Salsa Tártara, Doble Carne..."
                        required
                        className="w-full bg-slate-900 border border-slate-800 focus:border-amber-500 px-3 py-2 rounded-xl text-white text-xs focus:outline-none"
                      />
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-slate-500 font-bold text-xs">$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={newOptionPrice}
                        onChange={(e) => setNewOptionPrice(e.target.value)}
                        placeholder="0.00"
                        className="w-full bg-slate-900 border border-slate-800 focus:border-amber-500 pl-7 pr-3 py-2 rounded-xl text-white font-bold text-xs focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveGroupIdForOption(null);
                        setNewOptionName("");
                      }}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={isPending || !newOptionName.trim()}
                      className="px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition"
                    >
                      {isPending ? "Guardando..." : "Guardar Opción"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          ))
        )}
      </div>

      {/* Modal para Crear Nuevo Grupo */}
      {isNewGroupModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-slate-800 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-red-400 flex items-center gap-1.5">
                <SlidersHorizontal className="w-4 h-4" /> Nuevo Grupo de Modificadores
              </span>
              <button
                type="button"
                onClick={() => setIsNewGroupModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Crea un grupo de elección para el plato <strong>{selectedDish?.name}</strong>.
            </p>

            <form onSubmit={handleCreateGroup} className="space-y-4">
              <div>
                <label className="text-[11px] font-bold text-slate-300 uppercase block mb-1">
                  Nombre del Grupo *
                </label>
                <input
                  type="text"
                  autoFocus
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="Ej: Término de Cocción, Tipo de Salsa, Guarnición..."
                  required
                  className="w-full bg-slate-950 border border-slate-800 focus:border-red-500 px-4 py-2.5 rounded-xl text-white text-xs focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-300 uppercase block mb-1">
                    Mínimo a Seleccionar
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={newGroupMin}
                    onChange={(e) => {
                      const v = e.target.value;
                      setNewGroupMin(v);
                      if (parseInt(v, 10) > 0) {
                        setNewGroupRequired(true);
                      }
                    }}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-red-500 px-4 py-2.5 rounded-xl text-white text-xs focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-300 uppercase block mb-1">
                    Máximo a Seleccionar
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={newGroupMax}
                    onChange={(e) => setNewGroupMax(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-red-500 px-4 py-2.5 rounded-xl text-white text-xs focus:outline-none"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={newGroupRequired}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setNewGroupRequired(checked);
                    if (checked && parseInt(newGroupMin, 10) === 0) {
                      setNewGroupMin("1");
                    }
                  }}
                  className="w-4 h-4 rounded text-red-600 bg-slate-950 border-slate-800"
                />
                <span className="text-xs text-slate-300 font-medium">
                  Obligatorio (El comensal debe elegir al menos una opción)
                </span>
              </label>

              <button
                type="submit"
                disabled={isPending || !newGroupName.trim()}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-bold text-sm transition shadow-lg shadow-red-600/20 disabled:opacity-50"
              >
                {isPending ? "Creando..." : "Crear Grupo"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

