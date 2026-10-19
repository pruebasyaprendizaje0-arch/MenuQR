"use client";

import React, { useState, Suspense } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useSearchParams } from "next/navigation";
import { createGoogleBusinessAction } from "@/lib/onboarding-actions";
import {
  UtensilsCrossed,
  ShoppingBag,
  Wrench,
  Calendar,
  Trees,
  Package,
  Building,
  MapPin,
  Sparkles,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { ecuadorData, parishData } from "@/lib/ecuador";

const VERTICALS = [
  {
    id: "RESTAURANT",
    title: "Restaurante / Bar / Cafetería",
    desc: "Menú QR interactivo, comandas en mesa, delivery por WhatsApp",
    icon: UtensilsCrossed,
    color: "from-red-500 to-amber-500",
    border: "border-red-500/50",
    bg: "bg-red-500/10",
    badge: "text-red-400 bg-red-500/10",
  },
  {
    id: "RETAIL",
    title: "Tienda / Catálogo Comercial",
    desc: "Venta de licores, ropa o calzado con tallas, colores y carrito",
    icon: ShoppingBag,
    color: "from-amber-400 to-orange-500",
    border: "border-amber-500/50",
    bg: "bg-amber-500/10",
    badge: "text-amber-400 bg-amber-500/10",
  },
  {
    id: "SERVICES",
    title: "Servicios Técnicos",
    desc: "Cotizador express con subida de fotos del problema y GPS",
    icon: Wrench,
    color: "from-cyan-400 to-blue-500",
    border: "border-cyan-500/50",
    bg: "bg-cyan-500/10",
    badge: "text-cyan-400 bg-cyan-500/10",
  },
  {
    id: "CITAS",
    title: "Citas y Turnos 24/7",
    desc: "Agenda online para barberías, spas, consultorios médicos",
    icon: Calendar,
    color: "from-purple-400 to-indigo-500",
    border: "border-purple-500/50",
    bg: "bg-purple-500/10",
    badge: "text-purple-400 bg-purple-500/10",
  },
  {
    id: "RESERVAS",
    title: "Hospedaje / Cabañas / Glamping",
    desc: "Motor de reservas directas por noches y check-in",
    icon: Trees,
    color: "from-emerald-400 to-teal-500",
    border: "border-emerald-500/50",
    bg: "bg-emerald-500/10",
    badge: "text-emerald-400 bg-emerald-500/10",
  },
  {
    id: "GENERAL_CATALOG",
    title: "Catálogo General / B2B",
    desc: "Distribuidoras, ferreterías, catálogos industriales",
    icon: Package,
    color: "from-blue-400 to-indigo-600",
    border: "border-blue-500/50",
    bg: "bg-blue-500/10",
    badge: "text-blue-400 bg-blue-500/10",
  },
];

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-amber-400 via-orange-500 to-red-500 hover:from-amber-300 hover:to-red-400 text-slate-950 font-black text-sm uppercase tracking-wider shadow-2xl shadow-amber-500/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
    >
      {pending ? (
        <span>Creando tu negocio...</span>
      ) : (
        <>
          <span>Crear mi Negocio y Abrir Panel Admin</span>
          <ArrowRight className="w-4 h-4 text-slate-950" />
        </>
      )}
    </button>
  );
}

