"use client";

import { useState, useEffect, useTransition } from "react";
import { Search, MapPin, Sparkles, UtensilsCrossed, ArrowRight, Tag, DollarSign, RefreshCw } from "lucide-react";
import { ecuadorData, parishData, communeData } from "@/lib/ecuador";

type RestaurantListItem = {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  specialty: string | null;
  locality: string | null;
  description: string | null;
  themeColor: string;
};

interface ParsedLocality {
  province: string;
  canton: string;
  parroquia: string;
  sector: string;
}

function parseLocality(localityStr: string | null): ParsedLocality {
  if (!localityStr) {
    return { province: "", canton: "", parroquia: "", sector: "" };
  }
  const parts = localityStr.split(" | ");
  if (parts.length >= 2) {
    return {
      province: parts[0] || "",
      canton: parts[1] || "",
      parroquia: parts[2] || "",
      sector: parts[3] || ""
    };
  }
  
  const oldParts = localityStr.split(", ");
  if (oldParts.length === 2) {
    return {
      province: oldParts[1] || "",
      canton: oldParts[0] || "",
      parroquia: oldParts[0] || "",
      sector: ""
    };
  }
  
  return {
    province: "",
    canton: "",
    parroquia: localityStr,
    sector: ""
  };
}

function renderLocalityBadge(locality: string | null) {
  if (!locality) return null;
  const parsed = parseLocality(locality);
  const displayLoc = [parsed.sector, parsed.parroquia, parsed.canton, parsed.province]
    .filter(Boolean)
    .join(", ");
  return (
    <div className="flex items-center gap-1 text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
      <MapPin className="h-3.5 w-3.5 text-slate-500 shrink-0" />
      {displayLoc || locality}
    </div>
  );
}

