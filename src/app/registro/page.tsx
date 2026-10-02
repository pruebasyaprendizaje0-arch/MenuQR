"use client";

import { useState, useEffect, Suspense } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useSearchParams } from "next/navigation";
import { registerUserAction } from "@/lib/actions";
import { KeyRound, UtensilsCrossed, Mail, User, Building, MapPin, Store, ShoppingBag, Wrench, Package } from "lucide-react";
import Link from "next/link";
import { ecuadorData, parishData, communeData } from "@/lib/ecuador";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-lg text-sm font-bold text-slate-950 bg-gradient-to-r from-amber-400 via-amber-300 to-orange-400 hover:from-amber-300 hover:to-orange-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 transition-all duration-200 disabled:opacity-50"
    >
      {pending ? "Creando cuenta..." : "Crear mi Cuenta Demo Gratis"}
    </button>
  );
}

function RegisterForm() {
  const searchParams = useSearchParams();
  const typeParam = searchParams.get("type")?.toUpperCase() || "";

  const initialType = ["RETAIL", "SERVICES", "GENERAL_CATALOG", "CATALOG"].includes(typeParam)
    ? (typeParam === "CATALOG" ? "RETAIL" : typeParam)
    : "RESTAURANT";

  const [businessType, setBusinessType] = useState<string>(initialType);
  const [state, formAction] = useActionState(registerUserAction, null);
  const [province, setProvince] = useState("");
  const [canton, setCanton] = useState("");
  const [parroquia, setParroquia] = useState("");
  const [sector, setSector] = useState("");

  const isGastro = businessType === "RESTAURANT";

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-600/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-orange-600/10 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="flex justify-center">
          <div className="h-16 w-16 bg-gradient-to-tr from-amber-500 to-orange-500 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/20">
            {isGastro ? (
              <UtensilsCrossed className="h-8 w-8 text-slate-950" />
            ) : (
              <ShoppingBag className="h-8 w-8 text-slate-950" />
            )}
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-black text-white tracking-tight">
          MenuQR <span className="text-amber-400">Pro</span>
        </h2>
        <p className="mt-2 text-center text-sm text-slate-400 font-medium">
          {isGastro
            ? "Registra tu cuenta y crea tu menú digital hoy"
            : "Registra tu cuenta y crea tu catálogo digital interactivo hoy"}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10 px-4 sm:px-0">
        <div className="bg-slate-900/60 backdrop-blur-xl py-8 px-4 border border-slate-800/80 shadow-2xl rounded-2xl sm:px-10">
          <form action={formAction} className="space-y-5">
            {/* Selector de Tipo de Negocio */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Tipo de Negocio o Actividad:
              </label>
              <div className="grid grid-cols-2 gap-2 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setBusinessType("RESTAURANT")}
                  className={`p-3 rounded-xl border transition-all text-left flex items-center gap-2 ${
                    businessType === "RESTAURANT"
                      ? "bg-red-500/20 border-red-500 text-white font-bold"
                      : "bg-slate-950/80 border-slate-800 text-slate-400 hover:border-slate-700"
                  }`}
                >
                  <UtensilsCrossed className="w-4 h-4 text-red-400 shrink-0" />
                  <span>Restaurante / Bar</span>
                </button>
                <button
                  type="button"
                  onClick={() => setBusinessType("RETAIL")}
                  className={`p-3 rounded-xl border transition-all text-left flex items-center gap-2 ${
                    businessType === "RETAIL"
                      ? "bg-amber-500/20 border-amber-500 text-white font-bold"
                      : "bg-slate-950/80 border-slate-800 text-slate-400 hover:border-slate-700"
                  }`}
                >
                  <ShoppingBag className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Tienda / Comercio</span>
                </button>
                <button
                  type="button"
                  onClick={() => setBusinessType("SERVICES")}
                  className={`p-3 rounded-xl border transition-all text-left flex items-center gap-2 ${
                    businessType === "SERVICES"
                      ? "bg-emerald-500/20 border-emerald-500 text-white font-bold"
                      : "bg-slate-950/80 border-slate-800 text-slate-400 hover:border-slate-700"
                  }`}
                >
                  <Wrench className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Servicios / Citas</span>
                </button>
                <button
                  type="button"
                  onClick={() => setBusinessType("GENERAL_CATALOG")}
                  className={`p-3 rounded-xl border transition-all text-left flex items-center gap-2 ${
                    businessType === "GENERAL_CATALOG"
                      ? "bg-blue-500/20 border-blue-500 text-white font-bold"
                      : "bg-slate-950/80 border-slate-800 text-slate-400 hover:border-slate-700"
                  }`}
                >
                  <Package className="w-4 h-4 text-blue-400 shrink-0" />
                  <span>Catálogo General</span>
                </button>
              </div>
              <input type="hidden" name="businessType" value={businessType} />
            </div>

            <div>
              <label htmlFor="name" className="block text-sm font-medium text-slate-300">
                Tu Nombre Completo
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-4 w-4 text-slate-500" />
                </div>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  placeholder="ej: Frank Smith"
                  className="bg-slate-950/80 border border-slate-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 block w-full pl-10 pr-3 py-3 rounded-xl text-white placeholder-slate-500 focus:outline-none sm:text-sm transition-all duration-200"
                />
              </div>
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-300">
                Correo Electrónico
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-4 w-4 text-slate-500" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  placeholder="ej: contacto@tu-negocio.com"
                  className="bg-slate-950/80 border border-slate-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 block w-full pl-10 pr-3 py-3 rounded-xl text-white placeholder-slate-500 focus:outline-none sm:text-sm transition-all duration-200"
                />
              </div>
            </div>

            <div>
              <label htmlFor="restaurantName" className="block text-sm font-medium text-slate-300">
                {isGastro ? "Nombre del Restaurante" : "Nombre de tu Negocio / Empresa"}
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Building className="h-4 w-4 text-slate-500" />
                </div>
                <input
                  id="restaurantName"
                  name="restaurantName"
                  type="text"
                  required
                  placeholder={
                    isGastro
                      ? "ej: Bella Italia Manta"
                      : businessType === "RETAIL"
                      ? "ej: Boutique Elegance / Ferretería Central"
                      : "ej: Consultoría Tech / Farmacia San Juan"
                  }
                  className="bg-slate-950/80 border border-slate-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 block w-full pl-10 pr-3 py-3 rounded-xl text-white placeholder-slate-500 focus:outline-none sm:text-sm transition-all duration-200"
                />
              </div>
            </div>

            <div>
              <label htmlFor="province" className="block text-sm font-medium text-slate-300">
                {isGastro ? "Provincia de tu Restaurante" : "Provincia de tu Negocio"}
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <MapPin className="h-4 w-4 text-slate-500" />
                </div>
                <select
                  id="province"
                  name="province"
                  value={province}
                  onChange={(e) => {
                    setProvince(e.target.value);
                    setCanton("");
                  }}
                  required
                  className="bg-slate-950/80 border border-slate-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 block w-full pl-10 pr-3 py-3 rounded-xl text-white placeholder-slate-500 focus:outline-none sm:text-sm transition-all duration-200 cursor-pointer appearance-none"
                >
                  <option value="">Seleccione provincia...</option>
                  {Object.keys(ecuadorData).map((prov) => (
                    <option key={prov} value={prov}>{prov}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="canton" className="block text-sm font-medium text-slate-300">
                Cantón / Ciudad
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <MapPin className="h-4 w-4 text-slate-500" />
                </div>
                <select
                  id="canton"
                  name="canton"
                  value={canton}
                  onChange={(e) => {
                    setCanton(e.target.value);
                    setParroquia("");
                  }}
                  disabled={!province}
                  required
                  className="bg-slate-950/80 border border-slate-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 block w-full pl-10 pr-3 py-3 rounded-xl text-white placeholder-slate-500 focus:outline-none sm:text-sm transition-all duration-200 cursor-pointer appearance-none disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">Seleccione cantón...</option>
                  {(province ? ecuadorData[province] || [] : []).map((cant) => (
                    <option key={cant} value={cant}>{cant}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="parroquia" className="block text-sm font-medium text-slate-300">
                Parroquia / Localidad
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <MapPin className="h-4 w-4 text-slate-500" />
                </div>
                {canton && parishData[canton] ? (
                  <select
                    id="parroquia"
                    name="parroquia"
                    value={parroquia}
                    onChange={(e) => setParroquia(e.target.value)}
                    required
                    className="bg-slate-950/80 border border-slate-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 block w-full pl-10 pr-3 py-3 rounded-xl text-white placeholder-slate-500 focus:outline-none sm:text-sm transition-all duration-200 cursor-pointer appearance-none"
                  >
                    <option value="">Seleccione parroquia...</option>
                    {parishData[canton].map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    id="parroquia"
                    name="parroquia"
                    type="text"
                    required
                    value={parroquia}
                    onChange={(e) => setParroquia(e.target.value)}
                    placeholder="ej: Tarqui, Salinas, Olón"
                    className="bg-slate-950/80 border border-slate-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 block w-full pl-10 pr-3 py-3 rounded-xl text-white placeholder-slate-500 focus:outline-none sm:text-sm transition-all duration-200"
                  />
                )}
              </div>
            </div>

            <div>
              <label htmlFor="sector" className="block text-sm font-medium text-slate-300">
                Sector / Barrio / Comuna (Opcional)
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <MapPin className="h-4 w-4 text-slate-500" />
                </div>
                {parroquia && communeData[parroquia] ? (
                  <select
                    id="sector"
                    name="sector"
                    value={sector}
                    onChange={(e) => setSector(e.target.value)}
                    className="bg-slate-950/80 border border-slate-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 block w-full pl-10 pr-3 py-3 rounded-xl text-white placeholder-slate-500 focus:outline-none sm:text-sm transition-all duration-200 cursor-pointer appearance-none"
                  >
                    <option value="">Seleccione Comuna / Sector...</option>
                    {communeData[parroquia].map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    id="sector"
                    name="sector"
                    type="text"
                    value={sector}
                    onChange={(e) => setSector(e.target.value)}
                    placeholder="ej: Urdesa, Barbasquillo, Chipipe"
                    className="bg-slate-950/80 border border-slate-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 block w-full pl-10 pr-3 py-3 rounded-xl text-white placeholder-slate-500 focus:outline-none sm:text-sm transition-all duration-200"
                  />
                )}
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-300">
                Contraseña
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <KeyRound className="h-4 w-4 text-slate-500" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  placeholder="••••••••"
                  className="bg-slate-950/80 border border-slate-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 block w-full pl-10 pr-3 py-3 rounded-xl text-white placeholder-slate-500 focus:outline-none sm:text-sm transition-all duration-200"
                />
              </div>
            </div>

            {/* Aceptación de Términos y Políticas (Legislación Ecuatoriana - LOPDP) */}
            <div className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800/90 flex items-start gap-3 transition-colors hover:border-slate-700">
              <div className="flex items-center h-5 mt-0.5">
                <input
                  id="acceptTerms"
                  name="acceptTerms"
                  type="checkbox"
                  required
                  className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-amber-500 focus:ring-offset-slate-950 cursor-pointer accent-amber-500"
                />
              </div>
              <label htmlFor="acceptTerms" className="text-xs text-slate-300 leading-relaxed cursor-pointer select-none">
                He leído y acepto expresamente los{" "}
                <Link href="/terminos" target="_blank" className="text-amber-400 hover:text-amber-300 underline font-semibold transition">
                  Términos y Condiciones
                </Link>{" "}
                y la{" "}
                <Link href="/privacidad" target="_blank" className="text-amber-400 hover:text-amber-300 underline font-semibold transition">
                  Política de Privacidad y Tratamiento de Datos
                </Link>{" "}
                de <span className="text-white font-medium">menuqr.ubicame.cc</span> conforme a la LOPDP y Ley de Comercio Electrónico de Ecuador.
              </label>
            </div>

            <div className="bg-amber-500/5 border border-amber-500/10 rounded-xl p-3 text-[10px] text-amber-400/90 leading-relaxed">
              * Recibirás de forma gratuita una prueba completa del <strong>Plan Digital Pro ($15 USD/mes)</strong> por un período de <strong>30 días (1 mes)</strong> a partir del registro.
            </div>

            {(state as any)?.error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-sm text-red-400">
                {(state as any).error}
              </div>
            )}

            <div>
              <SubmitButton />
            </div>
          </form>

          <div className="mt-6 text-center text-xs text-slate-400 space-y-3">
            <p>
              ¿Ya tienes cuenta?{" "}
              <Link href="/login" className="text-amber-400 hover:text-amber-300 underline font-semibold transition">
                Inicia sesión aquí
              </Link>
            </p>
            <div className="flex justify-center gap-4 text-[11px] text-slate-500 border-t border-slate-800/80 pt-3">
              <Link href="/terminos" target="_blank" className="hover:text-slate-300 transition">
                Términos y Condiciones
              </Link>
              <span>•</span>
              <Link href="/privacidad" target="_blank" className="hover:text-slate-300 transition">
                Política de Privacidad LOPDP
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 text-sm">
        Cargando formulario de registro...
      </div>
    }>
      <RegisterForm />
    </Suspense>
  );
}
