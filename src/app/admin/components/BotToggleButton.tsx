"use client";

import { useState, useTransition } from "react";
import { Bot, BotOff, Loader2 } from "lucide-react";

interface BotToggleButtonProps {
  restaurantId: string;
  restaurantName?: string;
  initialState: boolean;
  onToggle?: (newState: boolean) => void;
  compact?: boolean;
}

export function BotToggleButton({
  restaurantId,
  restaurantName,
  initialState,
  onToggle,
  compact = false,
}: BotToggleButtonProps) {
  const [enabled, setEnabled] = useState<boolean>(initialState);
  const [loading, setLoading] = useState<boolean>(false);
  const [isPending, startTransition] = useTransition();

  const handleToggle = async () => {
    if (loading || isPending) return;

    const nextState = !enabled;
    const previousState = enabled;

    // Actualización optimista de la interfaz
    setEnabled(nextState);
    setLoading(true);

    try {
      const response = await fetch("/api/superadmin/restaurant/toggle-bot", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          restaurantId,
          enabled: nextState,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "No se pudo actualizar el estado del bot.");
      }

      // Notificar al componente padre si existe callback
      if (onToggle) {
        onToggle(data.enabled);
      }
    } catch (err: any) {
      console.error(`[BotToggleButton] Error al cambiar estado para ${restaurantName || restaurantId}:`, err);
      // Revertir estado si la petición falló
      setEnabled(previousState);
      alert(`Error al actualizar el bot de WhatsApp: ${err.message || "Error desconocido"}`);
    } finally {
      setLoading(false);
    }
  };

  const isBusy = loading || isPending;

  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${compact ? "text-xs" : "text-sm"}`}>
      {/* Botón Switch Accesible y Estilizado */}
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        disabled={isBusy}
        onClick={handleToggle}
        title={
          enabled
            ? `Pausar Bot para ${restaurantName || "este restaurante"}`
            : `Activar Bot para ${restaurantName || "este restaurante"}`
        }
        className={`
          relative inline-flex flex-shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-slate-900
          ${compact ? "h-5 w-9 p-0.5" : "h-6 w-11 p-0.5"}
          ${enabled ? "bg-emerald-600 shadow-sm shadow-emerald-500/30" : "bg-slate-700 hover:bg-slate-600"}
          ${isBusy ? "opacity-60 cursor-not-allowed" : ""}
        `}
      >
        <span className="sr-only">
          {enabled ? "Desactivar Bot de WhatsApp" : "Activar Bot de WhatsApp"}
        </span>

        {/* Thumb Circular con Transición */}
        <span
          className={`
            pointer-events-none flex items-center justify-center rounded-full bg-white shadow-md transform ring-0 transition duration-200 ease-in-out
            ${compact ? "h-4 w-4" : "h-5 w-5"}
            ${enabled ? (compact ? "translate-x-4" : "translate-x-5") : "translate-x-0"}
          `}
        >
          {isBusy ? (
            <Loader2 className={`animate-spin text-emerald-600 ${compact ? "w-2.5 h-2.5" : "w-3 h-3"}`} />
          ) : enabled ? (
            <Bot className={`text-emerald-600 ${compact ? "w-2.5 h-2.5" : "w-3 h-3"}`} />
          ) : (
            <BotOff className={`text-slate-400 ${compact ? "w-2.5 h-2.5" : "w-3 h-3"}`} />
          )}
        </span>
      </button>

      {/* Badge / Etiqueta Descriptiva */}
      {!compact && (
        <span
          className={`font-medium transition-colors duration-150 flex items-center gap-1.5 ${
            enabled ? "text-emerald-400" : "text-slate-400"
          }`}
        >
          {enabled ? (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Bot Activo
            </>
          ) : (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
              Bot en Pausa
            </>
          )}
        </span>
      )}
    </div>
  );
}
