"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { registerUserAction } from "@/lib/actions";
import { KeyRound, UtensilsCrossed, Mail, User, Building, MapPin } from "lucide-react";
import Link from "next/link";
import { ecuadorData, parishData, communeData } from "@/lib/ecuador";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-lg text-sm font-medium text-white bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-all duration-200 disabled:opacity-50"
    >
      {pending ? "Creando cuenta..." : "Crear mi Cuenta Demo Gratis"}
    </button>
  );
}

export default function RegisterPage() {
  const [state, formAction] = useFormState(registerUserAction, null);
  const [province, setProvince] = useState("");
  const [canton, setCanton] = useState("");
  const [parroquia, setParroquia] = useState("");
  const [sector, setSector] = useState("");

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-red-600/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-amber-600/10 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="flex justify-center">
          <div className="h-16 w-16 bg-gradient-to-tr from-red-600 to-amber-500 rounded-2xl flex items-center justify-center shadow-lg shadow-red-500/20">
            <UtensilsCrossed className="h-8 w-8 text-white" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-white tracking-tight">
          SaaS MenuQR Pro
        </h2>
        <p className="mt-2 text-center text-sm text-slate-400">
          Registra tu cuenta y crea tu menú digital hoy
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10 px-4 sm:px-0">
        <div className="bg-slate-900/60 backdrop-blur-xl py-8 px-4 border border-slate-800/80 shadow-2xl rounded-2xl sm:px-10">
          <form action={formAction} className="space-y-5">
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
                  className="bg-slate-950/80 border border-slate-800 focus:border-red-500 focus:ring-1 focus:ring-red-500 block w-full pl-10 pr-3 py-3 rounded-xl text-white placeholder-slate-500 focus:outline-none sm:text-sm transition-all duration-200"
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
                  placeholder="ej: contacto@tu-restaurante.com"
                  className="bg-slate-950/80 border border-slate-800 focus:border-red-500 focus:ring-1 focus:ring-red-500 block w-full pl-10 pr-3 py-3 rounded-xl text-white placeholder-slate-500 focus:outline-none sm:text-sm transition-all duration-200"
                />
              </div>
            </div>

            <div>
              <label htmlFor="restaurantName" className="block text-sm font-medium text-slate-300">
                Nombre del Restaurante
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
                  placeholder="ej: Bella Italia Manta"
                  className="bg-slate-950/80 border border-slate-800 focus:border-red-500 focus:ring-1 focus:ring-red-500 block w-full pl-10 pr-3 py-3 rounded-xl text-white placeholder-slate-500 focus:outline-none sm:text-sm transition-all duration-200"
                />
              </div>
            </div>
            <div>
              <label htmlFor="province" className="block text-sm font-medium text-slate-300">
                Provincia de tu Restaurante
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
                  className="bg-slate-950/80 border border-slate-800 focus:border-red-500 focus:ring-1 focus:ring-red-500 block w-full pl-10 pr-3 py-3 rounded-xl text-white placeholder-slate-500 focus:outline-none sm:text-sm transition-all duration-200 cursor-pointer appearance-none"
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
                  className="bg-slate-950/80 border border-slate-800 focus:border-red-500 focus:ring-1 focus:ring-red-500 block w-full pl-10 pr-3 py-3 rounded-xl text-white placeholder-slate-500 focus:outline-none sm:text-sm transition-all duration-200 cursor-pointer appearance-none disabled:opacity-50 disabled:cursor-not-allowed"
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
                    className="bg-slate-950/80 border border-slate-800 focus:border-red-500 focus:ring-1 focus:ring-red-500 block w-full pl-10 pr-3 py-3 rounded-xl text-white placeholder-slate-500 focus:outline-none sm:text-sm transition-all duration-200 cursor-pointer appearance-none"
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
                    className="bg-slate-950/80 border border-slate-800 focus:border-red-500 focus:ring-1 focus:ring-red-500 block w-full pl-10 pr-3 py-3 rounded-xl text-white placeholder-slate-500 focus:outline-none sm:text-sm transition-all duration-200"
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
                    className="bg-slate-950/80 border border-slate-800 focus:border-red-500 focus:ring-1 focus:ring-red-500 block w-full pl-10 pr-3 py-3 rounded-xl text-white placeholder-slate-500 focus:outline-none sm:text-sm transition-all duration-200 cursor-pointer appearance-none"
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
                    className="bg-slate-950/80 border border-slate-800 focus:border-red-500 focus:ring-1 focus:ring-red-500 block w-full pl-10 pr-3 py-3 rounded-xl text-white placeholder-slate-500 focus:outline-none sm:text-sm transition-all duration-200"
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
                  className="bg-slate-950/80 border border-slate-800 focus:border-red-500 focus:ring-1 focus:ring-red-500 block w-full pl-10 pr-3 py-3 rounded-xl text-white placeholder-slate-500 focus:outline-none sm:text-sm transition-all duration-200"
                />
              </div>
            </div>

            {/* Aceptación de Términos y Políticas (Legislación Ecuatoriana) */}
            <div className="flex items-start gap-3 pt-2">
              <div className="flex items-center h-5 mt-0.5">
                <input
                  id="acceptTerms"
                  name="acceptTerms"
                  type="checkbox"
                  required
                  className="h-4 w-4 rounded border-slate-700 bg-slate-950 text-red-600 focus:ring-red-500 focus:ring-offset-slate-900 cursor-pointer"
                />
              </div>
              <label htmlFor="acceptTerms" className="text-xs text-slate-400 leading-normal cursor-pointer select-none">
                Acepto de forma expresa los{" "}
                <Link href="/terminos" target="_blank" className="text-amber-400 hover:underline font-semibold">
                  Términos y Condiciones
                </Link>{" "}
                y la{" "}
                <Link href="/privacidad" target="_blank" className="text-amber-400 hover:underline font-semibold">
                  Política de Privacidad
                </Link>{" "}
                conforme a la legislación de la República del Ecuador (LOPDP y Ley de Comercio Electrónico).
              </label>
            </div>

            <div className="bg-amber-500/5 border border-amber-500/10 rounded-xl p-3 text-[10px] text-amber-400/90 leading-relaxed">
              * Recibirás de forma gratuita una prueba completa del <strong>Plan Premium ($5 USD/mes)</strong> por un período de <strong>30 días (1 mes)</strong> a partir del registro.
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

          <div className="mt-6 text-center text-xs text-slate-450 space-y-3">
            <p>
              ¿Ya tienes cuenta?{" "}
              <Link href="/login" className="text-red-400 hover:text-red-300 underline font-semibold transition">
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
