"use client";

import { useState, useEffect, useMemo } from "react";
import { 
  Search, 
  MapPin, 
  Sparkles, 
  UtensilsCrossed, 
  ArrowRight, 
  Tag, 
  RefreshCw, 
  Navigation, 
  ChevronDown, 
  ChevronUp, 
  X, 
  Loader2 
} from "lucide-react";
import { ecuadorData, parishData, communeData } from "@/lib/ecuador";
import { 
  calculateHaversineDistanceKm, 
  formatDistanceLabel, 
  parseLocality, 
  requestBrowserCoordinates 
} from "@/lib/geo-utils";
import { SmartLogo } from "@/components/SmartImage";
import { getPrimaryDishImage } from "@/lib/dish-images";

type RestaurantListItem = {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  specialty: string | null;
  locality: string | null;
  description: string | null;
  themeColor: string;
  latitude?: number | null;
  longitude?: number | null;
  parish?: string | null;
  sector?: string | null;
};

function renderLocalityBadge(locality: string | null, distanceKm?: number | null) {
  const parsed = parseLocality(locality);
  const displayLoc = [parsed.sector, parsed.parroquia, parsed.canton, parsed.province]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="flex flex-col gap-1 mt-1">
      {distanceKm !== null && distanceKm !== undefined && (
        <span className="inline-flex items-center gap-1 w-fit px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 text-[10px] font-black uppercase tracking-wider shadow-sm">
          <Navigation className="h-2.5 w-2.5 text-emerald-400 shrink-0" />
          A {formatDistanceLabel(distanceKm)} de ti
        </span>
      )}
      {(displayLoc || locality) && (
        <div className="flex items-center gap-1.5 text-[11px] text-slate-300 font-bold uppercase tracking-wider">
          <MapPin className="h-3.5 w-3.5 text-amber-400 shrink-0" />
          <span className="truncate">{displayLoc || locality}</span>
        </div>
      )}
    </div>
  );
}

