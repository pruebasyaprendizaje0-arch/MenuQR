"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Bell,
  CheckCheck,
  AlertTriangle,
  AlertOctagon,
  Wrench,
  Sparkles,
  TrendingUp,
  Info,
  ExternalLink,
  Clock,
  X,
} from "lucide-react";
import { CleanInAppNotification } from "@/lib/notifications";
import { useNotifications } from "./AdminNotificationHost";

function formatTimeAgo(isoDate: string): string {
  try {
    const diffMs = Date.now() - new Date(isoDate).getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) return "hace un momento";
    if (diffMin < 60) return `hace ${diffMin} min`;
    if (diffHour < 24) return `hace ${diffHour} h`;
    if (diffDay === 1) return "ayer";
    if (diffDay < 7) return `hace ${diffDay} días`;
    return new Date(isoDate).toLocaleDateString();
  } catch {
    return "";
  }
}

export function AdminNotificationBell() {
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    openMetricsModal,
  } = useNotifications();

  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [mobileCoords, setMobileCoords] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);

  // Calcular posición adaptativa y confinamiento seguro para pantallas móviles
  useEffect(() => {
    function updatePosition() {
      if (!isOpen || !buttonRef.current) return;
      if (typeof window === "undefined") return;

      const isMobile = window.innerWidth < 640;
      if (!isMobile) {
        setMobileCoords(null);
        return;
      }

      const rect = buttonRef.current.getBoundingClientRect();
      const screenWidth = window.innerWidth;
      const screenHeight = window.innerHeight;
      const padding = 12; // 12px de margen con los bordes de la pantalla
      const targetWidth = Math.min(380, screenWidth - padding * 2);

      // Centrar el popover respecto al botón si es posible, clamp entre padding y screenWidth - padding - targetWidth
      let left = rect.left + rect.width / 2 - targetWidth / 2;
      left = Math.max(padding, Math.min(left, screenWidth - padding - targetWidth));

      // Posición vertical: justo debajo del botón
      const top = Math.min(rect.bottom + 8, screenHeight - 140);
      const maxHeight = Math.max(220, screenHeight - top - 24);

      setMobileCoords({
        top,
        left,
        width: targetWidth,
        maxHeight,
      });
    }

    if (isOpen) {
      updatePosition();
      window.addEventListener("resize", updatePosition);
      window.addEventListener("scroll", updatePosition, true);
    }

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isOpen]);

  // Cerrar al hacer clic fuera o presionar Escape
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const getNotificationIcon = (type: CleanInAppNotification["type"]) => {
    switch (type) {
      case "WARNING_EXPIRING":
        return <AlertTriangle className="w-4 h-4 text-amber-400" />;
      case "SUSPENDED":
        return <AlertOctagon className="w-4 h-4 text-red-400" />;
      case "MAINTENANCE":
        return <Wrench className="w-4 h-4 text-indigo-400" />;
      case "METRIC_SUMMARY":
        return <TrendingUp className="w-4 h-4 text-emerald-400" />;
      case "PROMO":
        return <Sparkles className="w-4 h-4 text-purple-400" />;
      case "INFO":
      default:
        return <Info className="w-4 h-4 text-cyan-400" />;
    }
  };

  const handleItemClick = (notif: CleanInAppNotification) => {
    if (!notif.isRead) {
      markAsRead(notif.id);
    }
    if (notif.type === "METRIC_SUMMARY") {
      openMetricsModal(notif);
      setIsOpen(false);
    }
  };

  return (
    <div className="relative" ref={popoverRef}>
      {/* Botón de Campana */}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition cursor-pointer flex items-center justify-center"
        aria-label="Abrir centro de notificaciones"
        title="Notificaciones y Anuncios In-App"
      >
        <Bell className="w-4 h-4" />

        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-red-500 text-[10px] font-black text-white shadow-md animate-pulse">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Menú Desplegable (Popover) */}
      {isOpen && (
        <>
          {/* Telón de fondo oscuro para móvil (cierra al tocar fuera de la ventana) */}
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 sm:hidden"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />

          <div
            style={
              mobileCoords
                ? {
                    top: `${mobileCoords.top}px`,
                    left: `${mobileCoords.left}px`,
                    width: `${mobileCoords.width}px`,
                    maxHeight: `${mobileCoords.maxHeight}px`,
                  }
                : undefined
            }
            className={`
              rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl z-[60] overflow-hidden animate-fadeIn text-xs flex flex-col
              ${
                mobileCoords
                  ? "fixed"
                  : "fixed inset-x-3 max-w-sm mx-auto sm:max-w-none sm:mx-0 sm:absolute sm:inset-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96"
              }
            `}
          >
            {/* Cabecera del Popover */}
            <div className="p-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60 shrink-0">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-white text-sm">Notificaciones</span>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-red-500/20 border border-red-500/30 text-red-300 text-[10px] font-black">
                    {unreadCount} nuevas
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={() => markAllAsRead()}
                    className="text-[11px] font-bold text-slate-400 hover:text-emerald-400 transition flex items-center gap-1 cursor-pointer"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    <span>Marcar leídas</span>
                  </button>
                )}

                {/* Botón cerrar para vista móvil */}
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition sm:hidden flex items-center justify-center cursor-pointer"
                  aria-label="Cerrar notificaciones"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Lista de Notificaciones */}
            <div className="flex-1 max-h-80 sm:max-h-80 overflow-y-auto divide-y divide-slate-800/80 overscroll-contain">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-slate-400 space-y-1">
                <Bell className="w-6 h-6 mx-auto text-slate-400 mb-2 opacity-50" />
                <p className="font-bold text-white text-xs">Estás al día</p>
                <p className="text-[11px]">No hay notificaciones ni avisos pendientes.</p>
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => handleItemClick(notif)}
                  className={`p-3.5 hover:bg-slate-800/50 transition cursor-pointer flex items-start gap-3 ${
                    !notif.isRead ? "bg-slate-800/20" : ""
                  }`}
                >
                  <div className="p-2 rounded-xl bg-black/40 border border-white/5 shrink-0 mt-0.5">
                    {getNotificationIcon(notif.type)}
                  </div>

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <h4
                        className={`font-extrabold text-xs truncate ${
                          !notif.isRead ? "text-white" : "text-slate-300"
                        }`}
                      >
                        {notif.title}
                      </h4>
                      {!notif.isRead && (
                        <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" title="No leída" />
                      )}
                    </div>

                    <p className="text-slate-400 text-[11px] leading-relaxed line-clamp-2">
                      {notif.message}
                    </p>

                    <div className="flex items-center justify-between gap-2 pt-1">
                      <span className="text-[10px] text-slate-400 flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" />
                        <span>{formatTimeAgo(notif.createdAt)}</span>
                      </span>

                      {notif.type === "METRIC_SUMMARY" ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openMetricsModal(notif);
                            setIsOpen(false);
                          }}
                          className="text-[10px] font-black text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer"
                        >
                          <span>Ver reporte</span>
                          <TrendingUp className="w-3 h-3" />
                        </button>
                      ) : notif.actionUrl ? (
                        <a
                          href={notif.actionUrl}
                          onClick={(e) => e.stopPropagation()}
                          className="text-[10px] font-bold text-slate-300 hover:text-white flex items-center gap-1"
                        >
                          <span>{notif.actionLabel || "Abrir"}</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </>
    )}
  </div>
);
}