function OnboardingContent() {
  const searchParams = useSearchParams();
  const initialType = searchParams.get("type")?.toUpperCase() || "RESTAURANT";

  const [selectedVertical, setSelectedVertical] = useState<string>(
    VERTICALS.some((v) => v.id === initialType) ? initialType : "RESTAURANT"
  );
  const [province, setProvince] = useState<string>("");
  const [canton, setCanton] = useState<string>("");
  const [parroquia, setParroquia] = useState<string>("");
  const [state, formAction] = useActionState(createGoogleBusinessAction, null);

  const cantones = province ? (ecuadorData as any)[province] || [] : [];
  const parroquias = canton ? (parishData as any)[canton] || [] : [];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background Glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-[140px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-red-600/10 rounded-full blur-[140px] pointer-events-none"></div>

      <div className="sm:mx-auto sm:w-full sm:max-w-2xl relative z-10 text-center mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold mb-4">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Cuenta de Google Conectada</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
          Configura tu Negocio en <span className="text-amber-400">10 Segundos</span>
        </h1>
        <p className="mt-2 text-xs sm:text-sm text-slate-400 max-w-md mx-auto">
          Ingresa el nombre y tipo de tu negocio. Podrás personalizar colores, fotos y productos desde tu Panel Admin.
        </p>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-2xl relative z-10">
        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 shadow-2xl rounded-3xl p-6 sm:p-8">
          <form action={formAction} className="space-y-6">
            <input type="hidden" name="businessType" value={selectedVertical} />

            {/* Paso 1: Nombre del Negocio */}
            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-300 uppercase tracking-wider block">
                1. Nombre de tu Negocio, Tienda o Restaurante *
              </label>
              <div className="relative">
                <Building className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  name="restaurantName"
                  required
                  placeholder="ej: Sumeria Liquors / La Parrilla Criolla"
                  className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl text-white text-sm focus:outline-none"
                />
              </div>
            </div>

            {/* Paso 2: Selección de Vertical */}
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-300 uppercase tracking-wider block">
                2. Selecciona el Giro de tu Negocio *
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {VERTICALS.map((v) => {
                  const Icon = v.icon;
                  const isSelected = selectedVertical === v.id;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setSelectedVertical(v.id)}
                      className={`p-3.5 rounded-2xl border text-left flex items-start gap-3 transition-all cursor-pointer ${
                        isSelected
                          ? `bg-slate-850 ${v.border} shadow-lg ring-1 ring-amber-500/50`
                          : "bg-slate-950/60 border-slate-800/80 hover:border-slate-700"
                      }`}
                    >
                      <div className={`p-2 rounded-xl bg-gradient-to-tr ${v.color} text-slate-950 shrink-0`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-white truncate">{v.title}</h4>
                        <p className="text-[11px] text-slate-400 leading-tight mt-0.5 line-clamp-2">
                          {v.desc}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Paso 3: Ubicación en Ecuador */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <label className="text-xs font-black text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-amber-400" />
                <span>3. Ubicación Principal del Negocio (Ecuador) *</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-400 block mb-1">Provincia *</label>
                  <select
                    name="province"
                    required
                    value={province}
                    onChange={(e) => {
                      setProvince(e.target.value);
                      setCanton("");
                      setParroquia("");
                    }}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-amber-500"
                  >
                    <option value="">Selecciona Provincia</option>
                    {Object.keys(ecuadorData).map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-400 block mb-1">Cantón / Ciudad *</label>
                  <select
                    name="canton"
                    required
                    value={canton}
                    disabled={!province}
                    onChange={(e) => {
                      setCanton(e.target.value);
                      setParroquia("");
                    }}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-amber-500 disabled:opacity-50"
                  >
                    <option value="">Selecciona Cantón</option>
                    {cantones.map((c: string) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {parroquias.length > 0 && (
                <div className="pt-1">
                  <label className="text-[11px] font-bold text-slate-400 block mb-1">
                    Parroquia / Sector (Opcional)
                  </label>
                  <select
                    name="parroquia"
                    value={parroquia}
                    onChange={(e) => setParroquia(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-amber-500"
                  >
                    <option value="">Selecciona Parroquia</option>
                    {parroquias.map((pa: string) => (
                      <option key={pa} value={pa}>
                        {pa}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {(state as any)?.error && (
              <div className="bg-red-500/10 border border-red-500/30 p-3 rounded-xl text-xs text-red-400 font-medium">
                ⚠️ {(state as any).error}
              </div>
            )}

            <SubmitButton />
          </form>
        </div>
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">Cargando...</div>}>
      <OnboardingContent />
    </Suspense>
  );
}
