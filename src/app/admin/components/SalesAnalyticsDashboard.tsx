"use client";

import React, { useState, useMemo } from "react";
import {
  Calendar,
  TrendingUp,
  DollarSign,
  ShoppingBag,
  CreditCard,
  Banknote,
  Smartphone,
  Landmark,
  Download,
  FileSpreadsheet,
  Clock,
  Sparkles,
  ChevronRight,
  Filter,
  CheckCircle2,
  BarChart3,
  ArrowUpRight,
  HelpCircle,
} from "lucide-react";
import * as XLSX from "xlsx";

export interface AnalyticsOrder {
  id: string;
  orderNumber?: number;
  total: number;
  tableName: string;
  customerName?: string | null;
  paymentMethod?: string | null;
  status: string;
  createdAt: string | Date;
  isTest?: boolean;
}

interface SalesAnalyticsDashboardProps {
  orders: AnalyticsOrder[];
  metricViewMode: "REAL" | "TEST" | "ALL";
  restaurantName: string;
  restaurantSlug: string;
  currencySymbol?: string;
  stockUnitPlural?: string;
}

type DatePreset =
  | "TODAY"
  | "YESTERDAY"
  | "LAST_7"
  | "LAST_30"
  | "THIS_MONTH"
  | "PREV_MONTH"
  | "ALL"
  | "CUSTOM";