export function LandingSearch({ restaurants }: { restaurants: RestaurantListItem[] }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>("TODAS");
  
  // Advanced location states
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

  const parsedRestaurants = restaurants.map(r => ({
    ...r,
    parsedLoc: parseLocality(r.locality)
  }));

  const allProvinces = Object.keys(ecuadorData).sort();
  const allCantons = selProvince !== "TODAS" ? (ecuadorData[selProvince] || []).sort() : [];
  const allParroquias = selCanton !== "TODAS"
    ? (parishData[selCanton] && parishData[selCanton].length > 0
        ? parishData[selCanton]
        : Array.from(new Set(
            parsedRestaurants
              .filter(r => r.parsedLoc.canton.toLowerCase() === selCanton.toLowerCase())
              .map(r => r.parsedLoc.parroquia)
              .filter(Boolean)
          ))
      ).sort()
    : [];

  const allSectors = selParroquia !== "TODAS"
    ? (communeData[selParroquia] && communeData[selParroquia].length > 0
        ? communeData[selParroquia]
        : Array.from(new Set(
            parsedRestaurants
              .filter(r => r.parsedLoc.parroquia.toLowerCase() === selParroquia.toLowerCase())
              .map(r => r.parsedLoc.sector)
              .filter(Boolean)
          ))
      ).sort()
    : [];

  const specialties = ["TODAS", ...Array.from(new Set(restaurants.map(r => r.specialty).filter(Boolean))) as string[]];

  // Filter restaurants
  const filtered = parsedRestaurants.filter(res => {
    const matchesSearch = 
      res.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (res.specialty && res.specialty.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (res.description && res.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (res.locality && res.locality.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesProvince = selProvince === "TODAS" || res.parsedLoc.province.toLowerCase() === selProvince.toLowerCase();
    const matchesCanton = selCanton === "TODAS" || res.parsedLoc.canton.toLowerCase() === selCanton.toLowerCase();
    const matchesParroquia = selParroquia === "TODAS" || res.parsedLoc.parroquia.toLowerCase() === selParroquia.toLowerCase();
    const matchesSector = selSector === "TODAS" || res.parsedLoc.sector.toLowerCase() === selSector.toLowerCase();
      
    const matchesSpecialty = selectedSpecialty === "TODAS" || res.specialty === selectedSpecialty;

    return matchesSearch && matchesProvince && matchesCanton && matchesParroquia && matchesSector && matchesSpecialty;
  });

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (filtered.length > 0) {
      window.location.href = `/${filtered[0].slug}`;
    }
  };

  return (
    <div className="w-full space-y-8">
      {/* Search Input Bar */}
      <form onSubmit={handleSearchSubmit} className="max-w-xl mx-auto w-full relative group">
        <div className="absolute -inset-0.5 bg-gradient-to-r from-red-600 to-amber-500 rounded-3xl blur opacity-25 group-focus-within:opacity-50 transition duration-300"></div>
        
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            {isSearching ? (
              <RefreshCw className="h-5 w-5 text-amber-500 animate-spin" />
            ) : (
              <Search className="h-5 w-5 text-slate-400 group-focus-within:text-red-500 transition-colors duration-250" />
            )}
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Ej: pizza en Manta, empanadas en Montañita, pasta..."
            className="w-full bg-slate-950 border border-slate-800/80 focus:border-red-500 focus:ring-1 focus:ring-red-500 block pl-12 pr-12 py-4 rounded-3xl text-white placeholder-slate-500 focus:outline-none sm:text-base shadow-2xl transition-all duration-200"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm("")}
              className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-500 hover:text-white transition-colors"
              title="Limpiar búsqueda"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </form>

      {/* Popular Trend Badges */}
      <div className="flex items-center justify-center flex-wrap gap-2 pt-1">
        <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mr-1 flex items-center gap-1">
          <Sparkles className="h-3 w-3 text-amber-500" /> Búsquedas populares:
        </span>
        {["Pizza en Manta", "Empanadas en Montañita", "Pastas", "Mariscos", "Manta"].map((badge) => (
          <button
            key={badge}
            onClick={() => setSearchTerm(badge)}
            className="px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-[11px] font-semibold text-slate-300 hover:text-white hover:border-amber-500/50 hover:bg-slate-800 transition"
          >
            {badge}
          </button>
        ))}
      </div>

      {/* Advanced Location Filters */}
      <div className="bg-transparent border border-white/5 rounded-3xl p-6 backdrop-blur-md max-w-4xl mx-auto space-y-4 shadow-xl">
        <h4 className="text-xs uppercase font-extrabold tracking-wider text-slate-400 text-center mb-2 flex items-center justify-center gap-2">
          <MapPin className="h-4 w-4 text-red-500 animate-bounce" />
          Filtrar por Ubicación Geográfica (Ecuador)
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {/* Provincia */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">Provincia</label>
            <select
              value={selProvince}
              onChange={(e) => {
                setSelProvince(e.target.value);
                setSelCanton("TODAS");
                setSelParroquia("TODAS");
                setSelSector("TODAS");
              }}
              className="w-full bg-slate-950 border border-slate-800 focus:border-red-500 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none transition-all cursor-pointer"
            >
              <option value="TODAS">Provincia: Todas</option>
              {allProvinces.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          {/* Cantón */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">Cantón</label>
            <select
              value={selCanton}
              onChange={(e) => {
                setSelCanton(e.target.value);
                setSelParroquia("TODAS");
                setSelSector("TODAS");
              }}
              disabled={selProvince === "TODAS" || allCantons.length === 0}
              className="w-full bg-slate-950 border border-slate-800 focus:border-red-500 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <option value="TODAS">Cantón: Todos</option>
              {allCantons.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Parroquia */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">Parroquia / Localidad</label>
            <select
              value={selParroquia}
              onChange={(e) => {
                setSelParroquia(e.target.value);
                setSelSector("TODAS");
              }}
              disabled={selCanton === "TODAS" || allParroquias.length === 0}
              className="w-full bg-slate-950 border border-slate-800 focus:border-red-500 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <option value="TODAS">Parroquia: Todas</option>
              {allParroquias.map(pa => (
                <option key={pa} value={pa}>{pa}</option>
              ))}
            </select>
          </div>

          {/* Sector */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">Sector / Barrio</label>
            <select
              value={selSector}
              onChange={(e) => setSelSector(e.target.value)}
              disabled={selParroquia === "TODAS" || allSectors.length === 0}
              className="w-full bg-slate-950 border border-slate-800 focus:border-red-500 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <option value="TODAS">Sector: Todos</option>
              {allSectors.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Specialty Selector Pills */}
      {specialties.length > 1 && (
        <div className="flex flex-col gap-2 pt-2">
          <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold text-center">Filtrar por Especialidad</span>
          <div className="flex flex-wrap justify-center gap-2">
            {specialties.map(spec => (
              <button
                key={spec}
                onClick={() => setSelectedSpecialty(spec)}
                className={`px-4 py-2 rounded-2xl text-xs font-bold border transition duration-200 ${
                  selectedSpecialty === spec 
                    ? "bg-gradient-to-r from-amber-650 to-orange-600 border-transparent text-white shadow-lg"
                    : "bg-transparent border-white/5 text-slate-400 hover:text-white hover:border-white/10"
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
                className="bg-slate-900/60 border border-slate-800 hover:border-amber-500/50 rounded-2xl p-4 flex gap-4 transition group"
              >
                {dish.imageUrl ? (
                  <img src={dish.imageUrl} alt={dish.name} className="h-16 w-16 rounded-xl object-cover border border-slate-800 shrink-0" />
                ) : (
                  <div className="h-16 w-16 rounded-xl bg-slate-800 flex items-center justify-center text-slate-500 shrink-0">
                    <UtensilsCrossed className="h-6 w-6" />
                  </div>
                )}
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase text-amber-500">{dish.restaurantName}</span>
                  <h5 className="font-extrabold text-white text-sm group-hover:text-amber-400 transition">{dish.name}</h5>
                  <p className="text-slate-400 text-xs font-bold text-emerald-400">${Number(dish.price).toFixed(2)}</p>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Business Cards Grouped Grid */}
      <div className="space-y-6 pt-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-450 flex items-center justify-center gap-2">
          <Sparkles className="h-4 w-4 text-amber-500" />
          Negocios Registrados ({filtered.length})
        </h3>
        
        {filtered.length === 0 ? (
          <div className="text-center py-16 bg-slate-900/20 border border-slate-900/40 rounded-3xl p-6 max-w-xl mx-auto space-y-4">
            <UtensilsCrossed className="h-10 w-10 text-slate-700 mx-auto mb-1" />
            <p className="text-slate-400 text-sm font-semibold">No encontramos negocios para <span className="text-amber-400 font-bold">"{searchTerm}"</span>.</p>
            {apiSuggestions && (
              <div className="pt-2 space-y-2 border-t border-slate-800/80">
                <span className="text-xs font-bold text-slate-500 block uppercase">Te recomendamos probar con:</span>
                <div className="flex flex-wrap justify-center gap-2">
                  {apiSuggestions.availableCategories?.map((cat: string) => (
                    <button
                      key={cat}
                      onClick={() => setSearchTerm(cat)}
                      className="px-3 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs rounded-xl font-bold hover:bg-amber-500/20 transition"
                    >
                      {cat}
                    </button>
                  ))}
                  {apiSuggestions.availableCities?.map((city: string) => (
                    <button
                      key={city}
                      onClick={() => setSearchTerm(city)}
                      className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs rounded-xl font-bold hover:bg-emerald-500/20 transition"
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
                className="group bg-transparent border border-white/5 hover:border-white/20 rounded-3xl p-5 flex flex-col justify-between hover:bg-white/5 hover:shadow-[0_10px_30px_rgba(239,68,68,0.05)] transition-all duration-300 transform hover:scale-[1.01]"
              >
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    {res.logoUrl ? (
                      <img
                        src={res.logoUrl}
                        alt={res.name}
                        className="h-14 w-14 rounded-2xl object-cover border border-slate-800"
                      />
                    ) : (
                      <div
                        className="h-14 w-14 rounded-2xl flex items-center justify-center font-black text-white text-lg border border-slate-850"
                        style={{ backgroundColor: res.themeColor }}
                      >
                        {res.name.charAt(0)}
                      </div>
                    )}
                    <div>
                      <h4 className="font-extrabold text-white text-base group-hover:text-amber-500 transition duration-200">
                        {res.name}
                      </h4>
                      {renderLocalityBadge(res.locality)}
                    </div>
                  </div>

                  {res.description && (
                    <p className="text-slate-400 text-xs leading-relaxed line-clamp-2">
                      {res.description}
                    </p>
                  )}
                </div>

                {res.specialty && (
                  <div className="mt-4 pt-4 border-t border-slate-900 flex justify-between items-center text-xs">
                    <span className="font-medium text-slate-500">Especialidad:</span>
                    <span className="font-bold text-slate-300 bg-slate-950 px-2.5 py-1 rounded-xl border border-slate-850">
                      {res.specialty}
                    </span>
                  </div>
                )}
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
