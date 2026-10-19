"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { 
  Search, 
  Sparkles, 
  UtensilsCrossed, 
  ShoppingBag, 
  MapPin, 
  MessageCircle, 
  ExternalLink, 
  ArrowLeft,
  Navigation,
  ChevronDown,
  ChevronUp,
  X,
  Compass,
  Tag,
  Loader2,
  Check
} from "lucide-react";
import { ecuadorData, parishData, communeData } from "@/lib/ecuador";
import { 
  calculateHaversineDistanceKm, 
  formatDistanceLabel, 
  parseLocality, 
  requestBrowserCoordinates 
} from "@/lib/geo-utils";
import type { MarketplaceItem } from "@/lib/suggested-dishes-actions";
import { getPrimaryDishImage } from "@/lib/dish-images";

export function MarketplaceClient({
  initialDishes,
}: {
  initialDishes: MarketplaceItem[];
}) {
  const [activeTab, setActiveTab] = useState<"all" | "restaurant" | "store">("all");
  const [searchTerm, setSearchTerm] = useState("");

  // Georradar GPS (Cerca de mí)
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  // Acordeón de Zona Geográfica Completa (4 Niveles)
  const [showGeoAccordion, setShowGeoAccordion] = useState(false);
  const [selProvince, setSelProvince] = useState("TODAS");
  const [selCanton, setSelCanton] = useState("TODAS");
  const [selParroquia, setSelParroquia] = useState("TODAS");
  const [selSector, setSelSector] = useState("TODAS");

  // Ordenamiento
  const [sortBy, setSortBy] = useState<"featured" | "distance" | "price_asc" | "price_desc">("featured");

  // Datos geográficos dinámicos
  const provinces = useMemo(() => Object.keys(ecuadorData).sort(), []);
  const cantons = useMemo(() => {
    if (selProvince === "TODAS") return [];
    return (ecuadorData[selProvince] || []).sort();
  }, [selProvince]);

  const parroquias = useMemo(() => {
    if (selCanton === "TODAS") return [];
    const fromData = parishData[selCanton] || [];
    if (fromData.length > 0) return fromData.sort();

    const fromRests = Array.from(
      new Set(
        initialDishes
          .filter((d) => {
            const loc = parseLocality(d.restaurant.locality);
            return (
              (d.restaurant.city && d.restaurant.city.toLowerCase() === selCanton.toLowerCase()) ||
              loc.canton.toLowerCase() === selCanton.toLowerCase()
            );
          })
          .map((d) => d.restaurant.parish || parseLocality(d.restaurant.locality).parroquia)
          .filter(Boolean)
      )
    );
    return fromRests.sort();
  }, [selCanton, initialDishes]);

  const sectores = useMemo(() => {
    if (selParroquia === "TODAS") return [];
    const fromData = communeData[selParroquia] || [];
    if (fromData.length > 0) return fromData.sort();

    const fromRests = Array.from(
      new Set(
        initialDishes
          .filter((d) => {
            const loc = parseLocality(d.restaurant.locality);
            return (
              (d.restaurant.parish && d.restaurant.parish.toLowerCase() === selParroquia.toLowerCase()) ||
              loc.parroquia.toLowerCase() === selParroquia.toLowerCase()
            );
          })
          .map((d) => d.restaurant.sector || parseLocality(d.restaurant.locality).sector)
          .filter(Boolean)
      )
    );
    return fromRests.sort();
  }, [selParroquia, initialDishes]);

  const restaurantCount = useMemo(
    () => initialDishes.filter((i) => i.itemType === "restaurant").length,
    [initialDishes]
  );
  const storeCount = useMemo(
    () => initialDishes.filter((i) => i.itemType === "store").length,
    [initialDishes]
  );

  // Activación / Desactivación de GPS
  const handleToggleGeoLocation = async () => {
    if (userLocation) {
      setUserLocation(null);
      setSortBy("featured");
      setGeoError(null);
      return;
    }

    setIsLocating(true);
    setGeoError(null);
    try {
      const coords = await requestBrowserCoordinates();
      setUserLocation(coords);
      setSortBy("distance");
    } catch (err: any) {
      setGeoError(err.message || "No se pudo obtener la ubicación GPS.");
    } finally {
      setIsLocating(false);
    }
  };

  // Cálculo de distancia para cada producto
  const dishesWithDistance = useMemo(() => {
    return initialDishes.map((dish) => {
      let distanceKm: number | null = null;
      if (userLocation && dish.restaurant.latitude && dish.restaurant.longitude) {
        distanceKm = calculateHaversineDistanceKm(
          userLocation.lat,
          userLocation.lng,
          dish.restaurant.latitude,
          dish.restaurant.longitude
        );
      }
      const parsedLoc = parseLocality(dish.restaurant.locality);
      return {
        ...dish,
        distanceKm,
        parsedLoc,
      };
    });
  }, [initialDishes, userLocation]);

  // Filtrado y ordenamiento de la cuadrícula
  const filteredDishes = useMemo(() => {
    return dishesWithDistance
      .filter((dish) => {
        // Filtro de tipo: Restaurante vs Tienda
        if (activeTab === "restaurant" && dish.itemType !== "restaurant") return false;
        if (activeTab === "store" && dish.itemType !== "store") return false;

        // Búsqueda por texto libre
        if (searchTerm.trim()) {
          const q = searchTerm.toLowerCase();
          const matchesName = dish.name.toLowerCase().includes(q);
          const matchesDesc = (dish.description || "").toLowerCase().includes(q);
          const matchesRest = dish.restaurant.name.toLowerCase().includes(q);
          const matchesCat = dish.categoryName.toLowerCase().includes(q);
          const matchesLoc = (dish.restaurant.locality || "").toLowerCase().includes(q);
          if (!matchesName && !matchesDesc && !matchesRest && !matchesCat && !matchesLoc) return false;
        }

        // Filtro de provincia
        if (selProvince !== "TODAS") {
          const restProv = (dish.restaurant.province || dish.parsedLoc.province || "").toLowerCase();
          if (restProv !== selProvince.toLowerCase()) return false;
        }

        // Filtro de cantón
        if (selCanton !== "TODAS") {
          const restCanton = (dish.restaurant.city || dish.parsedLoc.canton || "").toLowerCase();
          if (restCanton !== selCanton.toLowerCase()) return false;
        }

        // Filtro de parroquia
        if (selParroquia !== "TODAS") {
          const restParroquia = (dish.restaurant.parish || dish.parsedLoc.parroquia || "").toLowerCase();
          if (!restParroquia.includes(selParroquia.toLowerCase())) return false;
        }

        // Filtro de sector / comuna
        if (selSector !== "TODAS") {
          const restSector = (dish.restaurant.sector || dish.parsedLoc.sector || "").toLowerCase();
          if (!restSector.includes(selSector.toLowerCase())) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "distance") {
          if (a.distanceKm !== null && b.distanceKm !== null) {
            return a.distanceKm - b.distanceKm;
          }
          if (a.distanceKm !== null) return -1;
          if (b.distanceKm !== null) return 1;
          return 0;
        }
        if (sortBy === "price_asc") return a.price - b.price;
        if (sortBy === "price_desc") return b.price - a.price;
        return 0;
      });
  }, [dishesWithDistance, activeTab, searchTerm, selProvince, selCanton, selParroquia, selSector, sortBy]);

  const getWhatsappUrl = (dish: MarketplaceItem) => {
    const rawPhone = dish.restaurant.whatsapp || "593999999999";
    let formattedPhone = rawPhone.replace(/\D/g, "");
    if (!formattedPhone.startsWith("593") && formattedPhone.startsWith("0")) {
      formattedPhone = "593" + formattedPhone.substring(1);
    } else if (!formattedPhone.startsWith("593") && formattedPhone.length === 9) {
      formattedPhone = "593" + formattedPhone;
    }
    const msg = `Hola *${dish.restaurant.name}*, vi su especial sugerido *${dish.name}* ($${dish.price.toFixed(2)}) en el Marketplace de MenuQR Pro y deseo realizar un pedido.`;
    return `https://wa.me/${formattedPhone}?text=${encodeURIComponent(msg)}`;
  };

  const clearAllFilters = () => {
    setActiveTab("all");
    setSearchTerm("");
    setSelProvince("TODAS");
    setSelCanton("TODAS");
    setSelParroquia("TODAS");
    setSelSector("TODAS");
    setUserLocation(null);
    setSortBy("featured");
    setGeoError(null);
  };

  const hasManualGeoFilter =
    selProvince !== "TODAS" || selCanton !== "TODAS" || selParroquia !== "TODAS" || selSector !== "TODAS";

  const hasActiveFilters =
    activeTab !== "all" ||
    searchTerm.trim() !== "" ||
    hasManualGeoFilter ||
    userLocation !== null ||
    sortBy !== "featured";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-slate-950/90 border-b border-slate-800 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-white transition group py-1.5 px-3 rounded-xl bg-slate-900 border border-slate-800"
            >
              <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
              <span>Volver</span>
            </Link>

            <Link href="/" className="flex items-center gap-2">
              <div className="h-9 w-9 bg-gradient-to-tr from-red-600 via-amber-500 to-orange-500 rounded-xl flex items-center justify-center shadow-lg">
                <UtensilsCrossed className="h-5 w-5 text-white" />
              </div>
              <div>
                <span className="font-extrabold text-white text-base tracking-tight block leading-tight">
                  MenuQR <span className="text-amber-400">Pro</span>
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500 block">
                  Marketplace Oficial
                </span>
              </div>
            </Link>
          </div>

          <div className="flex items-center gap-2.5">
            <Link
              href="/catalogos"
              className="hidden sm:inline-flex px-3.5 py-1.5 text-xs font-bold text-slate-300 hover:text-white rounded-xl bg-slate-900 border border-slate-800 transition"
            >
              🛍️ Para Tiendas
            </Link>
            <Link
              href="/admin"
              className="px-4 py-1.5 text-xs font-bold text-white bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 rounded-xl shadow-md transition"
            >
              Iniciar Sesión
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Banner */}
      <div className="border-b border-slate-800/80 bg-gradient-to-b from-slate-900/80 via-slate-950 to-slate-950 py-10 px-4 sm:px-6 relative overflow-hidden">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-4xl mx-auto text-center space-y-4 relative z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-black uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            Directorio y Vitrina de Pedidos Directos
          </div>
          <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight">
            Marketplace de Gastronomía & Comercios
          </h1>
          <p className="text-slate-300 text-xs md:text-base max-w-2xl mx-auto leading-relaxed">
            Descubre los mejores platos y catálogos de tiendas asociadas en Ecuador. Filtra por tu ubicación o busca por parroquia y localidad para pedir directo por WhatsApp.
          </p>

          {/* Search Input Bar with GPS Quick Action */}
          <div className="pt-4 max-w-2xl mx-auto flex flex-col sm:flex-row items-center gap-2.5">
            <div className="relative flex-1 w-full group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-red-600 via-amber-500 to-orange-500 rounded-2xl blur opacity-30 group-focus-within:opacity-75 transition duration-300" />
              <div className="relative flex items-center">
                <Search className="absolute left-4 w-4.5 h-4.5 text-amber-400 pointer-events-none" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar plato, producto, restaurante o comuna..."
                  className="w-full bg-slate-900 border-2 border-slate-700/90 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 block pl-11 pr-10 py-3 rounded-2xl text-white placeholder-slate-400 focus:outline-none text-sm font-medium shadow-2xl transition"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm("")}
                    className="absolute right-3.5 text-slate-400 hover:text-white transition cursor-pointer"
                    title="Limpiar búsqueda"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Botón de Georradar GPS (Cerca de Mí) */}
            <button
              type="button"
              onClick={handleToggleGeoLocation}
              disabled={isLocating}
              className={`w-full sm:w-auto px-4 py-3 rounded-2xl text-xs font-black transition-all flex items-center justify-center gap-2 shadow-lg cursor-pointer shrink-0 active:scale-95 ${
                userLocation
                  ? "bg-emerald-600 text-white border border-emerald-400 shadow-emerald-950/40"
                  : "bg-slate-900 hover:bg-slate-800 text-amber-400 border border-slate-700 hover:border-amber-400"
              }`}
              title="Buscar negocios y platos más cercanos a tu ubicación actual"
            >
              {isLocating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                  <span>Detectando GPS...</span>
                </>
              ) : userLocation ? (
                <>
                  <Check className="w-4 h-4 text-emerald-200" />
                  <span>GPS Activo (Cerca de mí)</span>
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleGeoLocation();
                    }}
                    className="ml-1 p-0.5 rounded hover:bg-emerald-700/60"
                    title="Desactivar GPS"
                  >
                    <X className="w-3 h-3" />
                  </span>
                </>
              ) : (
                <>
                  <Navigation className="w-4 h-4 text-amber-400" />
                  <span>📍 Cerca de Mí</span>
                </>
              )}
            </button>
          </div>

          {/* Mensaje de error de GPS si falla */}
          {geoError && (
            <div className="max-w-md mx-auto text-[11px] font-semibold text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-1.5 animate-fade-in">
              ⚠️ {geoError} Puedes usar los filtros de parroquia y localidad abajo.
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 space-y-6 flex-1">
        {/* Controls: Segmented Switch & Zone Accordion */}
        <div className="bg-slate-900/95 border border-slate-700/80 rounded-3xl p-4 sm:p-6 shadow-2xl backdrop-blur-xl space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Segmented Switch: All vs Restaurant vs Store */}
            <div className="inline-flex p-1.5 bg-slate-950 border border-slate-800 rounded-2xl gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setActiveTab("all")}
                className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-2 ${
                  activeTab === "all"
                    ? "bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-md shadow-orange-500/20"
                    : "text-slate-300 hover:text-white hover:bg-slate-900"
                }`}
              >
                <span>✨ Todos</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-900 text-slate-200">
                  {initialDishes.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("restaurant")}
                className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-2 ${
                  activeTab === "restaurant"
                    ? "bg-gradient-to-r from-red-600 to-amber-600 text-white shadow-md shadow-red-600/20"
                    : "text-slate-300 hover:text-white hover:bg-slate-900"
                }`}
              >
                <UtensilsCrossed className="w-3.5 h-3.5 text-amber-400" />
                <span>🍽️ Gastronomía</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-900 text-amber-300">
                  {restaurantCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("store")}
                className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-2 ${
                  activeTab === "store"
                    ? "bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-md shadow-cyan-600/20"
                    : "text-slate-300 hover:text-white hover:bg-slate-900"
                }`}
              >
                <ShoppingBag className="w-3.5 h-3.5 text-cyan-400" />
                <span>🛍️ Tiendas & Comercios</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-900 text-cyan-300">
                  {storeCount}
                </span>
              </button>
            </div>

            {/* Quick Actions & Geo Accordion Toggle */}
            <div className="flex items-center gap-2.5 flex-wrap">
              <button
                type="button"
                onClick={() => setShowGeoAccordion(!showGeoAccordion)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border ${
                  hasManualGeoFilter || showGeoAccordion
                    ? "bg-amber-500/10 border-amber-500/40 text-amber-300"
                    : "bg-slate-950 border-slate-700 text-slate-300 hover:text-white hover:border-slate-500"
                }`}
              >
                <MapPin className="w-3.5 h-3.5 text-amber-400" />
                <span>
                  {hasManualGeoFilter ? "Zona Filtrada (Ver)" : "🗺️ Filtrar por Parroquia / Comuna"}
                </span>
                {showGeoAccordion ? (
                  <ChevronUp className="w-3.5 h-3.5 ml-0.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 ml-0.5" />
                )}
              </button>

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="text-xs font-bold text-amber-400 hover:text-amber-300 underline flex items-center gap-1 cursor-pointer py-1"
                >
                  <X className="w-3.5 h-3.5" />
                  Limpiar filtros
                </button>
              )}
            </div>
          </div>

          {/* Acordeón Desplegable de Zona Geográfica Completa (4 Niveles) */}
          {showGeoAccordion && (
            <div className="pt-4 border-t border-slate-800 space-y-4 animate-fade-in">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5 text-amber-400" />
                  Ubicación Jerárquica en Ecuador
                </span>
                {hasManualGeoFilter && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelProvince("TODAS");
                      setSelCanton("TODAS");
                      setSelParroquia("TODAS");
                      setSelSector("TODAS");
                    }}
                    className="text-[10px] font-bold text-slate-400 hover:text-amber-400 underline cursor-pointer"
                  >
                    Restablecer zona
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* 1. Provincia */}
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-300 block mb-1">
                    1. Provincia
                  </label>
                  <select
                    value={selProvince}
                    onChange={(e) => {
                      setSelProvince(e.target.value);
                      setSelCanton("TODAS");
                      setSelParroquia("TODAS");
                      setSelSector("TODAS");
                    }}
                    className="w-full bg-slate-950 border border-slate-700 hover:border-slate-500 focus:border-amber-500 rounded-xl px-3 py-2 text-xs text-white font-medium focus:outline-none cursor-pointer"
                  >
                    <option value="TODAS">Provincia: Todas</option>
                    {provinces.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. Cantón */}
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-300 block mb-1">
                    2. Cantón / Ciudad
                  </label>
                  <select
                    value={selCanton}
                    onChange={(e) => {
                      setSelCanton(e.target.value);
                      setSelParroquia("TODAS");
                      setSelSector("TODAS");
                    }}
                    disabled={selProvince === "TODAS" || cantons.length === 0}
                    className="w-full bg-slate-950 border border-slate-700 hover:border-slate-500 focus:border-amber-500 rounded-xl px-3 py-2 text-xs text-white font-medium focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <option value="TODAS">Cantón: Todos</option>
                    {cantons.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 3. Parroquia */}
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-300 block mb-1">
                    3. Parroquia / Localidad
                  </label>
                  <select
                    value={selParroquia}
                    onChange={(e) => {
                      setSelParroquia(e.target.value);
                      setSelSector("TODAS");
                    }}
                    disabled={selCanton === "TODAS" || parroquias.length === 0}
                    className="w-full bg-slate-950 border border-slate-700 hover:border-slate-500 focus:border-amber-500 rounded-xl px-3 py-2 text-xs text-white font-medium focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <option value="TODAS">Parroquia: Todas</option>
                    {parroquias.map((pa) => (
                      <option key={pa} value={pa}>
                        {pa}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 4. Sector / Comuna */}
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-300 block mb-1">
                    4. Sector / Comuna / Barrio
                  </label>
                  <select
                    value={selSector}
                    onChange={(e) => setSelSector(e.target.value)}
                    disabled={selParroquia === "TODAS" || sectores.length === 0}
                    className="w-full bg-slate-950 border border-slate-700 hover:border-slate-500 focus:border-amber-500 rounded-xl px-3 py-2 text-xs text-white font-medium focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <option value="TODAS">Sector: Todos</option>
                    {sectores.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Sub-Bar: Sorting Tabs */}
          <div className="flex items-center justify-between flex-wrap gap-3 pt-3 border-t border-slate-800">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 mr-1">
                Ordenar por:
              </span>
              <button
                type="button"
                onClick={() => setSortBy("featured")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  sortBy === "featured"
                    ? "bg-slate-800 text-amber-400 border border-slate-700"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                ⭐ Destacados
              </button>

              <button
                type="button"
                onClick={() => {
                  if (!userLocation) {
                    handleToggleGeoLocation();
                  } else {
                    setSortBy("distance");
                  }
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                  sortBy === "distance"
                    ? "bg-emerald-950/60 text-emerald-300 border border-emerald-500/40"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Navigation className="w-3 h-3 text-emerald-400" />
                <span>📍 Más Cercanos</span>
              </button>

              <button
                type="button"
                onClick={() => setSortBy("price_asc")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  sortBy === "price_asc"
                    ? "bg-slate-800 text-amber-400 border border-slate-700"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                💲 Menor Precio
              </button>

              <button
                type="button"
                onClick={() => setSortBy("price_desc")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  sortBy === "price_desc"
                    ? "bg-slate-800 text-amber-400 border border-slate-700"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                💲 Mayor Precio
              </button>
            </div>

            <div className="text-xs text-slate-400 font-medium">
              Mostrando <strong className="text-white">{filteredDishes.length}</strong> de {initialDishes.length}
            </div>
          </div>
        </div>

        {/* Results Grid */}
        <div className="space-y-4">
          {filteredDishes.length === 0 ? (
            <div className="text-center py-20 bg-slate-900/95 border border-slate-700/80 rounded-3xl p-8 max-w-md mx-auto shadow-2xl space-y-4">
              <Tag className="w-12 h-12 text-slate-500 mx-auto" />
              <h3 className="text-white font-black text-lg">No encontramos productos en esta zona</h3>
              <p className="text-slate-300 text-xs">
                Prueba buscando otro término, desactivando el GPS o restableciendo la parroquia/localidad.
              </p>
              <button
                type="button"
                onClick={clearAllFilters}
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition cursor-pointer"
              >
                Restablecer Filtros
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {filteredDishes.map((item) => {
                const isStore = item.itemType === "store";
                return (
                  <div
                    key={item.id}
                    className="group bg-slate-900/95 border border-slate-700/80 hover:border-amber-400 rounded-3xl overflow-hidden flex flex-col justify-between shadow-xl hover:shadow-[0_16px_36px_rgba(0,0,0,0.7)] transition-all duration-300 transform hover:-translate-y-1.5 backdrop-blur-xl"
                  >
                    {/* Media Container with Badges */}
                    <div className="relative aspect-[4/3] bg-slate-950 overflow-hidden border-b border-slate-800">
                      {item.imageUrl ? (
                        <img
                          src={getPrimaryDishImage(item.imageUrl) || item.imageUrl}
                          alt={item.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-slate-600 gap-2">
                          {isStore ? (
                            <ShoppingBag className="w-12 h-12 text-slate-500" />
                          ) : (
                            <UtensilsCrossed className="w-12 h-12 text-slate-500" />
                          )}
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                            {item.categoryName}
                          </span>
                        </div>
                      )}

                      {/* Badge Tipo: Restaurante vs Tienda */}
                      <div className="absolute top-3 left-3 flex flex-col gap-1 items-start">
                        {isStore ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-600/90 text-white shadow-md backdrop-blur-md flex items-center gap-1 border border-blue-400/30">
                            <ShoppingBag className="w-3 h-3 text-cyan-200" /> Tienda
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-gradient-to-r from-red-600 to-amber-600 text-white shadow-md backdrop-blur-md flex items-center gap-1 border border-amber-400/30">
                            <UtensilsCrossed className="w-3 h-3 text-amber-200" /> Plato del Día
                          </span>
                        )}

                        {/* Badge de Distancia GPS Real */}
                        {item.distanceKm !== null && (
                          <span className="px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider bg-emerald-950/90 text-emerald-300 border border-emerald-500/40 shadow-md backdrop-blur-md flex items-center gap-1">
                            <Navigation className="w-2.5 h-2.5 text-emerald-400" />
                            A {formatDistanceLabel(item.distanceKm)} de ti
                          </span>
                        )}
                      </div>

                      {/* Price Tag Float */}
                      <div className="absolute bottom-3 right-3 bg-slate-950/90 border border-slate-700/90 backdrop-blur-md px-3 py-1 rounded-xl shadow-lg">
                        <span className="text-emerald-400 font-black text-sm tracking-tight">
                          ${item.price.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                      <div className="space-y-2">
                        {/* Item Name */}
                        <h3 className="text-white font-extrabold text-base leading-snug group-hover:text-amber-400 transition-colors line-clamp-1">
                          {item.name}
                        </h3>

                        {/* Description */}
                        {item.description && (
                          <p className="text-slate-300 text-xs leading-relaxed line-clamp-2 font-normal">
                            {item.description}
                          </p>
                        )}
                      </div>

                      {/* Restaurant / Store Info & Locality */}
                      <div className="pt-3 border-t border-slate-800 space-y-2">
                        <Link
                          href={`/${item.restaurant.slug}`}
                          className="flex items-center justify-between text-xs group/loc hover:text-amber-300 transition"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-6 h-6 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] font-black text-white shrink-0">
                              {item.restaurant.name.charAt(0)}
                            </div>
                            <span className="font-bold text-slate-200 group-hover/loc:text-amber-400 truncate text-xs">
                              {item.restaurant.name}
                            </span>
                          </div>
                          <ExternalLink className="w-3 h-3 text-slate-500 group-hover/loc:text-amber-400 shrink-0 ml-1" />
                        </Link>

                        {/* Parroquia / Comuna / Localidad */}
                        <div className="flex items-center gap-1 text-[10px] text-slate-300 font-medium truncate">
                          <MapPin className="w-3 h-3 text-amber-500 shrink-0" />
                          <span className="truncate">
                            {[
                              item.restaurant.sector || item.parsedLoc.sector,
                              item.restaurant.parish || item.parsedLoc.parroquia,
                              item.restaurant.city || item.parsedLoc.canton,
                            ]
                              .filter(Boolean)
                              .join(", ") || item.restaurant.locality}
                          </span>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <Link
                          href={`/${item.restaurant.slug}`}
                          className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-750 text-white font-bold text-[11px] text-center border border-slate-700 transition"
                        >
                          Ver Carta
                        </Link>
                        <a
                          href={getWhatsappUrl(item)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] text-center shadow-md shadow-emerald-950/40 transition flex items-center justify-center gap-1 active:scale-95"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          Pedir
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-8 text-center text-xs text-slate-500 mt-12 bg-slate-950">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© {new Date().getFullYear()} MenuQR Pro. Plataforma de Menús Digitales y Comercio en Ecuador.</p>
          <div className="flex items-center gap-4">
            <Link href="/" className="hover:text-white transition">Inicio</Link>
            <Link href="/catalogos" className="hover:text-white transition">Tiendas</Link>
            <Link href="/terminos" className="hover:text-white transition">Términos</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