export function SalesAnalyticsDashboard({
  orders,
  metricViewMode,
  restaurantName,
  restaurantSlug,
  currencySymbol = "$",
  stockUnitPlural = "platos",
}: SalesAnalyticsDashboardProps) {
  const [datePreset, setDatePreset] = useState<DatePreset>("LAST_7");
  const [hoveredDayIndex, setHoveredDayIndex] = useState<number | null>(null);

  // Formato YYYY-MM-DD local
  const formatLocalDate = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const todayStr = useMemo(() => formatLocalDate(new Date()), []);
  const [customStartDate, setCustomStartDate] = useState(todayStr);
  const [customEndDate, setCustomEndDate] = useState(todayStr);

  // Calcular fechas de inicio y fin según preset
  const { startDate, endDate, dateRangeLabel } = useMemo(() => {
    const now = new Date();
    let start = new Date();
    let end = new Date();
    let label = "";

    switch (datePreset) {
      case "TODAY":
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        label = "Hoy";
        break;
      case "YESTERDAY": {
        const yest = new Date(now);
        yest.setDate(yest.getDate() - 1);
        start = new Date(yest.getFullYear(), yest.getMonth(), yest.getDate(), 0, 0, 0, 0);
        end = new Date(yest.getFullYear(), yest.getMonth(), yest.getDate(), 23, 59, 59, 999);
        label = "Ayer";
        break;
      }
      case "LAST_7": {
        const s = new Date(now);
        s.setDate(s.getDate() - 6);
        start = new Date(s.getFullYear(), s.getMonth(), s.getDate(), 0, 0, 0, 0);
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        label = "Últimos 7 días";
        break;
      }
      case "LAST_30": {
        const s = new Date(now);
        s.setDate(s.getDate() - 29);
        start = new Date(s.getFullYear(), s.getMonth(), s.getDate(), 0, 0, 0, 0);
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        label = "Últimos 30 días";
        break;
      }
      case "THIS_MONTH":
        start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        label = "Este mes";
        break;
      case "PREV_MONTH":
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
        end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
        label = "Mes anterior";
        break;
      case "ALL":
        start = new Date(2020, 0, 1, 0, 0, 0, 0);
        end = new Date(2035, 11, 31, 23, 59, 59, 999);
        label = "Todo el histórico";
        break;
      case "CUSTOM": {
        const [sy, sm, sd] = (customStartDate || todayStr).split("-").map(Number);
        const [ey, em, ed] = (customEndDate || todayStr).split("-").map(Number);
        start = new Date(sy, sm - 1, sd, 0, 0, 0, 0);
        end = new Date(ey, em - 1, ed, 23, 59, 59, 999);
        label = `${customStartDate} al ${customEndDate}`;
        break;
      }
    }

    return { startDate: start, endDate: end, dateRangeLabel: label };
  }, [datePreset, customStartDate, customEndDate, todayStr]);

  // Filtrado de pedidos según modo (REAL, TEST, ALL), fecha y estado
  const filteredOrders = useMemo(() => {
    return (orders || []).filter((o) => {
      if (metricViewMode === "REAL" && o.isTest) return false;
      if (metricViewMode === "TEST" && !o.isTest) return false;
      if (o.status === "CANCELLED") return false;

      const d = new Date(o.createdAt);
      return d >= startDate && d <= endDate;
    });
  }, [orders, metricViewMode, startDate, endDate]);

  // KPIs del Período
  const periodTotalBilling = useMemo(() => {
    return filteredOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
  }, [filteredOrders]);

  const periodOrderCount = filteredOrders.length;
  const periodAverageTicket = periodOrderCount > 0 ? periodTotalBilling / periodOrderCount : 0;

  // Desglose por Método de Pago en el rango
  const paymentBreakdown = useMemo(() => {
    let efectivo = 0;
    let deuna = 0;
    let transferencia = 0;
    let tarjeta = 0;
    let efectivoCount = 0;
    let deunaCount = 0;
    let transfCount = 0;
    let cardCount = 0;

    filteredOrders.forEach((o) => {
      const pm = (o.paymentMethod || "EFECTIVO").toUpperCase();
      const amt = Number(o.total) || 0;

      if (pm.includes("EFECTIVO") || pm === "CASH") {
        efectivo += amt;
        efectivoCount++;
      } else if (pm.includes("DEUNA")) {
        deuna += amt;
        deunaCount++;
      } else if (pm.includes("TRANSFERENCIA") || pm.includes("TRANSFER")) {
        transferencia += amt;
        transfCount++;
      } else {
        tarjeta += amt;
        cardCount++;
      }
    });

    const total = efectivo + deuna + transferencia + tarjeta || 1;

    return {
      efectivo,
      efectivoCount,
      efectivoPct: Math.round((efectivo / total) * 100),
      deuna,
      deunaCount,
      deunaPct: Math.round((deuna / total) * 100),
      transferencia,
      transfCount,
      transfPct: Math.round((transferencia / total) * 100),
      tarjeta,
      cardCount,
      tarjetaPct: Math.round((tarjeta / total) * 100),
    };
  }, [filteredOrders]);

  // Agrupación Diaria para el gráfico y la tabla
  const dailySales = useMemo(() => {
    const map = new Map<
      string,
      {
        dateStr: string;
        dateObj: Date;
        total: number;
        count: number;
        methods: { EFECTIVO: number; DEUNA: number; TRANSFERENCIA: number; TARJETA: number };
      }
    >();

    // Si el rango es <= 31 días y no es ALL, prellenar todos los días intermedios con 0 para continuidad visual
    const diffDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays <= 35 && datePreset !== "ALL") {
      const curr = new Date(startDate);
      while (curr <= endDate) {
        const key = formatLocalDate(curr);
        map.set(key, {
          dateStr: key,
          dateObj: new Date(curr),
          total: 0,
          count: 0,
          methods: { EFECTIVO: 0, DEUNA: 0, TRANSFERENCIA: 0, TARJETA: 0 },
        });
        curr.setDate(curr.getDate() + 1);
      }
    }

    filteredOrders.forEach((o) => {
      const d = new Date(o.createdAt);
      const key = formatLocalDate(d);

      if (!map.has(key)) {
        map.set(key, {
          dateStr: key,
          dateObj: d,
          total: 0,
          count: 0,
          methods: { EFECTIVO: 0, DEUNA: 0, TRANSFERENCIA: 0, TARJETA: 0 },
        });
      }

      const item = map.get(key)!;
      const amt = Number(o.total) || 0;
      item.total += amt;
      item.count += 1;

      const pm = (o.paymentMethod || "EFECTIVO").toUpperCase();
      if (pm.includes("EFECTIVO")) item.methods.EFECTIVO += amt;
      else if (pm.includes("DEUNA")) item.methods.DEUNA += amt;
      else if (pm.includes("TRANSFERENCIA")) item.methods.TRANSFERENCIA += amt;
      else item.methods.TARJETA += amt;
    });

    return Array.from(map.values()).sort((a, b) => a.dateStr.localeCompare(b.dateStr));
  }, [filteredOrders, startDate, endDate, datePreset]);

  // Día Pico (Máxima Venta)
  const maxDay = useMemo(() => {
    if (dailySales.length === 0) return null;
    let max = dailySales[0];
    dailySales.forEach((d) => {
      if (d.total > max.total) max = d;
    });
    return max.total > 0 ? max : null;
  }, [dailySales]);

  const maxDailyTotal = maxDay ? maxDay.total : 1;

  // Detección de hora con mayor afluencia (Horas Pico)
  const peakHourSummary = useMemo(() => {
    const hourMap: { [hour: number]: number } = {};
    filteredOrders.forEach((o) => {
      const h = new Date(o.createdAt).getHours();
      hourMap[h] = (hourMap[h] || 0) + (Number(o.total) || 0);
    });

    let bestHour = -1;
    let bestTotal = 0;
    Object.entries(hourMap).forEach(([h, tot]) => {
      if (tot > bestTotal) {
        bestTotal = tot;
        bestHour = parseInt(h);
      }
    });

    if (bestHour === -1 || bestTotal === 0) return null;

    const startH = bestHour % 12 === 0 ? 12 : bestHour % 12;
    const endH = (bestHour + 1) % 12 === 0 ? 12 : (bestHour + 1) % 12;
    const ampm = bestHour >= 12 ? "PM" : "AM";
    return {
      label: `${startH}:00 - ${endH}:00 ${ampm}`,
      total: bestTotal,
      isLunch: bestHour >= 11 && bestHour <= 15,
      isDinner: bestHour >= 18 && bestHour <= 22,
    };
  }, [filteredOrders]);

  // Exportar reporte contable a Excel (.xlsx)
  const handleExportExcelReport = () => {
    const wb = XLSX.utils.book_new();

    // 1. Hoja de Resumen Diario
    const dailyRows = dailySales
      .filter((d) => d.total > 0 || dailySales.length <= 14)
      .map((d) => {
        const avg = d.count > 0 ? d.total / d.count : 0;
        let topMethod = "Efectivo";
        if (d.methods.DEUNA >= d.methods.EFECTIVO && d.methods.DEUNA >= d.methods.TARJETA) topMethod = "DeUna QR";
        if (d.methods.TARJETA >= d.methods.EFECTIVO && d.methods.TARJETA >= d.methods.DEUNA) topMethod = "Tarjeta / POS";
        if (d.methods.TRANSFERENCIA >= d.methods.EFECTIVO) topMethod = "Transferencia";

        return {
          Fecha: d.dateStr,
          "Facturación ($)": d.total.toFixed(2),
          "N° Pedidos": d.count,
          "Ticket Promedio ($)": avg.toFixed(2),
          "Efectivo ($)": d.methods.EFECTIVO.toFixed(2),
          "DeUna ($)": d.methods.DEUNA.toFixed(2),
          "Transferencia ($)": d.methods.TRANSFERENCIA.toFixed(2),
          "Tarjeta ($)": d.methods.TARJETA.toFixed(2),
          "Método Principal": topMethod,
        };
      });

    const wsDaily = XLSX.utils.json_to_sheet(dailyRows);
    XLSX.utils.book_append_sheet(wb, wsDaily, "Resumen_Diario");

    // 2. Hoja de Detalle de Pedidos
    const detailRows = filteredOrders.map((o) => {
      const d = new Date(o.createdAt);
      return {
        "N° Pedido": o.orderNumber ? `#${o.orderNumber}` : o.id.slice(0, 8),
        Fecha: d.toLocaleDateString(),
        Hora: d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        "Mesa / Canal": o.tableName || "Mostrador",
        Cliente: o.customerName || "Cliente General",
        "Total ($)": Number(o.total || 0).toFixed(2),
        "Forma de Pago": (o.paymentMethod || "Efectivo").toUpperCase(),
        Estado: o.status,
      };
    });

    const wsDetail = XLSX.utils.json_to_sheet(detailRows);
    XLSX.utils.book_append_sheet(wb, wsDetail, "Detalle_Pedidos");

    const fileName = `Ventas_${restaurantSlug}_${formatLocalDate(startDate)}_al_${formatLocalDate(endDate)}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-7 space-y-6 shadow-2xl">
      {/* 1. CABECERA & SELECTOR DE RANGO */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <BarChart3 className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <span>Análisis Histórico de Ventas & Facturación Diaria</span>
              </h3>
              <p className="text-xs text-slate-400">
                Filtra por rangos de fecha, analiza el ticket promedio y las tendencias de cobro de {restaurantName}.
              </p>
            </div>
          </div>
        </div>

        {/* Botón de Exportar Excel */}
        <button
          type="button"
          onClick={handleExportExcelReport}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs transition shadow-lg shadow-emerald-600/20 active:scale-95 shrink-0 cursor-pointer"
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Exportar Reporte (.xlsx)</span>
        </button>
      </div>

      {/* 2. ATRIBUTOS DE PRESET DE FECHA */}
      <div className="space-y-3">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 text-xs font-bold">
          <span className="text-slate-500 text-[11px] uppercase mr-1 hidden sm:inline">Período:</span>
          {[
            { id: "TODAY", label: "Hoy" },
            { id: "YESTERDAY", label: "Ayer" },
            { id: "LAST_7", label: "Últimos 7 Días" },
            { id: "LAST_30", label: "Últimos 30 Días" },
            { id: "THIS_MONTH", label: "Este Mes" },
            { id: "PREV_MONTH", label: "Mes Anterior" },
            { id: "ALL", label: "Todo el Histórico" },
            { id: "CUSTOM", label: "📅 Personalizado" },
          ].map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => setDatePreset(preset.id as DatePreset)}
              className={`px-3 py-1.5 rounded-xl transition whitespace-nowrap ${
                datePreset === preset.id
                  ? "bg-amber-400 text-slate-950 font-black shadow-md scale-102"
                  : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Selector de Fechas Personalizadas (Desde - Hasta) */}
        {datePreset === "CUSTOM" && (
          <div className="flex flex-wrap items-center gap-3 p-3 bg-slate-950 rounded-2xl border border-slate-800 animate-fadeIn text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-bold">Desde:</span>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono text-xs focus:outline-none focus:border-amber-400"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-bold">Hasta:</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono text-xs focus:outline-none focus:border-amber-400"
              />
            </div>
            <span className="text-[11px] text-amber-400 font-medium">
              Mostrando pedidos generados en este rango.
            </span>
          </div>
        )}
      </div>

      {/* 3. TIRILLA DE 4 KPIS CLAVE */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Facturado */}
        <div className="bg-slate-950/70 border border-slate-800 p-4 rounded-2xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-extrabold">
              Facturación del Período
            </span>
            <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
              <DollarSign className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-black text-emerald-400 mt-2">
            {currencySymbol}
            {periodTotalBilling.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <span className="text-[10px] text-slate-500 block mt-1">
            {periodOrderCount} pedidos completados ({dateRangeLabel})
          </span>
        </div>

        {/* N° Pedidos */}
        <div className="bg-slate-950/70 border border-slate-800 p-4 rounded-2xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-extrabold">
              Total de Pedidos
            </span>
            <span className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400">
              <ShoppingBag className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-black text-cyan-300 mt-2">{periodOrderCount}</p>
          <span className="text-[10px] text-slate-500 block mt-1">
            Comandas cerradas sin cancelaciones
          </span>
        </div>

        {/* Ticket Promedio */}
        <div className="bg-slate-950/70 border border-slate-800 p-4 rounded-2xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-extrabold">
              Ticket Promedio (AOV)
            </span>
            <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-black text-amber-300 mt-2">
            {currencySymbol}
            {periodAverageTicket.toFixed(2)}
          </p>
          <span className="text-[10px] text-slate-500 block mt-1">
            Gasto promedio por comensal / mesa
          </span>
        </div>

        {/* Hora / Día Pico */}
        <div className="bg-slate-950/70 border border-slate-800 p-4 rounded-2xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-extrabold">
              Pico de Demanda
            </span>
            <span className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
              <Clock className="w-4 h-4" />
            </span>
          </div>
          {peakHourSummary ? (
            <>
              <p className="text-lg font-black text-indigo-300 mt-2 truncate">
                {peakHourSummary.label}
              </p>
              <span className="text-[10px] text-indigo-400/80 block mt-1">
                Franja más concurrida ({currencySymbol}{peakHourSummary.total.toFixed(2)})
              </span>
            </>
          ) : maxDay ? (
            <>
              <p className="text-lg font-black text-indigo-300 mt-2 truncate">
                {maxDay.dateObj.toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" })}
              </p>
              <span className="text-[10px] text-indigo-400/80 block mt-1">
                Día récord: {currencySymbol}{maxDay.total.toFixed(2)}
              </span>
            </>
          ) : (
            <>
              <p className="text-sm font-bold text-slate-500 mt-2">Sin datos suficientes</p>
              <span className="text-[10px] text-slate-500 block mt-1">Registra más pedidos</span>
            </>
          )}
        </div>
      </div>

      {/* 4. GRÁFICO INTERACTIVO DE BARRAS DE VENTAS DIARIAS */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            <h4 className="font-extrabold text-sm text-white">Evolución Diaria de Facturación</h4>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            {dailySales.length} {dailySales.length === 1 ? "día" : "días"} analizados
          </span>
        </div>

        {dailySales.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-xs">
            No hay registros de ventas en el período seleccionado.
          </div>
        ) : (
          <div className="space-y-2 pt-4">
            {/* Contenedor de Barras */}
            <div className="h-44 flex items-end gap-1.5 sm:gap-2 px-2 border-b border-slate-800 pb-2 relative">
              {dailySales.map((day, idx) => {
                const heightPct = maxDailyTotal > 0 ? Math.max(8, Math.round((day.total / maxDailyTotal) * 100)) : 8;
                const isPeak = maxDay && day.dateStr === maxDay.dateStr && day.total > 0;
                const isHovered = hoveredDayIndex === idx;

                const dayLabel = day.dateObj.toLocaleDateString("es-ES", {
                  weekday: "short",
                  day: "numeric",
                });

                return (
                  <div
                    key={day.dateStr}
                    className="flex-1 flex flex-col items-center justify-end h-full relative group"
                    onMouseEnter={() => setHoveredDayIndex(idx)}
                    onMouseLeave={() => setHoveredDayIndex(null)}
                  >
                    {/* Tooltip flotante al pasar el mouse */}
                    {isHovered && (
                      <div className="absolute -top-14 z-30 bg-slate-900 border border-slate-700 p-2 rounded-xl text-center shadow-xl pointer-events-none whitespace-nowrap animate-fadeIn">
                        <span className="text-[10px] text-slate-400 block font-bold capitalize">
                          {day.dateObj.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "short" })}
                        </span>
                        <strong className="text-xs font-mono text-emerald-400 font-black">
                          {currencySymbol}{day.total.toFixed(2)}
                        </strong>
                        <span className="text-[9px] text-slate-400 block">
                          {day.count} {day.count === 1 ? "pedido" : "pedidos"}
                        </span>
                      </div>
                    )}

                    {/* Badge de Pico en la barra más alta */}
                    {isPeak && (
                      <span className="text-[8px] font-black uppercase tracking-wider text-amber-300 bg-amber-500/20 px-1 py-0.5 rounded border border-amber-500/40 mb-1 animate-pulse">
                        ⭐ Pico
                      </span>
                    )}

                    {/* La barra visual */}
                    <div
                      className={`w-full max-w-[38px] rounded-t-xl transition-all duration-300 ${
                        isPeak
                          ? "bg-gradient-to-t from-amber-600 to-amber-400 shadow-lg shadow-amber-500/20"
                          : day.total > 0
                          ? "bg-gradient-to-t from-emerald-700 to-emerald-400 hover:brightness-125"
                          : "bg-slate-800/50 hover:bg-slate-800"
                      }`}
                      style={{ height: `${heightPct}%` }}
                    />
                  </div>
                );
              })}
            </div>

            {/* Eje X de Días */}
            <div className="flex items-center gap-1.5 sm:gap-2 px-2 text-[10px] text-slate-400 font-mono">
              {dailySales.map((day) => {
                const dayLabel = day.dateObj.toLocaleDateString("es-ES", {
                  weekday: "short",
                  day: "numeric",
                });
                return (
                  <span key={`x-${day.dateStr}`} className="flex-1 text-center truncate capitalize text-[9px] sm:text-[10px]">
                    {dayLabel}
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 5. DESGLOSE POR MÉTODO DE PAGO */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-cyan-400" />
            <h4 className="font-extrabold text-sm text-white">Canales y Métodos de Cobro</h4>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            Total recaudado: {currencySymbol}{periodTotalBilling.toFixed(2)}
          </span>
        </div>

        {/* Barra de progreso multi-color */}
        <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden flex shadow-inner">
          {paymentBreakdown.efectivoPct > 0 && (
            <div
              className="bg-emerald-500 h-full transition-all"
              style={{ width: `${paymentBreakdown.efectivoPct}%` }}
              title={`Efectivo: ${paymentBreakdown.efectivoPct}%`}
            />
          )}
          {paymentBreakdown.deunaPct > 0 && (
            <div
              className="bg-cyan-400 h-full transition-all"
              style={{ width: `${paymentBreakdown.deunaPct}%` }}
              title={`DeUna QR: ${paymentBreakdown.deunaPct}%`}
            />
          )}
          {paymentBreakdown.transfPct > 0 && (
            <div
              className="bg-indigo-500 h-full transition-all"
              style={{ width: `${paymentBreakdown.transfPct}%` }}
              title={`Transferencia: ${paymentBreakdown.transfPct}%`}
            />
          )}
          {paymentBreakdown.tarjetaPct > 0 && (
            <div
              className="bg-amber-400 h-full transition-all"
              style={{ width: `${paymentBreakdown.tarjetaPct}%` }}
              title={`Tarjeta / POS: ${paymentBreakdown.tarjetaPct}%`}
            />
          )}
        </div>

        {/* Cuadrícula de 4 Métodos */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
            <div className="flex items-center gap-1.5 text-emerald-400 font-bold mb-1">
              <Banknote className="w-4 h-4" />
              <span>Efectivo ({paymentBreakdown.efectivoPct}%)</span>
            </div>
            <p className="text-base font-black text-white font-mono">
              {currencySymbol}{paymentBreakdown.efectivo.toFixed(2)}
            </p>
            <span className="text-[10px] text-slate-500 block">{paymentBreakdown.efectivoCount} transacciones</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
            <div className="flex items-center gap-1.5 text-cyan-400 font-bold mb-1">
              <Smartphone className="w-4 h-4" />
              <span>DeUna QR ({paymentBreakdown.deunaPct}%)</span>
            </div>
            <p className="text-base font-black text-white font-mono">
              {currencySymbol}{paymentBreakdown.deuna.toFixed(2)}
            </p>
            <span className="text-[10px] text-slate-500 block">{paymentBreakdown.deunaCount} transacciones</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
            <div className="flex items-center gap-1.5 text-indigo-400 font-bold mb-1">
              <Landmark className="w-4 h-4" />
              <span>Transf ({paymentBreakdown.transfPct}%)</span>
            </div>
            <p className="text-base font-black text-white font-mono">
              {currencySymbol}{paymentBreakdown.transferencia.toFixed(2)}
            </p>
            <span className="text-[10px] text-slate-500 block">{paymentBreakdown.transfCount} transacciones</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
            <div className="flex items-center gap-1.5 text-amber-400 font-bold mb-1">
              <CreditCard className="w-4 h-4" />
              <span>Tarjeta / POS ({paymentBreakdown.tarjetaPct}%)</span>
            </div>
            <p className="text-base font-black text-white font-mono">
              {currencySymbol}{paymentBreakdown.tarjeta.toFixed(2)}
            </p>
            <span className="text-[10px] text-slate-500 block">{paymentBreakdown.cardCount} transacciones</span>
          </div>
        </div>
      </div>

      {/* 6. TABLA CRONOLÓGICA DE DETALLE DIARIO */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
          <span className="font-extrabold text-white text-xs uppercase tracking-wider flex items-center gap-2">
            <Calendar className="w-4 h-4 text-amber-400" />
            <span>Desglose Histórico Día por Día</span>
          </span>
          <span className="text-[11px] text-slate-400 font-mono">
            {dailySales.filter((d) => d.total > 0).length} días con facturación
          </span>
        </div>

        <div className="overflow-x-auto max-h-72 overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/90 text-slate-400 uppercase font-extrabold text-[10px] tracking-wider border-b border-slate-800 sticky top-0 z-10 backdrop-blur-md">
              <tr>
                <th className="px-4 py-3">Fecha / Día</th>
                <th className="px-4 py-3">Facturado</th>
                <th className="px-4 py-3">Pedidos</th>
                <th className="px-4 py-3">Ticket Prom.</th>
                <th className="px-4 py-3">Método Dominante</th>
                <th className="px-4 py-3 text-right">Rendimiento</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {dailySales.filter((d) => d.total > 0 || dailySales.length <= 14).length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-6 text-slate-500 font-sans">
                    No se registraron ventas en las fechas seleccionadas.
                  </td>
                </tr>
              ) : (
                [...dailySales]
                  .reverse()
                  .filter((d) => d.total > 0 || dailySales.length <= 14)
                  .map((day) => {
                    const avg = day.count > 0 ? day.total / day.count : 0;
                    const isPeak = maxDay && day.dateStr === maxDay.dateStr && day.total > 0;

                    let dominant = "Efectivo";
                    let dominantAmt = day.methods.EFECTIVO;
                    if (day.methods.DEUNA > dominantAmt) {
                      dominant = "DeUna QR";
                      dominantAmt = day.methods.DEUNA;
                    }
                    if (day.methods.TARJETA > dominantAmt) {
                      dominant = "Tarjeta";
                      dominantAmt = day.methods.TARJETA;
                    }
                    if (day.methods.TRANSFERENCIA > dominantAmt) {
                      dominant = "Transf";
                      dominantAmt = day.methods.TRANSFERENCIA;
                    }

                    return (
                      <tr key={day.dateStr} className="hover:bg-slate-800/30 transition">
                        <td className="px-4 py-3 text-white font-sans font-bold capitalize">
                          {day.dateObj.toLocaleDateString("es-ES", {
                            weekday: "short",
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </td>
                        <td className="px-4 py-3 font-bold text-emerald-400">
                          {currencySymbol}{day.total.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-slate-300">{day.count}</td>
                        <td className="px-4 py-3 text-amber-300">
                          {currencySymbol}{avg.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 font-sans text-slate-300 text-[11px]">
                          {day.total > 0 ? dominant : "—"}
                        </td>
                        <td className="px-4 py-3 text-right font-sans">
                          {isPeak ? (
                            <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-black">
                              ⭐ Pico Máximo
                            </span>
                          ) : day.total >= periodAverageTicket * 2 ? (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
                              Día Fuerte
                            </span>
                          ) : day.total > 0 ? (
                            <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 text-[10px]">
                              Normal
                            </span>
                          ) : (
                            <span className="text-slate-600 text-[10px]">Sin ventas</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default SalesAnalyticsDashboard;

