"use client";

import React from "react";
import {
  TrendingUp,
  DollarSign,
  ShoppingBag,
  Award,
  UtensilsCrossed,
  X,
  CheckCircle2,
  Calendar,
  Sparkles,
} from "lucide-react";
import { CleanInAppNotification } from "@/lib/notifications";

interface AdminWeeklyMetricsModalProps {
  notification: CleanInAppNotification;
  onClose: () => void;
  onMarkAsRead: (id: string) => void;
}

export function AdminWeeklyMetricsModal({
  notification,
  onClose,
  onMarkAsRead,
}: AdminWeeklyMetricsModalProps) {
  const metadata = notification.metadata || {};

  const period = metadata.period || {
    formattedRange: "Semana Anterior",
    weekNumber: 1,
    year: new Date().getFullYear(),
  };

  const financials = metadata.financials || {
    totalRevenue: 0,
    totalOrders: 0,
    averageTicket: 0,
  };

  const topDish = metadata.topDish || null;
  const topTable = metadata.topTable || null;

  const channelDistribution = metadata.channelDistribution || {
    dineIn: { count: 0, percentage: 0, revenue: 0 },
    takeout: { count: 0, percentage: 0, revenue: 0 },
    delivery: { count: 0, percentage: 0, revenue: 0 },
  };

  const handleAcknowledge = () => {
    onMarkAsRead(notification.id);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto animate-fadeIn"
    >
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-8">
        {/* Cabecera con resplandor esmeralda */}
        <div className="relative p-6 sm:p-8 bg-gradient-to-r from-emerald-500/20 via-cyan-500/10 to-transparent border-b border-slate-800/80">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400">
                <TrendingUp className="w-6 h-6" />
              </div>
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 mb-1">
                  <Sparkles className="w-3 h-3 text-amber-300" />
                  <span>Reporte Automatizado</span>
                </div>
                <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  Resumen Semanal de Operaciones
                </h3>
                <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>Período: {period.formattedRange || "Semana cerrada"}</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              title="Cerrar modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Contenido Principal */}
        <div className="p-6 sm:p-8 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Card 1: KPIs Financieros Principales */}
          <div className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800/80">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center sm:text-left divide-y sm:divide-y-0 sm:divide-x divide-slate-800">
              <div className="sm:pr-4">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Facturación Semanal
                </span>
                <span className="text-2xl sm:text-3xl font-black text-emerald-400 tracking-tight mt-1 block">
                  ${Number(financials.totalRevenue || 0).toFixed(2)}
                </span>
                <span className="text-[11px] text-slate-400">Sin incluir cancelaciones</span>
              </div>

              <div className="pt-3 sm:pt-0 sm:px-4">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Pedidos Atendidos
                </span>
                <span className="text-2xl sm:text-3xl font-black text-white tracking-tight mt-1 block">
                  {financials.totalOrders || 0}
                </span>
                <span className="text-[11px] text-slate-400">Órdenes completadas</span>
              </div>

              <div className="pt-3 sm:pt-0 sm:pl-4">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Ticket Promedio
                </span>
                <span className="text-2xl sm:text-3xl font-black text-cyan-400 tracking-tight mt-1 block">
                  ${Number(financials.averageTicket || 0).toFixed(2)}
                </span>
                <span className="text-[11px] text-slate-400">Gasto medio por cliente</span>
              </div>
            </div>
          </div>

          {/* Cards Secundarias: Plato Estrella y Mesa Líder */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Plato Estrella */}
            <div className="p-4 rounded-2xl bg-slate-950/40 border border-slate-800/80 flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 shrink-0">
                <Award className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">
                  Plato Estrella ⭐
                </span>
                <h4 className="text-sm font-bold text-white truncate mt-0.5">
                  {topDish ? topDish.name : "Sin ventas registradas"}
                </h4>
                {topDish ? (
                  <p className="text-xs text-slate-400 mt-0.5">
                    <strong>{topDish.quantitySold}</strong> unid. vendidas · Recaudó{" "}
                    <strong className="text-emerald-400">${Number(topDish.revenue || 0).toFixed(2)}</strong>
                  </p>
                ) : (
                  <p className="text-xs text-slate-400 mt-0.5">Esperando primeros pedidos</p>
                )}
              </div>
            </div>

            {/* Mesa Más Concurrida */}
            <div className="p-4 rounded-2xl bg-slate-950/40 border border-slate-800/80 flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 shrink-0">
                <UtensilsCrossed className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider block">
                  Mesa Más Activa 🪑
                </span>
                <h4 className="text-sm font-bold text-white truncate mt-0.5">
                  {topTable ? topTable.name : "Sin pedidos en mesa"}
                </h4>
                {topTable ? (
                  <p className="text-xs text-slate-400 mt-0.5">
                    <strong>{topTable.orderCount}</strong> pedidos registrados en el salón
                  </p>
                ) : (
                  <p className="text-xs text-slate-400 mt-0.5">Pedidos recibidos solo por delivery/retiro</p>
                )}
              </div>
            </div>
          </div>

          {/* Desglose de Canales (Salón vs Retiro vs Domicilio) */}
          <div className="p-5 rounded-2xl bg-slate-950/40 border border-slate-800/80 space-y-3">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <ShoppingBag className="w-3.5 h-3.5 text-slate-400" />
              <span>Distribución por Canal de Venta</span>
            </h4>

            <div className="space-y-3 text-xs">
              {/* Salón */}
              <div>
                <div className="flex justify-between items-center mb-1 text-slate-300">
                  <span className="font-semibold flex items-center gap-1.5">
                    <span>🪑</span> Salón / En Mesa
                  </span>
                  <span className="font-mono text-slate-400">
                    {channelDistribution.dineIn?.count || 0} pedidos (
                    {channelDistribution.dineIn?.percentage || 0}%) · $
                    {Number(channelDistribution.dineIn?.revenue || 0).toFixed(2)}
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                    style={{ width: `${channelDistribution.dineIn?.percentage || 0}%` }}
                  />
                </div>
              </div>

              {/* Para Llevar */}
              <div>
                <div className="flex justify-between items-center mb-1 text-slate-300">
                  <span className="font-semibold flex items-center gap-1.5">
                    <span>🛍️</span> Para Llevar / Retiro
                  </span>
                  <span className="font-mono text-slate-400">
                    {channelDistribution.takeout?.count || 0} pedidos (
                    {channelDistribution.takeout?.percentage || 0}%) · $
                    {Number(channelDistribution.takeout?.revenue || 0).toFixed(2)}
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-purple-500 rounded-full transition-all duration-500"
                    style={{ width: `${channelDistribution.takeout?.percentage || 0}%` }}
                  />
                </div>
              </div>

              {/* Domicilio */}
              <div>
                <div className="flex justify-between items-center mb-1 text-slate-300">
                  <span className="font-semibold flex items-center gap-1.5">
                    <span>🛵</span> A Domicilio (Delivery)
                  </span>
                  <span className="font-mono text-slate-400">
                    {channelDistribution.delivery?.count || 0} pedidos (
                    {channelDistribution.delivery?.percentage || 0}%) · $
                    {Number(channelDistribution.delivery?.revenue || 0).toFixed(2)}
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-sky-500 rounded-full transition-all duration-500"
                    style={{ width: `${channelDistribution.delivery?.percentage || 0}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer con Botón de Confirmación */}
        <div className="p-4 sm:p-6 bg-slate-950/80 border-t border-slate-800 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={handleAcknowledge}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-sm transition shadow-lg shadow-emerald-950/50 flex items-center justify-center gap-2 cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Entendido / Continuar a mi Panel</span>
          </button>
        </div>
      </div>
    </div>
  );
}
