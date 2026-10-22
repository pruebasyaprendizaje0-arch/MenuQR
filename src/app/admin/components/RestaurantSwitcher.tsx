"use client";

import React, { useState, useTransition } from "react";
import { switchActiveRestaurantAction } from "@/lib/actions";
import { Store, ChevronDown, Check, Loader2 } from "lucide-react";

interface RestaurantOption {
  id: string;
  name: string;
  slug: string;
  businessType?: string | null;
  logoUrl?: string | null;
}

interface RestaurantSwitcherProps {
  currentRestaurantId: string;
  restaurants: RestaurantOption[];
}

export function RestaurantSwitcher({ currentRestaurantId, restaurants }: RestaurantSwitcherProps) {
  const [isPending, startTransition] = useTransition();
  const [isOpen, setIsOpen] = useState(false);

  if (!restaurants || restaurants.length <= 1) {
    return null;
  }

  const current = restaurants.find((r) => r.id === currentRestaurantId) || restaurants[0];

  const handleSelect = (restaurantId: string) => {
    if (restaurantId === current.id) {
      setIsOpen(false);
      return;
    }

    startTransition(async () => {
      const res = await switchActiveRestaurantAction(restaurantId);
      if (res?.error) {
        alert(res.error);
      } else {
        window.location.reload();
      }
      setIsOpen(false);
    });
  };

  return (
    <div className="relative inline-block text-left z-30">
      <button
        type="button"
        disabled={isPending}
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-750 text-slate-200 border border-slate-700/80 text-xs font-semibold shadow-sm transition disabled:opacity-60"
        title="Cambiar de negocio activo"
      >
        {isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-400" />
        ) : (
          <Store className="h-3.5 w-3.5 text-amber-400 shrink-0" />
        )}
        <span className="max-w-[130px] sm:max-w-[180px] truncate">{current.name}</span>
        <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-slate-900/80 text-amber-300 border border-slate-700">
          {restaurants.length} negocios
        </span>
        <ChevronDown className="h-3 w-3 text-slate-400" />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-1.5 w-64 origin-top-right rounded-2xl bg-slate-900 border border-slate-700/80 shadow-2xl p-1.5 space-y-1 z-40">
            <div className="px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 border-b border-slate-800">
              Mis Negocios Registrados
            </div>
            {restaurants.map((r) => {
              const isSelected = r.id === current.id;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => handleSelect(r.id)}
                  className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl text-xs text-left transition ${
                    isSelected
                      ? "bg-amber-500/15 text-amber-300 font-bold border border-amber-500/30"
                      : "text-slate-300 hover:text-white hover:bg-slate-800"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {r.logoUrl ? (
                      <img src={r.logoUrl} alt={r.name} className="h-5 w-5 rounded-lg object-cover shrink-0" />
                    ) : (
                      <div className="h-5 w-5 rounded-lg bg-slate-800 text-[10px] font-black flex items-center justify-center text-slate-300 uppercase shrink-0">
                        {r.name.charAt(0)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="truncate leading-tight">{r.name}</div>
                      <div className="text-[10px] text-slate-400 font-normal truncate">/{r.slug}</div>
                    </div>
                  </div>
                  {isSelected && <Check className="h-3.5 w-3.5 text-amber-400 shrink-0" />}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
