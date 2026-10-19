"use client";

import { useState, Suspense } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useSearchParams } from "next/navigation";
import { registerUserAction } from "@/lib/actions";
import {
  KeyRound,
  UtensilsCrossed,
  Mail,
  User,
  Building,
  MapPin,
  ShoppingBag,
  Wrench,
  Calendar,
  Trees,
  Package,
} from "lucide-react";
import Link from "next/link";
import { ecuadorData, parishData, communeData } from "@/lib/ecuador";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";

// Configuración visual dinámica por cada vertical (idéntica a sus respectivas landing pages)
interface VerticalBranding {
  title: string;
  highlight: string;
  highlightColor: string;
  badgeGradient: string;
  badgeShadow: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  subtitle: string;
  submitText: string;
  buttonGradient: string;
  buttonTextColor: string;
  glows: [string, string];
  nameLabel: string;
  namePlaceholder: string;
  provinceLabel: string;
}

const BRANDING_MAP: Record<string, VerticalBranding> = {
  RESTAURANT: {
    title: "MenuQR ",
    highlight: "Pro",
    highlightColor: "text-red-500",
    badgeGradient: "bg-gradient-to-tr from-red-600 to-amber-500",
    badgeShadow: "shadow-red-500/30",
    icon: UtensilsCrossed,
    iconColor: "text-white",
    subtitle: "Registra tu cuenta y crea tu menú digital para mesas y delivery hoy",
    submitText: "Crear Menú Digital Gratis",
    buttonGradient: "from-red-600 via-orange-500 to-amber-600 hover:from-red-500 hover:to-amber-500",
    buttonTextColor: "text-white",
    glows: ["bg-red-600/15", "bg-amber-600/15"],
    nameLabel: "Nombre del Restaurante / Bar",
    namePlaceholder: "ej: La Parrilla Criolla / Bella Italia Manta",
    provinceLabel: "Provincia de tu Restaurante",
  },
  RETAIL: {
    title: "Catálogo ",
    highlight: "Pro",
    highlightColor: "text-amber-400",
    badgeGradient: "bg-gradient-to-tr from-amber-500 to-yellow-400",
    badgeShadow: "shadow-amber-500/30",
    icon: ShoppingBag,
    iconColor: "text-slate-950",
    subtitle: "Registra tu cuenta y crea tu catálogo con variantes para WhatsApp hoy",
    submitText: "Crear Catálogo E-Commerce Gratis",
    buttonGradient: "from-amber-400 via-amber-300 to-orange-400 hover:from-amber-300 hover:to-orange-300",
    buttonTextColor: "text-slate-950",
    glows: ["bg-amber-600/15", "bg-yellow-600/15"],
    nameLabel: "Nombre de tu Tienda / Comercio",
    namePlaceholder: "ej: Aura Boutique / Calzado Urbano",
    provinceLabel: "Provincia de tu Tienda",
  },
  SERVICES: {
    title: "Servicios ",
    highlight: "Pro",
    highlightColor: "text-cyan-400",
    badgeGradient: "bg-gradient-to-tr from-cyan-500 to-blue-500",
    badgeShadow: "shadow-cyan-500/30",
    icon: Wrench,
    iconColor: "text-slate-950",
    subtitle: "Registra tu cuenta y activa tu cotizador express con fotos y GPS hoy",
    submitText: "Crear Cotizador Express Gratis",
    buttonGradient: "from-cyan-400 via-teal-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400",
    buttonTextColor: "text-slate-950",
    glows: ["bg-cyan-600/15", "bg-blue-600/15"],
    nameLabel: "Nombre de tu Empresa / Servicio Técnico",
    namePlaceholder: "ej: MasterFix Plomería / Soluciones Eléctricas 24/7",
    provinceLabel: "Provincia de Cobertura",
  },
  CITAS: {
    title: "Citas ",
    highlight: "Pro",
    highlightColor: "text-purple-400",
    badgeGradient: "bg-gradient-to-tr from-purple-500 to-indigo-500",
    badgeShadow: "shadow-purple-500/30",
    icon: Calendar,
    iconColor: "text-white",
    subtitle: "Registra tu consultorio o barbería y activa tu agenda de turnos 24/7",
    submitText: "Activar Agenda de Turnos Gratis",
    buttonGradient: "from-purple-500 via-pink-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500",
    buttonTextColor: "text-white",
    glows: ["bg-purple-600/15", "bg-indigo-600/15"],
    nameLabel: "Nombre del Consultorio / Barbería / Salón",
    namePlaceholder: "ej: Clínica Dental Santa Lucía / The Master Barber",
    provinceLabel: "Provincia de tu Consultorio",
  },
  RESERVAS: {
    title: "Reservas ",
    highlight: "Pro",
    highlightColor: "text-emerald-400",
    badgeGradient: "bg-gradient-to-tr from-emerald-500 to-teal-400",
    badgeShadow: "shadow-emerald-500/30",
    icon: Trees,
    iconColor: "text-slate-950",
    subtitle: "Registra tu hospedaje y activa tu motor de reservas directas hoy",
    submitText: "Crear Motor de Reservas Gratis",
    buttonGradient: "from-emerald-400 via-teal-400 to-cyan-500 hover:from-emerald-300 hover:to-cyan-400",
    buttonTextColor: "text-slate-950",
    glows: ["bg-emerald-600/15", "bg-teal-600/15"],
    nameLabel: "Nombre de las Cabañas / Hostal / Glamping",
    namePlaceholder: "ej: Cabañas El Mirador / Domos Glamping Los Andes",
    provinceLabel: "Provincia de tu Hospedaje",
  },
  GENERAL_CATALOG: {
    title: "Catálogo ",
    highlight: "General",
    highlightColor: "text-blue-400",
    badgeGradient: "bg-gradient-to-tr from-blue-500 to-indigo-600",
    badgeShadow: "shadow-blue-500/30",
    icon: Package,
    iconColor: "text-white",
    subtitle: "Registra tu negocio y publica tu catálogo digital interactivo hoy",
    submitText: "Crear Catálogo General Gratis",
    buttonGradient: "from-blue-500 via-indigo-500 to-blue-600 hover:from-blue-400 hover:to-indigo-500",
    buttonTextColor: "text-white",
    glows: ["bg-blue-600/15", "bg-indigo-600/15"],
    nameLabel: "Nombre de tu Negocio / Empresa",
    namePlaceholder: "ej: Distribuidora Nacional / Ferretería San Juan",
    provinceLabel: "Provincia de tu Negocio",
  },
};

