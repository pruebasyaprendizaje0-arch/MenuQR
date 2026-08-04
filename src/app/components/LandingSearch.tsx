"use client";

import { useState } from "react";
import { Search, MapPin, Sparkles, UtensilsCrossed } from "lucide-react";

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

export function LandingSearch({ restaurants }: { restaurants: RestaurantListItem[] }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLocality, setSelectedLocality] = useState<string>("TODAS");
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>("TODAS");

  // Predefined Santa Elena localities to guarantee they are selectable, combined with dynamic DB localities
  const santaElenaLocalities = [
    "Salinas",
    "La Libertad",
    "Montañita",
    "Olón",
    "Manglaralto",
    "Ballenita",
    "Ayangue"
  ];

  const dbLocalities = restaurants.map(r => r.locality).filter(Boolean) as string[];
  const allLocalities = Array.from(new Set([
    "TODAS",
    ...santaElenaLocalities,
    ...dbLocalities
  ]));

  const specialties = ["TODAS", ...Array.from(new Set(restaurants.map(r => r.specialty).filter(Boolean))) as string[]];

  // Filter restaurants
  const filtered = restaurants.filter(res => {
    const matchesSearch = 
      res.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (res.specialty && res.specialty.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (res.description && res.description.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesLocality = selectedLocality === "TODAS" || 
      (res.locality && res.locality.toLowerCase().includes(selectedLocality.toLowerCase())) ||
      (res.locality && selectedLocality.toLowerCase().includes(res.locality.toLowerCase()));
      
    const matchesSpecialty = selectedSpecialty === "TODAS" || res.specialty === selectedSpecialty;

    return matchesSearch && matchesLocality && matchesSpecialty;
  });

  return (
    <div className="w-full space-y-8">
      {/* Search Input Bar */}
      <div className="max-w-xl mx-auto w-full relative">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-slate-505" />
        </div>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Busca comida, especialidad, bar o restaurante..."
          className="w-full bg-slate-900/60 border border-slate-800 focus:border-red-500 focus:ring-1 focus:ring-red-500 block pl-12 pr-4 py-4.5 rounded-3xl text-white placeholder-slate-550 focus:outline-none sm:text-base shadow-2xl transition-all duration-200"
        />
      </div>

      {/* Locality Selector Pills */}
      {allLocalities.length > 1 && (
        <div className="flex flex-col gap-2">
          <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold text-center">Filtrar por Localidad</span>
          <div className="flex flex-wrap justify-center gap-2 max-w-2xl mx-auto">
            {allLocalities.map(loc => (
              <button
                key={loc}
                onClick={() => setSelectedLocality(loc)}
                className={`px-4 py-2 rounded-2xl text-xs font-bold border transition duration-200 ${
                  selectedLocality === loc 
                    ? "bg-gradient-to-r from-red-600 to-amber-600 border-transparent text-white shadow-lg"
                    : "bg-slate-900/50 border-slate-850 text-slate-400 hover:text-white hover:border-slate-700"
                }`}
              >
                {loc}
              </button>
            ))}
          </div>
        </div>
      )}

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
                    : "bg-slate-900/50 border-slate-850 text-slate-400 hover:text-white hover:border-slate-700"
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
                className="group bg-slate-900/40 border border-slate-850 hover:border-slate-700 rounded-3xl p-5 flex flex-col justify-between hover:bg-slate-900/60 hover:shadow-[0_10px_30px_rgba(239,68,68,0.05)] transition-all duration-300 transform hover:scale-[1.01]"
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
                      {res.locality && (
                        <div className="flex items-center gap-1 text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                          <MapPin className="h-3.5 w-3.5 text-slate-550 shrink-0" />
                          {res.locality}
                        </div>
                      )}
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
