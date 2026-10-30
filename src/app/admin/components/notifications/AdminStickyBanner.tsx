"use client";

import React from "react";
import {
  AlertTriangle,
  AlertOctagon,
  Wrench,
  Sparkles,
  Info,
  TrendingUp,
  X,
  ExternalLink,
  ArrowRight,
} from "lucide-react";
import { CleanInAppNotification } from "@/lib/notifications";

interface AdminStickyBannerProps {
  notification: CleanInAppNotification;
  onDismiss: (id: string) => void;
  onActionClick?: (notification: CleanInAppNotification) => void;
}

export function AdminStickyBanner({
  notification,
  onDismiss,
  onActionClick,
}: AdminStickyBannerProps) {
  // Configuración visual según el tipo de alerta
  const getStyleConfig = () => {
    switch (notification.type) {
      case "WARNING_EXPIRING":
        return {
          containerClass:
            "bg-gradient-to-r from-amber-950/90 via-slate-900/95 to-slate-900/95 border-amber-500/50 text-amber-200 shadow-amber-950/40",
          badgeClass: "bg-amber-500/20 text-amber-300 border-amber-500/40",
          iconColor: "text-amber-400",
          badgeLabel: "Plan por Vencer",
          icon: AlertTriangle,
        };
      case "SUSPENDED":
        return {
          containerClass:
            "bg-gradient-to-r from-red-950/90 via-slate-900/95 to-slate-900/95 border-red-500/50 text-red-200 shadow-red-950/40",
          badgeClass: "bg-red-500/20 text-red-300 border-red-500/40",
          iconColor: "text-red-400 animate-pulse",
          badgeLabel: "Servicio Suspendido",
          icon: AlertOctagon,
        };
      case "MAINTENANCE":
        return {
          containerClass:
            "bg-gradient-to-r from-indigo-950/90 via-slate-900/95 to-slate-900/95 border-indigo-500/50 text-indigo-200 shadow-indigo-950/40",
          badgeClass: "bg-indigo-500/20 text-indigo-300 border-indigo-500/40",
          iconColor: "text-indigo-400",
          badgeLabel: "Mantenimiento Plataforma",
          icon: Wrench,
        };
      case "METRIC_SUMMARY":
        return {
          containerClass:
            "bg-gradient-to-r from-emerald-950/90 via-slate-900/95 to-slate-900/95 border-emerald-500/50 text-emerald-200 shadow-emerald-950/40",
          badgeClass: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
          iconColor: "text-emerald-400",
          badgeLabel: "Resumen Semanal",
          icon: TrendingUp,
        };
      case "PROMO":
        return {
          containerClass:
            "bg-gradient-to-r from-purple-950/90 via-slate-900/95 to-slate-900/95 border-purple-500/50 text-purple-200 shadow-purple-950/40",
          badgeClass: "bg-purple-500/20 text-purple-300 border-purple-500/40",
          iconColor: "text-purple-400",
          badgeLabel: "Novedad / Promoción",
          icon: Sparkles,
        };
      case "INFO":
      default:
        return {
          containerClass:
            "bg-gradient-to-r from-cyan-950/90 via-slate-900/95 to-slate-900/95 border-cyan-500/50 text-cyan-200 shadow-cyan-950/40",
          badgeClass: "bg-cyan-500/20 text-cyan-300 border-cyan-500/40",
          iconColor: "text-cyan-400",
          badgeLabel: "Comunicado Oficial",
          icon: Info,
        };
    }
  };

  const style = getStyleConfig();
  const IconComponent = style.icon;

  const handleAction = () => {
    if (onActionClick) {
      onActionClick(notification);
    }
  };

  return (
    <div
      role="alert"
      className={`w-full border-b backdrop-blur-md px-4 py-3 sm:py-3.5 transition-all duration-300 shadow-lg relative z-40 ${style.containerClass}`}
    >
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs sm:text-sm">
        {/* Lado izquierdo: Icono, Badge y Texto */}
        <div className="flex items-start sm:items-center gap-3 min-w-0">
          <div className="p-2 rounded-xl bg-black/30 border border-white/10 shrink-0 mt-0.5 sm:mt-0">
            <IconComponent className={`w-4 h-4 sm:w-5 sm:h-5 ${style.iconColor}`} />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <span
                className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border tracking-wider ${style.badgeClass}`}
              >
                {style.badgeLabel}
              </span>

              {notification.priority === "URGENT" && (
                <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/40 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400"></span>
                  Urgente
                </span>
              )}

              <span className="font-extrabold text-white text-xs sm:text-sm truncate">
                {notification.title}
              </span>
            </div>

            <p className="text-slate-300 text-xs sm:text-sm leading-relaxed line-clamp-2 sm:line-clamp-1">
              {notification.message}
            </p>
          </div>
        </div>

        {/* Lado derecho: Botón de Acción y Descarte */}
        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center pl-10 sm:pl-0">
          {notification.type === "METRIC_SUMMARY" ? (
            <button
              type="button"
              onClick={handleAction}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition shadow-md cursor-pointer"
            >
              <span>Ver Reporte</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : notification.actionUrl ? (
            <a
              href={notification.actionUrl}
              onClick={handleAction}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white font-bold text-xs transition shadow-md border border-white/20"
            >
              <span>{notification.actionLabel || "Conocer más"}</span>
              <ExternalLink className="w-3 h-3 text-white/80" />
            </a>
          ) : null}

          {/* Botón de Descarte (X) */}
          <button
            type="button"
            onClick={() => onDismiss(notification.id)}
            className="p-1.5 rounded-xl hover:bg-white/10 text-white/70 hover:text-white transition cursor-pointer"
            title="Cerrar aviso"
            aria-label="Cerrar aviso"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