export function LandingSearch({ restaurants }: { restaurants: RestaurantListItem[] }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>("TODAS");
  
  // Georadar GPS (Cerca de mí)
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  // Ordenamiento (destacados o distancia)
  const [sortBy, setSortBy] = useState<"featured" | "distance">("featured");

  // Acordeón de Zona Geográfica (4 Niveles)
  const [showGeoAccordion, setShowGeoAccordion] = useState(true);
  const [selProvince, setSelProvince] = useState("TODAS");
  const [selCanton, setSelCanton] = useState("TODAS");
  const [selParroquia, setSelParroquia] = useState("TODAS");
  const [selSector, setSelSector] = useState("TODAS");

  // Dynamic API search results
  const [apiDishes, setApiDishes] = useState<any[]>([]);
  const [apiSuggestions, setApiSuggestions] = useState<any>(null);
  const [isSearching, setIsSearching] = useState(false);

  // Debounce effect (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchTerm.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Fetch search API when debouncedQuery changes
  useEffect(() => {
    if (!debouncedQuery) {
      setApiDishes([]);
      setApiSuggestions(null);
      return;
    }

    setIsSearching(true);
    fetch(`/api/public/v1/search?q=${encodeURIComponent(debouncedQuery)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setApiDishes(data.matchedDishes || []);
          setApiSuggestions(data.suggestions || null);
        }
      })
      .catch((err) => console.warn("API Search failed:", err))
      .finally(() => setIsSearching(false));
  }, [debouncedQuery]);

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

  const parsedRestaurants = useMemo(() => {
    return restaurants.map(r => {
      const loc = parseLocality(r.locality);
      const effectiveParroquia = r.parish || loc.parroquia;
      const effectiveSector = r.sector || loc.sector;

      let distanceKm: number | null = null;
      if (userLocation && r.latitude && r.longitude) {
        distanceKm = calculateHaversineDistanceKm(
          userLocation.lat,
          userLocation.lng,
          r.latitude,
          r.longitude
        );
      }

      return {
        ...r,
        distanceKm,
        parsedLoc: {
          ...loc,
          parroquia: effectiveParroquia,
          sector: effectiveSector,
        }
      };
    });
  }, [restaurants, userLocation]);

  const allProvinces = useMemo(() => Object.keys(ecuadorData).sort(), []);
  const allCantons = useMemo(() => {
    if (selProvince === "TODAS") return [];
    return (ecuadorData[selProvince] || []).sort();
  }, [selProvince]);

  const allParroquias = useMemo(() => {
    if (selCanton === "TODAS") return [];
    const fromData = parishData[selCanton] || [];
    if (fromData.length > 0) return fromData.sort();

    return Array.from(
      new Set(
        parsedRestaurants
          .filter(r => r.parsedLoc.canton.toLowerCase() === selCanton.toLowerCase())
          .map(r => r.parsedLoc.parroquia)
          .filter(Boolean)
      )
    ).sort();
  }, [selCanton, parsedRestaurants]);

  const allSectors = useMemo(() => {
    if (selParroquia === "TODAS") return [];
    const fromData = communeData[selParroquia] || [];
    if (fromData.length > 0) return fromData.sort();

    return Array.from(
      new Set(
        parsedRestaurants
          .filter(r => r.parsedLoc.parroquia.toLowerCase() === selParroquia.toLowerCase())
          .map(r => r.parsedLoc.sector)
          .filter(Boolean)
      )
    ).sort();
  }, [selParroquia, parsedRestaurants]);

  const specialties = useMemo(() => {
    return ["TODAS", ...Array.from(new Set(restaurants.map(r => r.specialty).filter(Boolean))) as string[]];
  }, [restaurants]);

  // Filter & sort restaurants
  const filtered = useMemo(() => {
    const list = parsedRestaurants.filter(res => {
      const matchesSearch = 
        res.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (res.specialty && res.specialty.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (res.description && res.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (res.locality && res.locality.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (res.parsedLoc.parroquia && res.parsedLoc.parroquia.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (res.parsedLoc.sector && res.parsedLoc.sector.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesProvince = selProvince === "TODAS" || res.parsedLoc.province.toLowerCase() === selProvince.toLowerCase();
      const matchesCanton = selCanton === "TODAS" || res.parsedLoc.canton.toLowerCase() === selCanton.toLowerCase();
      const matchesParroquia = selParroquia === "TODAS" || res.parsedLoc.parroquia.toLowerCase() === selParroquia.toLowerCase();
      const matchesSector = selSector === "TODAS" || res.parsedLoc.sector.toLowerCase() === selSector.toLowerCase();
        
      const matchesSpecialty = selectedSpecialty === "TODAS" || res.specialty === selectedSpecialty;

      return matchesSearch && matchesProvince && matchesCanton && matchesParroquia && matchesSector && matchesSpecialty;
    });

    if (sortBy === "distance") {
      return [...list].sort((a, b) => {
        if (a.distanceKm !== null && b.distanceKm !== null) {
          return a.distanceKm - b.distanceKm;
        }
        if (a.distanceKm !== null) return -1;
        if (b.distanceKm !== null) return 1;
        return 0;
      });
    }

    return list;
  }, [parsedRestaurants, searchTerm, selProvince, selCanton, selParroquia, selSector, selectedSpecialty, sortBy]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (filtered.length > 0) {
      window.location.href = `/${filtered[0].slug}`;
    }
  };

  const hasGeoFilter = selProvince !== "TODAS" || selCanton !== "TODAS" || selParroquia !== "TODAS" || selSector !== "TODAS";

  const clearGeoFilters = () => {
    setSelProvince("TODAS");
    setSelCanton("TODAS");
    setSelParroquia("TODAS");
    setSelSector("TODAS");
  };

  return (
    <div className="w-full space-y-8">
      {/* Search Input Bar & GPS Radar Button */}
      <div className="max-w-3xl mx-auto w-full flex flex-col sm:flex-row gap-3 items-stretch">
        <form onSubmit={handleSearchSubmit} className="flex-1 relative group">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-red-600 via-amber-500 to-orange-500 rounded-3xl blur opacity-35 group-focus-within:opacity-75 transition duration-300"></div>
          
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              {isSearching ? (
                <RefreshCw className="h-5 w-5 text-amber-400 animate-spin" />
              ) : (
                <Search className="h-5 w-5 text-amber-400 group-focus-within:text-amber-300 transition-colors duration-250" />
              )}
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por plato, restaurante, parroquia o especialidad..."
              className="w-full bg-slate-900 border-2 border-slate-700/90 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 block pl-12 pr-12 py-4 rounded-3xl text-white placeholder-slate-400 focus:outline-none sm:text-base font-medium shadow-2xl transition-all duration-200"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-white transition-colors"
                title="Limpiar búsqueda"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        </form>

        {/* GPS Proximity Radar Toggle Button */}
        <button
          type="button"
          onClick={handleToggleGeoLocation}
          className={`px-5 py-3.5 rounded-3xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 border transition duration-200 shadow-xl shrink-0 cursor-pointer ${
            userLocation
              ? "bg-emerald-600 border-emerald-400 text-white shadow-emerald-600/30 ring-2 ring-emerald-400/40"
              : "bg-slate-900 border-2 border-slate-700/90 text-slate-200 hover:text-white hover:border-amber-400 hover:bg-slate-800"
          }`}
          title={userLocation ? "Desactivar radar GPS" : "Detectar ubicación GPS y ordenar por cercanía"}
        >
          {isLocating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-amber-400" />
              <span>Detectando...</span>
            </>
          ) : userLocation ? (
            <>
              <Navigation className="h-4 w-4 text-white animate-pulse" />
              <span>📍 Cerca de Mí</span>
              <X className="h-3.5 w-3.5 ml-1 text-emerald-200 hover:text-white" />
            </>
          ) : (
            <>
              <Navigation className="h-4 w-4 text-amber-400" />
              <span>📍 Cerca de Mí</span>
            </>
          )}
        </button>
      </div>

      {geoError && (
        <div className="max-w-xl mx-auto bg-amber-950/90 border border-amber-600/80 text-amber-200 text-xs px-4 py-3 rounded-2xl flex items-center justify-between shadow-xl">
          <span className="flex items-center gap-2">⚠️ {geoError}</span>
          <button onClick={() => setGeoError(null)} className="text-amber-400 hover:text-white font-bold ml-2">✕</button>
        </div>
      )}

      {/* Popular Trend Badges */}
      <div className="flex items-center justify-center flex-wrap gap-2 pt-1">
        <span className="text-[11px] font-black uppercase tracking-wider text-amber-400/90 mr-1 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-amber-400" /> Búsquedas populares:
        </span>
        {["Pizza en Manta", "Empanadas en Montañita", "Pastas", "Mariscos", "Manta"].map((badge) => (
          <button
            key={badge}
            onClick={() => setSearchTerm(badge)}
            className="px-3.5 py-1.5 rounded-full bg-slate-900 border border-slate-700 text-xs font-semibold text-slate-200 hover:text-white hover:border-amber-400 hover:bg-slate-800 shadow-sm transition"
          >
            {badge}
          </button>
        ))}
      </div>

      {/* Advanced Cascading Location Filters Accordion (4 Niveles) */}
      <div className="bg-slate-900/95 border border-slate-700/90 rounded-3xl p-5 sm:p-6 backdrop-blur-xl max-w-4xl mx-auto space-y-4 shadow-2xl">
        <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-800 pb-3">
          <button
            type="button"
            onClick={() => setShowGeoAccordion(!showGeoAccordion)}
            className="text-xs uppercase font-black tracking-wider text-amber-400 flex items-center gap-2 hover:text-amber-300 transition cursor-pointer"
          >
            <MapPin className="h-4 w-4 text-red-500" />
            <span>🗺️ Filtrar por Parroquia / Comuna (Ecuador)</span>
            {showGeoAccordion ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          
          <div className="flex items-center gap-3">
            {hasGeoFilter && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                Filtro activo
              </span>
            )}
            {hasGeoFilter && (
              <button
                onClick={clearGeoFilters}
                className="text-[11px] font-bold text-slate-400 hover:text-amber-400 underline transition cursor-pointer"
              >
                Restablecer
              </button>
            )}
          </div>
        </div>

        {showGeoAccordion && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-1 animate-fade-in">
            {/* Provincia */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-slate-300 uppercase tracking-wider block">Provincia</label>
              <select
                value={selProvince}
                onChange={(e) => {
                  setSelProvince(e.target.value);
                  setSelCanton("TODAS");
                  setSelParroquia("TODAS");
                  setSelSector("TODAS");
                }}
                className="w-full bg-slate-950 border border-slate-700 hover:border-slate-500 focus:border-amber-500 rounded-xl px-3.5 py-3 text-xs text-white font-medium focus:outline-none focus:ring-1 focus:ring-amber-500 shadow-inner transition-all cursor-pointer"
              >
                <option value="TODAS">Provincia: Todas</option>
                {allProvinces.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            {/* Cantón */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-slate-300 uppercase tracking-wider block">Cantón</label>
              <select
                value={selCanton}
                onChange={(e) => {
                  setSelCanton(e.target.value);
                  setSelParroquia("TODAS");
                  setSelSector("TODAS");
                }}
                disabled={selProvince === "TODAS" || allCantons.length === 0}
                className="w-full bg-slate-950 border border-slate-700 hover:border-slate-500 focus:border-amber-500 rounded-xl px-3.5 py-3 text-xs text-white font-medium focus:outline-none focus:ring-1 focus:ring-amber-500 shadow-inner transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <option value="TODAS">Cantón: Todos</option>
                {allCantons.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Parroquia */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-slate-300 uppercase tracking-wider block">Parroquia / Localidad</label>
              <select
                value={selParroquia}
                onChange={(e) => {
                  setSelParroquia(e.target.value);
                  setSelSector("TODAS");
                }}
                disabled={selCanton === "TODAS" || allParroquias.length === 0}
                className="w-full bg-slate-950 border border-slate-700 hover:border-slate-500 focus:border-amber-500 rounded-xl px-3.5 py-3 text-xs text-white font-medium focus:outline-none focus:ring-1 focus:ring-amber-500 shadow-inner transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <option value="TODAS">Parroquia: Todas</option>
                {allParroquias.map(pa => (
                  <option key={pa} value={pa}>{pa}</option>
                ))}
              </select>
            </div>

            {/* Sector */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-slate-300 uppercase tracking-wider block">Sector / Barrio</label>
              <select
                value={selSector}
                onChange={(e) => setSelSector(e.target.value)}
                disabled={selParroquia === "TODAS" || allSectors.length === 0}
                className="w-full bg-slate-950 border border-slate-700 hover:border-slate-500 focus:border-amber-500 rounded-xl px-3.5 py-3 text-xs text-white font-medium focus:outline-none focus:ring-1 focus:ring-amber-500 shadow-inner transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <option value="TODAS">Sector: Todos</option>
                {allSectors.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Specialty Selector Pills */}
      {specialties.length > 1 && (
        <div className="flex flex-col gap-2.5 pt-2">
          <span className="text-[11px] uppercase tracking-wider text-slate-300 font-extrabold text-center">
            Filtrar por Especialidad
          </span>
          <div className="flex flex-wrap justify-center gap-2">
            {specialties.map(spec => (
              <button
                key={spec}
                onClick={() => setSelectedSpecialty(spec)}
                className={`px-4 py-2.5 rounded-2xl text-xs font-bold border transition duration-200 shadow-sm cursor-pointer ${
                  selectedSpecialty === spec 
                    ? "bg-gradient-to-r from-amber-500 to-orange-600 border-amber-400 text-white shadow-lg shadow-amber-500/20 font-black scale-[1.03]"
                    : "bg-slate-900 border-slate-700 text-slate-200 hover:text-white hover:border-amber-400 hover:bg-slate-800"
                }`}
              >
                {spec}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Matched Dishes Results */}
      {apiDishes.length > 0 && (
        <div className="space-y-4 pt-4 max-w-4xl mx-auto">
          <h4 className="text-xs uppercase font-extrabold tracking-wider text-amber-400 flex items-center gap-2">
            <Tag className="h-4 w-4" /> Platillos Coincidentes ({apiDishes.length})
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {apiDishes.map((dish) => (
              <a
                key={dish.id}
                href={`/${dish.restaurantSlug}`}
                className="bg-slate-900/95 border border-slate-700/80 hover:border-amber-500/60 rounded-2xl p-4 flex gap-4 transition group backdrop-blur-xl shadow-lg"
              >
                {dish.imageUrl ? (
                  <img src={getPrimaryDishImage(dish.imageUrl) || dish.imageUrl} alt={dish.name} className="h-16 w-16 rounded-xl object-cover border border-slate-700 shrink-0" />
                ) : (
                  <div className="h-16 w-16 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400 shrink-0">
                    <UtensilsCrossed className="h-6 w-6" />
                  </div>
                )}
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase text-amber-400">{dish.restaurantName}</span>
                  <h5 className="font-extrabold text-white text-sm group-hover:text-amber-400 transition">{dish.name}</h5>
                  <p className="text-emerald-400 text-xs font-black">${Number(dish.price).toFixed(2)}</p>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Business Cards Grouped Grid */}
      <div className="space-y-6 pt-4">
        <div className="flex items-center justify-between flex-wrap gap-3 max-w-5xl mx-auto px-1">
          <h3 className="text-sm font-black uppercase tracking-wider text-slate-200 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-400" />
            Restaurantes Disponibles ({filtered.length})
          </h3>

          {/* Sorting controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSortBy("featured")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                sortBy === "featured"
                  ? "bg-amber-500 border-amber-400 text-slate-950 font-black shadow-md shadow-amber-500/20"
                  : "bg-slate-900 border-slate-700 text-slate-300 hover:text-white hover:border-slate-500"
              }`}
            >
              ⭐ Predeterminado
            </button>
            <button
              onClick={() => {
                if (!userLocation) {
                  handleToggleGeoLocation();
                } else {
                  setSortBy("distance");
                }
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 cursor-pointer ${
                sortBy === "distance"
                  ? "bg-emerald-600 border-emerald-400 text-white font-black shadow-md shadow-emerald-600/30"
                  : "bg-slate-900 border-slate-700 text-slate-300 hover:text-white hover:border-slate-500"
              }`}
            >
              <Navigation className="h-3.5 w-3.5 text-emerald-400" />
              <span>📍 Más Cercanos</span>
            </button>
          </div>
        </div>
        
        {filtered.length === 0 ? (
          <div className="text-center py-16 bg-slate-900/95 border border-slate-700/80 rounded-3xl p-6 max-w-xl mx-auto space-y-4 shadow-2xl backdrop-blur-xl">
            <UtensilsCrossed className="h-10 w-10 text-slate-500 mx-auto mb-1" />
            <p className="text-slate-200 text-sm font-semibold">No encontramos negocios para <span className="text-amber-400 font-bold">"{searchTerm}"</span>.</p>
            {apiSuggestions && (
              <div className="pt-2 space-y-2 border-t border-slate-800">
                <span className="text-xs font-bold text-slate-400 block uppercase">Te recomendamos probar con:</span>
                <div className="flex flex-wrap justify-center gap-2">
                  {apiSuggestions.availableCategories?.map((cat: string) => (
                    <button
                      key={cat}
                      onClick={() => setSearchTerm(cat)}
                      className="px-3 py-1.5 bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs rounded-xl font-bold hover:bg-amber-500/30 transition cursor-pointer"
                    >
                      {cat}
                    </button>
                  ))}
                  {apiSuggestions.availableCities?.map((city: string) => (
                    <button
                      key={city}
                      onClick={() => setSearchTerm(city)}
                      className="px-3 py-1.5 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs rounded-xl font-bold hover:bg-emerald-500/30 transition cursor-pointer"
                    >
                      {city}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {filtered.map(res => (
              <a
                key={res.id}
                href={`/${res.slug}`}
                className="group bg-slate-900/95 border border-slate-700/80 hover:border-amber-400/80 rounded-3xl p-6 flex flex-col justify-between hover:bg-slate-850 hover:shadow-[0_16px_36px_rgba(0,0,0,0.7)] shadow-xl backdrop-blur-xl transition-all duration-300 transform hover:-translate-y-1"
              >
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <SmartLogo
                      src={res.logoUrl}
                      alt={res.name}
                      name={res.name}
                      themeColor={res.themeColor}
                      className="h-14 w-14 rounded-2xl object-cover border-2 border-slate-700 shadow-md shrink-0"
                    />
                    <div className="min-w-0">
                      <h4 className="font-extrabold text-white text-base group-hover:text-amber-400 transition duration-200 truncate">
                        {res.name}
                      </h4>
                      {renderLocalityBadge(res.locality, res.distanceKm)}
                    </div>
                  </div>

                  {res.description && (
                    <p className="text-slate-300 text-xs leading-relaxed line-clamp-3 font-normal">
                      {res.description}
                    </p>
                  )}
                </div>

                <div className="mt-5 pt-4 border-t border-slate-800 flex justify-between items-center text-xs gap-2">
                  <span className="font-semibold text-slate-400 text-[11px]">Especialidad:</span>
                  <span className="font-bold text-amber-300 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-700/80 truncate text-[11px] shadow-inner">
                    {res.specialty || "Carta Variada"}
                  </span>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
