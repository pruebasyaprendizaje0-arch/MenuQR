"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  Search,
  MapPin,
  Flame,
  Star,
  Sparkles,
  ArrowRight,
  UtensilsCrossed,
  ShoppingBag,
  Wrench,
  Calendar,
  Hotel,
  Store,
  ExternalLink,
  SlidersHorizontal,
} from "lucide-react";
import { getPrimaryDishImage } from "@/lib/dish-images";
import { MarketplaceItem, MarketplaceData, MarketplaceVertical } from "@/lib/marketplace";
import { getInitials } from "@/components/SmartImage";

interface Props {
  data: MarketplaceData;
}

export function VerticalMarketplaceSection({ data }: Props) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<"all" | "suggested" | "popular">("all");
  const [selectedCity, setSelectedCity] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"default" | "price_asc" | "price_desc">("default");

  const { vertical, title, subtitle, badgeText, accentColor, items, cities } = data;

  // Filtrado y ordenamiento dinámico
  const filteredItems = useMemo(() => {
    let result = [...items];

    // 1. Filtro por texto de búsqueda
    if (searchTerm.trim() !== "") {
      const q = searchTerm.toLowerCase().trim();
      result = result.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          (i.description && i.description.toLowerCase().includes(q)) ||
          i.restaurant.name.toLowerCase().includes(q) ||
          (i.categoryName && i.categoryName.toLowerCase().includes(q))
      );
    }

    // 2. Filtro por pestaña (Sugeridos vs Populares)
    if (selectedFilter === "suggested") {
      result = result.filter((i) => i.isSuggested);
    } else if (selectedFilter === "popular") {
      result = result.filter((i) => i.isPopular || (i.orderCount && i.orderCount > 0));
    }

    // 3. Filtro por ciudad
    if (selectedCity !== "all") {
      result = result.filter(
        (i) => i.restaurant.city && i.restaurant.city.toLowerCase() === selectedCity.toLowerCase()
      );
    }

    // 4. Ordenamiento
    if (sortBy === "price_asc") {
      result.sort((a, b) => a.price - b.price);
    } else if (sortBy === "price_desc") {
      result.sort((a, b) => b.price - a.price);
    }

    return result;
  }, [items, searchTerm, selectedFilter, selectedCity, sortBy]);

  // Estilos de acento por vertical
  const stylesByColor = {
    red: {
      badgeBg: "bg-red-500/10 text-red-400 border-red-500/20",
      pillActive: "bg-red-600 text-white shadow-lg shadow-red-600/30",
      cardBorderHover: "hover:border-red-500/50",
      buttonBg: "bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white shadow-red-600/20",
      ctaBorder: "border-red-500/30",
      tagPrice: "text-amber-400",
      icon: <UtensilsCrossed className="w-4 h-4" />,
      registerType: "RESTAURANT",
      actionText: "Ver Menú & Pedir",
    },
    amber: {
      badgeBg: "bg-amber-500/10 text-amber-400 border-amber-500/20",
      pillActive: "bg-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/30",
      cardBorderHover: "hover:border-amber-500/50",
      buttonBg: "bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black shadow-amber-500/20",
      ctaBorder: "border-amber-500/30",
      tagPrice: "text-amber-400",
      icon: <ShoppingBag className="w-4 h-4" />,
      registerType: "RETAIL",
      actionText: "Ver en Tienda",
    },
    cyan: {
      badgeBg: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
      pillActive: "bg-cyan-500 text-slate-950 font-black shadow-lg shadow-cyan-500/30",
      cardBorderHover: "hover:border-cyan-500/50",
      buttonBg: "bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-slate-950 font-black shadow-cyan-500/20",
      ctaBorder: "border-cyan-500/30",
      tagPrice: "text-cyan-400",
      icon: <Wrench className="w-4 h-4" />,
      registerType: "SERVICES",
      actionText: "Cotizar Servicio",
    },
    purple: {
      badgeBg: "bg-purple-500/10 text-purple-400 border-purple-500/20",
      pillActive: "bg-purple-600 text-white shadow-lg shadow-purple-600/30",
      cardBorderHover: "hover:border-purple-500/50",
      buttonBg: "bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-purple-600/20",
      ctaBorder: "border-purple-500/30",
      tagPrice: "text-purple-300",
      icon: <Calendar className="w-4 h-4" />,
      registerType: "SERVICES",
      actionText: "Agendar Turno",
    },
    emerald: {
      badgeBg: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
      pillActive: "bg-emerald-500 text-slate-950 font-black shadow-lg shadow-emerald-500/30",
      cardBorderHover: "hover:border-emerald-500/50",
      buttonBg: "bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black shadow-emerald-500/20",
      ctaBorder: "border-emerald-500/30",
      tagPrice: "text-emerald-400",
      icon: <Hotel className="w-4 h-4" />,
      registerType: "SERVICES",
      actionText: "Consultar Fechas",
    },
  }[accentColor];

  return (
    <section className="py-20 bg-slate-950 border-t border-slate-800/80 relative overflow-hidden">
      {/* Fondo ambiental */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] bg-gradient-to-b from-indigo-500/5 via-slate-900/10 to-transparent rounded-full blur-[160px] pointer-events-none"></div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Cabecera del Marketplace */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold border mb-4 backdrop-blur-md ${stylesByColor.badgeBg}`}
          >
            {stylesByColor.icon}
            <span>{badgeText}</span>
          </div>

          <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight mb-4">
            {title}
          </h2>

          <p className="text-slate-400 text-base sm:text-lg leading-relaxed">
            {subtitle}
          </p>
        </div>

        {/* Barra de Filtros y Búsqueda */}
        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-3xl p-4 sm:p-6 mb-10 shadow-2xl space-y-4">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
            {/* Buscador */}
            <div className="relative w-full lg:max-w-md">
              <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por plato, producto, categoría o negocio..."
                className="w-full pl-12 pr-4 py-3 bg-slate-950/70 border border-slate-800 rounded-2xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-white px-2 py-1 rounded-md bg-slate-800"
                >
                  Limpiar
                </button>
              )}
            </div>

            {/* Selector de Ciudad */}
            <div className="flex items-center gap-3 w-full lg:w-auto overflow-x-auto pb-1 lg:pb-0">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 shrink-0">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                <span>Ciudad:</span>
              </span>
              <select
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
                className="bg-slate-950/70 border border-slate-800 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="all">Todas las Ciudades ({cities.length})</option>
                {cities.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              {/* Ordenamiento */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-slate-950/70 border border-slate-800 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="default">⭐ Más Recomendados</option>
                <option value="price_asc">💵 Precio: Menor a Mayor</option>
                <option value="price_desc">💎 Precio: Mayor a Menor</option>
              </select>
            </div>
          </div>

          {/* Tabs de Filtro de Estado */}
          <div className="flex items-center gap-2 border-t border-slate-800/80 pt-4 overflow-x-auto">
            <button
              onClick={() => setSelectedFilter("all")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
                selectedFilter === "all"
                  ? stylesByColor.pillActive
                  : "bg-slate-950/60 text-slate-400 hover:text-white border border-slate-800/80"
              }`}
            >
              Todos ({items.length})
            </button>
            <button
              onClick={() => setSelectedFilter("suggested")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                selectedFilter === "suggested"
                  ? stylesByColor.pillActive
                  : "bg-slate-950/60 text-slate-400 hover:text-white border border-slate-800/80"
              }`}
            >
              <Star className="w-3.5 h-3.5" />
              <span>Sugeridos del Negocio ({items.filter((i) => i.isSuggested).length})</span>
            </button>
            <button
              onClick={() => setSelectedFilter("popular")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                selectedFilter === "popular"
                  ? stylesByColor.pillActive
                  : "bg-slate-950/60 text-slate-400 hover:text-white border border-slate-800/80"
              }`}
            >
              <Flame className="w-3.5 h-3.5" />
              <span>Más Populares ({items.filter((i) => i.isPopular || (i.orderCount && i.orderCount > 0)).length})</span>
            </button>
          </div>
        </div>

        {/* Contador de Resultados */}
        <div className="flex items-center justify-between mb-6 text-xs text-slate-400 px-2 font-medium">
          <span>
            Mostrando <strong className="text-white font-bold">{filteredItems.length}</strong> items disponibles en Ecuador
          </span>
          {selectedCity !== "all" && (
            <span className="text-slate-300">
              Filtro activo: 📍 <strong className="text-white">{selectedCity}</strong>
            </span>
          )}
        </div>

        {/* Grid de Tarjetas del Marketplace */}
        {filteredItems.length === 0 ? (
          <div className="text-center py-20 bg-slate-900/40 rounded-3xl border border-slate-800/80 p-8">
            <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center text-slate-400 mx-auto mb-4">
              <Search className="w-7 h-7" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">No encontramos coincidencias</h3>
            <p className="text-slate-400 text-sm max-w-md mx-auto mb-6">
              Prueba cambiando la ciudad seleccionada o limpiando el texto de búsqueda.
            </p>
            <button
              onClick={() => {
                setSearchTerm("");
                setSelectedCity("all");
                setSelectedFilter("all");
              }}
              className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition"
            >
              Restablecer Filtros
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-16">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                className={`group bg-slate-900/60 rounded-3xl border border-slate-800/80 overflow-hidden flex flex-col justify-between transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-black/50 backdrop-blur-sm ${stylesByColor.cardBorderHover}`}
              >
                <div>
                  {/* Imagen y Badges */}
                  <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-950">
                    {item.imageUrl ? (
                      <img
                        src={getPrimaryDishImage(item.imageUrl) || item.imageUrl}
                        alt={item.name}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 p-4 text-center">
                        <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center text-amber-400 font-black mb-2 text-sm">
                          {getInitials(item.name)}
                        </div>
                        <span className="text-xs text-slate-400 font-bold max-w-[85%] truncate">
                          {item.name}
                        </span>
                      </div>
                    )}

                    {/* Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent pointer-events-none"></div>

                    {/* Badge Superior */}
                    {item.badge && (
                      <div className="absolute top-3 left-3 px-3 py-1 rounded-full bg-slate-950/90 border border-white/10 text-white text-[11px] font-black uppercase tracking-wider backdrop-blur-md shadow-lg flex items-center gap-1">
                        <span>{item.badge}</span>
                      </div>
                    )}

                    {/* Badge de Precio */}
                    <div className="absolute bottom-3 right-3 px-3 py-1.5 rounded-2xl bg-slate-950/95 border border-white/10 backdrop-blur-md shadow-xl flex items-center gap-1">
                      <span className="text-xs text-slate-400 font-bold">$</span>
                      <span className={`text-base font-black ${stylesByColor.tagPrice}`}>
                        {item.price.toFixed(2)}
                      </span>
                    </div>

                    {/* Categoría */}
                    {item.categoryName && (
                      <div className="absolute bottom-3 left-3 text-[10px] font-bold text-slate-400 bg-slate-900/80 px-2.5 py-1 rounded-lg border border-slate-800 backdrop-blur">
                        {item.categoryName}
                      </div>
                    )}
                  </div>

                  {/* Información del Item */}
                  <div className="p-5">
                    <h3 className="text-base font-bold text-white mb-1.5 group-hover:text-amber-400 transition-colors line-clamp-1">
                      {item.name}
                    </h3>
                    <p className="text-slate-400 text-xs leading-relaxed line-clamp-2 mb-4 min-h-[32px]">
                      {item.description || "Especialidad preparada con los mejores ingredientes y estándares de calidad del establecimiento."}
                    </p>

                    {/* Negocio & Ubicación */}
                    <div className="flex items-center justify-between pt-3 border-t border-slate-800/80 text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        {item.restaurant.logoUrl ? (
                          <img
                            src={item.restaurant.logoUrl}
                            alt={item.restaurant.name}
                            className="w-6 h-6 rounded-lg object-cover border border-slate-700 shrink-0"
                          />
                        ) : (
                          <div
                            className="w-6 h-6 rounded-lg flex items-center justify-center font-bold text-[10px] text-white shrink-0"
                            style={{ backgroundColor: item.restaurant.themeColor || "#ef4444" }}
                          >
                            {getInitials(item.restaurant.name)}
                          </div>
                        )}
                        <span className="font-bold text-slate-300 truncate text-xs">
                          {item.restaurant.name}
                        </span>
                      </div>

                      {item.restaurant.city && (
                        <span className="text-[10px] font-semibold text-slate-400 bg-slate-950 px-2 py-0.5 rounded-md border border-slate-800 shrink-0 flex items-center gap-1">
                          <MapPin className="w-2.5 h-2.5 text-slate-500" />
                          <span>{item.restaurant.city}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Botón de Acción Directo */}
                <div className="p-5 pt-0">
                  <Link
                    href={item.targetUrl}
                    className={`w-full py-3 px-4 rounded-xl font-bold text-xs shadow-lg transition-all flex items-center justify-center gap-2 group/btn ${stylesByColor.buttonBg}`}
                  >
                    <span>{stylesByColor.actionText}</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover/btn:translate-x-1 transition-transform" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Banner de Invitación a Negocios Locales (B2B Conversion) */}
        <div
          className={`p-8 sm:p-10 rounded-3xl bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 border ${stylesByColor.ctaBorder} shadow-2xl relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6`}
        >
          <div className="space-y-2 text-center md:text-left max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800 text-amber-400 text-[11px] font-bold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Aparece Gratis en esta Vitrina</span>
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-white">
              ¿Tienes un negocio en este sector y quieres vender más?
            </h3>
            <p className="text-slate-400 text-sm">
              Al digitalizar tu carta o catálogo con Ubícame, tus platos o productos más populares se exhiben de forma automática en nuestra vitrina nacional con tráfico directo.
            </p>
          </div>

          <Link
            href={`/registro?type=${stylesByColor.registerType}`}
            className="px-6 py-3.5 rounded-2xl bg-white hover:bg-slate-100 text-slate-950 font-black text-xs sm:text-sm shadow-xl transition-all hover:scale-105 shrink-0 flex items-center gap-2"
          >
            <span>Registrar mi Negocio Gratis</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
