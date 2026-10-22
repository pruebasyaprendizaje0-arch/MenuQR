"use client";

import React, { useState } from "react";
import {
  DollarSign,
  TrendingUp,
  QrCode,
  Eye,
  MessageSquare,
  AlertTriangle,
  Award,
  ExternalLink,
  UtensilsCrossed,
  ShoppingBag,
  Wrench,
  CalendarCheck,
  Home,
  CheckCircle2,
  HelpCircle,
} from "lucide-react";

export interface AnalyticsProps {
  gmvTotal: number;
  totalOrdersCount: number;
  ordersLast30DaysGmv: number;
  ordersLast30DaysCount: number;
  analyticsEventStats: {
    qrScans: number;
    menuViews: number;
    whatsappClicks: number;
    dishViews: number;
    totalEvents: number;
  };
  restaurants: any[];
}

export function SuperAdminAnalyticsTab({
  gmvTotal,
  totalOrdersCount,
  ordersLast30DaysGmv,
  ordersLast30DaysCount,
  analyticsEventStats,
  restaurants,
}: AnalyticsProps) {
  const [filterRisk, setFilterRisk] = useState<"ALL" | "NO_ORDERS" | "NO_PHOTOS">("ALL");

  // Calcular Comercios Top por pedidos
  const topRestaurants = [...restaurants]
    .sort((a, b) => (b.health?.totalOrders || 0) - (a.health?.totalOrders || 0))
    .slice(0, 5);

  // Detector de comercios en riesgo (sin pedidos recientes o sin fotos en el menú)
  const atRiskRestaurants = restaurants.filter((r) => {
    const hasNoRecentOrders = (r.health?.recentOrders || 0) === 0;
    const hasLowPhotos = (r.health?.photoPercentage || 0) < 40;
    const hasFewDishes = (r.health?.totalDishes || 0) < 3;
    return hasNoRecentOrders || hasLowPhotos || hasFewDishes;
  });

  const filteredRiskRestaurants = atRiskRestaurants.filter((r) => {
    if (filterRisk === "NO_ORDERS") return (r.health?.recentOrders || 0) === 0;
    if (filterRisk === "NO_PHOTOS") return (r.health?.photoPercentage || 0) < 40;
    return true;
  });

  // Conteo por vertical
  const verticalCounts = {
    RESTAURANT: restaurants.filter((r) => !r.businessType || r.businessType === "RESTAURANT").length,
    RETAIL: restaurants.filter((r) => r.businessType === "RETAIL" || r.businessType === "GENERAL_CATALOG").length,
    SERVICES: restaurants.filter((r) => r.businessType === "SERVICES").length,
    LODGING: restaurants.filter((r) => r.specialty?.toLowerCase().includes("hospedaje") || r.description?.toLowerCase().includes("cabaña")).length,
  };

  const handleContactAtRisk = (r: any) => {
    const phone = (r.whatsappNumber || r.whatsapp || "").replace(/\D/g, "");
    if (!phone) {
      alert("Este negocio no tiene número de WhatsApp registrado.");
      return;
    }
    const text = `Hola ${r.userName || ""}, te saludamos del equipo de soporte de MenuQR Pro. Notamos que tu catálogo de "${r.name}" puede optimizarse para vender más por WhatsApp. ¿Te gustaría que te ayudemos a configurar tus fotos y categorías totalmente gratis?`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, "_blank");
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Cabecera del Módulo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 text-emerald-400 mb-2">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Business Intelligence & Métricas Globales</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Centro de Analítica & GMV del Ecosistema
          </h2>
          <p className="text-xs sm:text-sm text-slate-400">
            Rendimiento transaccional consolidado, escaneos de códigos QR y alertas proactivas de retención.
          </p>
        </div>
      </div>

      {/* Grid de KPIs Principales */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* GMV Total Histórico */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-950/40 via-slate-900 to-slate-900/80 border border-emerald-500/30 shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition">
            <DollarSign className="w-20 h-20 text-emerald-400" />
          </div>
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-400 block mb-1">
            GMV Total Transaccionado
          </span>
          <div className="text-3xl font-black text-white">
            ${gmvTotal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-xs text-slate-400 mt-2 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>{totalOrdersCount} pedidos procesados en total</span>
          </p>
        </div>

        {/* GMV Últimos 30 Días */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-blue-950/40 via-slate-900 to-slate-900/80 border border-blue-500/30 shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition">
            <TrendingUp className="w-20 h-20 text-blue-400" />
          </div>
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-blue-400 block mb-1">
            Ventas Últimos 30 Días
          </span>
          <div className="text-3xl font-black text-white">
            ${ordersLast30DaysGmv.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-xs text-slate-400 mt-2 flex items-center gap-1.5">
            <span className="text-blue-400 font-bold">{ordersLast30DaysCount} pedidos</span>
            <span>este último mes</span>
          </p>
        </div>

        {/* Escaneos de QR Globales */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-amber-950/40 via-slate-900 to-slate-900/80 border border-amber-500/30 shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition">
            <QrCode className="w-20 h-20 text-amber-400" />
          </div>
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-400 block mb-1">
            Escaneos de QR Totales
          </span>
          <div className="text-3xl font-black text-white">
            {analyticsEventStats.qrScans.toLocaleString()}
          </div>
          <p className="text-xs text-slate-400 mt-2 flex items-center gap-1.5">
            <Eye className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>{analyticsEventStats.menuViews.toLocaleString()} visitas a cartas y menús</span>
          </p>
        </div>

        {/* Clics a Pedido por WhatsApp */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-purple-950/40 via-slate-900 to-slate-900/80 border border-purple-500/30 shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition">
            <MessageSquare className="w-20 h-20 text-purple-400" />
          </div>
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-purple-400 block mb-1">
            Clics Directos a WhatsApp
          </span>
          <div className="text-3xl font-black text-white">
            {analyticsEventStats.whatsappClicks.toLocaleString()}
          </div>
          <p className="text-xs text-slate-400 mt-2 flex items-center gap-1.5">
            <span className="text-purple-400 font-bold">Intención directa</span>
            <span>de compra / reserva</span>
          </p>
        </div>
      </div>

      {/* Sección Doble: Top 5 Comercios vs Distribución por Vertical */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top 5 Comercios con Mayor Rendimiento (2 columnas) */}
        <div className="lg:col-span-2 p-6 rounded-3xl bg-slate-900/70 border border-slate-800 shadow-xl">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Top 5 Comercios con Más Pedidos</h3>
                <p className="text-xs text-slate-400">Los establecimientos más activos del ecosistema.</p>
              </div>
            </div>
            <span className="text-[11px] font-mono text-slate-500 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
              Ranking Global
            </span>
          </div>

          <div className="space-y-3">
            {topRestaurants.map((r, idx) => {
              const medalColors = [
                "bg-amber-500/20 text-amber-400 border-amber-500/40",
                "bg-slate-300/20 text-slate-300 border-slate-300/40",
                "bg-amber-700/20 text-amber-600 border-amber-700/40",
                "bg-slate-800 text-slate-400 border-slate-700",
                "bg-slate-800 text-slate-400 border-slate-700",
              ];

              return (
                <div
                  key={r.id}
                  className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`w-7 h-7 rounded-xl flex items-center justify-center font-black text-xs border shrink-0 ${
                        medalColors[idx] || medalColors[3]
                      }`}
                    >
                      #{idx + 1}
                    </span>
                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-white truncate flex items-center gap-2">
                        <span>{r.name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-normal">
                          {r.city || "Ecuador"}
                        </span>
                      </h4>
                      <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                        <span className="text-emerald-400 font-bold">
                          {r.health?.totalOrders || 0} órdenes registradas
                        </span>
                        <span>•</span>
                        <span>{r.health?.totalDishes || 0} productos</span>
                      </div>
                    </div>
                  </div>

                  <a
                    href={`/${r.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition shrink-0"
                    title="Ver Menú Público"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              );
            })}
          </div>
        </div>

        {/* Distribución por Vertical (1 columna) */}
        <div className="p-6 rounded-3xl bg-slate-900/70 border border-slate-800 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Verticales del Negocio</h3>
                <p className="text-xs text-slate-400">Distribución de clientes por rubro comercial.</p>
              </div>
            </div>

            <div className="space-y-4 pt-2">
              {/* Restaurantes */}
              <div>
                <div className="flex justify-between text-xs font-bold mb-1.5">
                  <span className="text-red-400 flex items-center gap-1.5">
                    <UtensilsCrossed className="w-3.5 h-3.5" /> Restaurantes & Gastro
                  </span>
                  <span className="text-white font-mono">{verticalCounts.RESTAURANT}</span>
                </div>
                <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                  <div
                    className="h-full bg-gradient-to-r from-red-600 to-amber-600 rounded-full"
                    style={{
                      width: `${restaurants.length ? (verticalCounts.RESTAURANT / restaurants.length) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>

              {/* Retail / Tiendas */}
              <div>
                <div className="flex justify-between text-xs font-bold mb-1.5">
                  <span className="text-amber-400 flex items-center gap-1.5">
                    <ShoppingBag className="w-3.5 h-3.5" /> Tiendas & Catálogos E-Com
                  </span>
                  <span className="text-white font-mono">{verticalCounts.RETAIL}</span>
                </div>
                <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-yellow-500 rounded-full"
                    style={{
                      width: `${restaurants.length ? (verticalCounts.RETAIL / restaurants.length) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>

              {/* Servicios y Citas */}
              <div>
                <div className="flex justify-between text-xs font-bold mb-1.5">
                  <span className="text-cyan-400 flex items-center gap-1.5">
                    <CalendarCheck className="w-3.5 h-3.5" /> Servicios & Citas Médicas
                  </span>
                  <span className="text-white font-mono">{verticalCounts.SERVICES}</span>
                </div>
                <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full"
                    style={{
                      width: `${restaurants.length ? (verticalCounts.SERVICES / restaurants.length) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 p-3 rounded-2xl bg-slate-950/80 border border-slate-800 text-[11px] text-slate-400 leading-relaxed">
            💡 <strong>Estrategia Comercial:</strong> La vertical gastronómica genera mayor recurrencia de escaneos, mientras que Retail tiene un ticket promedio por orden más alto.
          </div>
        </div>
      </div>

      {/* Módulo Detector de Comercios en Riesgo (Anti-Churn) */}
      <div className="p-6 rounded-3xl bg-slate-900/70 border border-amber-500/20 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/30">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>Detector de Comercios en Riesgo de Abandono</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold">
                  {atRiskRestaurants.length} detectados
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Locales con pocos platos, sin fotos o sin pedidos recientes. Contáctalos para ofrecerles asistencia VIP antes de que expiren.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 p-1 bg-slate-950 border border-slate-800 rounded-xl">
            <button
              onClick={() => setFilterRisk("ALL")}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                filterRisk === "ALL" ? "bg-amber-500 text-slate-950" : "text-slate-400 hover:text-white"
              }`}
            >
              Todos ({atRiskRestaurants.length})
            </button>
            <button
              onClick={() => setFilterRisk("NO_ORDERS")}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                filterRisk === "NO_ORDERS" ? "bg-amber-500 text-slate-950" : "text-slate-400 hover:text-white"
              }`}
            >
              Sin pedidos recientes
            </button>
            <button
              onClick={() => setFilterRisk("NO_PHOTOS")}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                filterRisk === "NO_PHOTOS" ? "bg-amber-500 text-slate-950" : "text-slate-400 hover:text-white"
              }`}
            >
              Faltan Fotos
            </button>
          </div>
        </div>

        {filteredRiskRestaurants.length === 0 ? (
          <div className="text-center py-10 text-slate-400">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2 opacity-80" />
            <p className="text-sm font-semibold text-white">¡Excelente! Ningún comercio coincide con este filtro de riesgo.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredRiskRestaurants.slice(0, 9).map((r) => (
              <div
                key={r.id}
                className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 hover:border-amber-500/40 transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h4 className="text-sm font-bold text-white truncate">{r.name}</h4>
                    <span className="text-[10px] px-2 py-0.5 rounded font-extrabold bg-slate-800 text-amber-400 shrink-0">
                      {r.plan}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 truncate mb-3">
                    Dueño: <span className="text-slate-200">{r.userName || "Sin asignar"}</span> ({r.city || "Ecuador"})
                  </p>

                  <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/80 mb-3">
                    <div>
                      <span className="text-slate-500 block">Fotos:</span>
                      <span
                        className={`font-bold ${
                          (r.health?.photoPercentage || 0) < 40 ? "text-amber-400" : "text-slate-300"
                        }`}
                      >
                        {r.health?.photoPercentage || 0}% ({r.health?.dishesWithPhoto || 0}/{r.health?.totalDishes || 0})
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Últimos 7 días:</span>
                      <span
                        className={`font-bold ${
                          (r.health?.recentOrders || 0) === 0 ? "text-red-400" : "text-emerald-400"
                        }`}
                      >
                        {r.health?.recentOrders || 0} órdenes
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleContactAtRisk(r)}
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 text-xs font-bold transition active:scale-95 cursor-pointer"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Ofrecer Ayuda por WhatsApp</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