function SubmitButton({
  text,
  gradient,
  textColor,
}: {
  text: string;
  gradient: string;
  textColor: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={`w-full flex justify-center py-3.5 px-4 border border-transparent rounded-xl shadow-lg text-sm font-bold bg-gradient-to-r ${gradient} ${textColor} focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all duration-300 disabled:opacity-50 hover:scale-[1.01]`}
    >
      {pending ? "Creando cuenta..." : text}
    </button>
  );
}

function RegisterForm() {
  const searchParams = useSearchParams();
  const typeParam = searchParams.get("type")?.toUpperCase() || "";

  const initialType = ["RETAIL", "SERVICES", "CITAS", "RESERVAS", "GENERAL_CATALOG", "CATALOG"].includes(
    typeParam
  )
    ? typeParam === "CATALOG"
      ? "RETAIL"
      : typeParam
    : "RESTAURANT";

  const [businessType, setBusinessType] = useState<string>(initialType);
  const [state, formAction] = useActionState(registerUserAction, null);
  const [province, setProvince] = useState("");
  const [canton, setCanton] = useState("");
  const [parroquia, setParroquia] = useState("");
  const [sector, setSector] = useState("");

  const currentBranding = BRANDING_MAP[businessType] || BRANDING_MAP.RESTAURANT;
  const BrandIcon = currentBranding.icon;

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden transition-colors duration-500">
      {/* Background ambient glows sincronizados con la vertical */}
      <div
        className={`absolute top-1/4 left-1/4 w-96 h-96 ${currentBranding.glows[0]} rounded-full blur-[140px] pointer-events-none transition-all duration-700`}
      ></div>
      <div
        className={`absolute bottom-1/4 right-1/4 w-96 h-96 ${currentBranding.glows[1]} rounded-full blur-[140px] pointer-events-none transition-all duration-700`}
      ></div>

      {/* Header Dinámico (Logo, Título y Subtítulo que cambian según la selección) */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 text-center">
        <div className="flex justify-center">
          <div
            className={`h-16 w-16 ${currentBranding.badgeGradient} ${currentBranding.badgeShadow} rounded-2xl flex items-center justify-center shadow-lg transition-all duration-300 transform hover:scale-105`}
          >
            <BrandIcon className={`h-8 w-8 ${currentBranding.iconColor} transition-transform duration-300`} />
          </div>
        </div>
        <h2 className="mt-5 text-center text-3xl font-black text-white tracking-tight transition-all duration-300">
          {currentBranding.title}
          <span className={currentBranding.highlightColor}>{currentBranding.highlight}</span>
        </h2>
        <p className="mt-2 text-center text-xs sm:text-sm text-slate-400 font-medium max-w-sm mx-auto transition-all duration-300 leading-relaxed">
          {currentBranding.subtitle}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10 px-4 sm:px-0">
        <div className="bg-slate-900/60 backdrop-blur-xl py-8 px-4 border border-slate-800/80 shadow-2xl rounded-2xl sm:px-10">
          {/* Botón de Registro Express con Google */}
          <div className="space-y-4 mb-6">
            <GoogleSignInButton
              text="Registrarse con Google"
              type={businessType}
              mode="register"
            />
            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-slate-800"></div>
              <span className="flex-shrink mx-4 text-[10.5px] font-bold text-slate-500 uppercase tracking-wider">
                o completa el formulario
              </span>
              <div className="flex-grow border-t border-slate-800"></div>
            </div>
          </div>

          <form action={formAction} className="space-y-5">
            {/* Selector de Tipo de Negocio */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Vertical de tu Negocio:
              </label>
              <div className="grid grid-cols-2 gap-2 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setBusinessType("RESTAURANT")}
                  className={`p-3 rounded-xl border transition-all text-left flex items-center gap-2 ${
                    businessType === "RESTAURANT"
                      ? "bg-red-500/20 border-red-500 text-white font-bold shadow-md shadow-red-500/10 scale-[1.02]"
                      : "bg-slate-950/80 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-300"
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
                      ? "bg-amber-500/20 border-amber-500 text-white font-bold shadow-md shadow-amber-500/10 scale-[1.02]"
                      : "bg-slate-950/80 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-300"
                  }`}
                >
                  <ShoppingBag className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Catálogo E-Commerce</span>
                </button>

                <button
                  type="button"
                  onClick={() => setBusinessType("SERVICES")}
                  className={`p-3 rounded-xl border transition-all text-left flex items-center gap-2 ${
                    businessType === "SERVICES"
                      ? "bg-cyan-500/20 border-cyan-500 text-white font-bold shadow-md shadow-cyan-500/10 scale-[1.02]"
                      : "bg-slate-950/80 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-300"
                  }`}
                >
                  <Wrench className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span>Servicios Técnicos</span>
                </button>

                <button
                  type="button"
                  onClick={() => setBusinessType("CITAS")}
                  className={`p-3 rounded-xl border transition-all text-left flex items-center gap-2 ${
                    businessType === "CITAS"
                      ? "bg-purple-500/20 border-purple-500 text-white font-bold shadow-md shadow-purple-500/10 scale-[1.02]"
                      : "bg-slate-950/80 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-300"
                  }`}
                >
                  <Calendar className="w-4 h-4 text-purple-400 shrink-0" />
                  <span>Agenda de Citas</span>
                </button>

                <button
                  type="button"
                  onClick={() => setBusinessType("RESERVAS")}
                  className={`p-3 rounded-xl border transition-all text-left flex items-center justify-between col-span-2 ${
                    businessType === "RESERVAS"
                      ? "bg-emerald-500/20 border-emerald-500 text-white font-bold shadow-md shadow-emerald-500/10 scale-[1.02]"
                      : "bg-slate-950/80 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Trees className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Hospedaje & Cabañas</span>
                  </div>
                  <span className="text-[10px] text-emerald-400/80 font-normal">reservas.ubicame.cc</span>
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
                {currentBranding.nameLabel}
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
                  placeholder={currentBranding.namePlaceholder}
                  className="bg-slate-950/80 border border-slate-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 block w-full pl-10 pr-3 py-3 rounded-xl text-white placeholder-slate-500 focus:outline-none sm:text-sm transition-all duration-200"
                />
              </div>
            </div>

            <div>
              <label htmlFor="province" className="block text-sm font-medium text-slate-300">
                {currentBranding.provinceLabel}
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
                    <option key={prov} value={prov}>
                      {prov}
                    </option>
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
                    <option key={cant} value={cant}>
                      {cant}
                    </option>
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
                      <option key={p} value={p}>
                        {p}
                      </option>
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
                      <option key={c} value={c}>
                        {c}
                      </option>
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
              <label
                htmlFor="acceptTerms"
                className="text-xs text-slate-300 leading-relaxed cursor-pointer select-none"
              >
                He leído y acepto expresamente los{" "}
                <Link
                  href="/terminos"
                  target="_blank"
                  className="text-amber-400 hover:text-amber-300 underline font-semibold transition"
                >
                  Términos y Condiciones
                </Link>{" "}
                y la{" "}
                <Link
                  href="/privacidad"
                  target="_blank"
                  className="text-amber-400 hover:text-amber-300 underline font-semibold transition"
                >
                  Política de Privacidad y Tratamiento de Datos
                </Link>{" "}
                de <span className="text-white font-medium">ubicame.cc</span> conforme a la LOPDP y
                Ley de Comercio Electrónico de Ecuador.
              </label>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 text-[10px] text-slate-400 leading-relaxed">
              * Recibirás de forma gratuita una prueba completa de tu plan por un período de{" "}
              <strong className="text-white">30 días (1 mes)</strong> a partir del registro sin compromiso.
            </div>

            {(state as any)?.error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-sm text-red-400">
                {(state as any).error}
              </div>
            )}

            <div>
              <SubmitButton
                text={currentBranding.submitText}
                gradient={currentBranding.buttonGradient}
                textColor={currentBranding.buttonTextColor}
              />
            </div>
          </form>

          <div className="mt-6 text-center text-xs text-slate-400 space-y-3">
            <p>
              ¿Ya tienes cuenta?{" "}
              <Link
                href="/login"
                className="text-amber-400 hover:text-amber-300 underline font-semibold transition"
              >
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
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 text-sm">
          Cargando formulario de registro...
        </div>
      }
    >
      <RegisterForm />
    </Suspense>
  );
}
