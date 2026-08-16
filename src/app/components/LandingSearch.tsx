"use client";

import { useState } from "react";
import { Search, MapPin, Sparkles, UtensilsCrossed } from "lucide-react";
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

export function LandingSearch({ restaurants }: { restaurants: RestaurantListItem[] }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>("TODAS");
  
  // Advanced location states
  const [selProvince, setSelProvince] = useState("TODAS");
  const [selCanton, setSelCanton] = useState("TODAS");
  const [selParroquia, setSelParroquia] = useState("TODAS");
  const [selSector, setSelSector] = useState("TODAS");

  const parsedRestaurants = restaurants.map(r => ({
    ...r,
    parsedLoc: parseLocality(r.locality)
  }));

  // Unique lists for cascade selector based on current selections (all Ecuador options)
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
      (res.description && res.description.toLowerCase().includes(searchTerm.toLowerCase()));
    
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
        {/* Glow backdrop effect */}
        <div className="absolute -inset-0.5 bg-gradient-to-r from-red-600 to-amber-500 rounded-3xl blur opacity-25 group-focus-within:opacity-50 transition duration-300"></div>
        
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-slate-400 group-focus-within:text-red-500 transition-colors duration-250" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Busca comida, especialidad, bar o restaurante..."
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

      {/* Filtros de Ubicación Avanzados */}
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

      {/* Business Cards Grouped Grid */}
      <div className="space-y-6 pt-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-450 flex items-center justify-center gap-2">
          <Sparkles className="h-4 w-4 text-amber-500" />
          Negocios Registrados ({filtered.length})
        </h3>
        
        {filtered.length === 0 ? (
          <div className="text-center py-16 bg-slate-900/20 border border-slate-900/40 rounded-3xl p-6">
            <UtensilsCrossed className="h-10 w-10 text-slate-700 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">No se encontraron negocios con esos filtros.</p>
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
                      {res.locality && (() => {
                        const parsed = parseLocality(res.locality);
                        const displayLoc = [parsed.sector, parsed.parroquia, parsed.canton, parsed.province]
                          .filter(Boolean)
                          .join(", ");
                        return (
                          <div className="flex items-center gap-1 text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                            <MapPin className="h-3.5 w-3.5 text-slate-550 shrink-0" />
                            {displayLoc || res.locality}
                          </div>
                        );
                      })()}
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
