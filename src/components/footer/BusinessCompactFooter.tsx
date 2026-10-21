import React from "react";
import Link from "next/link";
import {
  Globe,
  UtensilsCrossed,
  ShoppingBag,
  Wrench,
  Calendar,
  Trees,
  MapPin,
  ExternalLink,
  ShieldCheck,
  Zap,
  ArrowRight,
  Sparkles,
} from "lucide-react";

export type BusinessVertical = "menuqr" | "ctalo" | "servicios" | "citas" | "reservas";

export interface BusinessCompactFooterProps {
  businessName: string;
  slug?: string;
  ubicameUrl?: string | null;
  vertical?: BusinessVertical;
  showAffiliateCta?: boolean;
  className?: string;
}

interface VerticalAppInfo {
  id: BusinessVertical;
  name: string;
  category: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  colorClass: string;
  bgClass: string;
}

const APPS: VerticalAppInfo[] = [
  {
    id: "menuqr",
    name: "MenuQR Pro",
    category: "Restaurantes",
    path: "/menuqr",
    icon: UtensilsCrossed,
    colorClass: "text-red-400 group-hover:text-red-300",
    bgClass: "bg-red-500/15 group-hover:bg-red-500/25",
  },
  {
    id: "ctalo",
    name: "Catálogo Pro",
    category: "Tiendas & Moda",
    path: "/ctalo",
    icon: ShoppingBag,
    colorClass: "text-amber-400 group-hover:text-amber-300",
    bgClass: "bg-amber-500/15 group-hover:bg-amber-500/25",
  },
  {
    id: "servicios",
    name: "Servicios Pro",
    category: "Técnicos & GPS",
    path: "/servicios",
    icon: Wrench,
    colorClass: "text-cyan-400 group-hover:text-cyan-300",
    bgClass: "bg-cyan-500/15 group-hover:bg-cyan-500/25",
  },
  {
    id: "citas",
    name: "Citas Pro",
    category: "Turnos & Salud",
    path: "/citas",
    icon: Calendar,
    colorClass: "text-purple-400 group-hover:text-purple-300",
    bgClass: "bg-purple-500/15 group-hover:bg-purple-500/25",
  },
  {
    id: "reservas",
    name: "Reservas Pro",
    category: "Hospedaje & Cabañas",
    path: "/reservas",
    icon: Trees,
    colorClass: "text-emerald-400 group-hover:text-emerald-300",
    bgClass: "bg-emerald-500/15 group-hover:bg-emerald-500/25",
  },
];

const CTA_DATA: Record<
  BusinessVertical,
  {
    badge: string;
    title: string;
    description: (name: string) => string;
    buttonText: string;
    registerType: string;
    gradient: string;
  }
> = {
  menuqr: {
    badge: "¿TIENES UN BAR, CAFETERÍA O RESTAURANTE?",
    title: "Digitaliza tu menú y recibe pedidos directos a WhatsApp",
    description: (name) =>
      `Crea tu propio menú digital interactivo con código QR como el de ${name}. Aumenta tus ventas con ruletas de premios, cartas con fotos y pedidos sin comisiones.`,
    buttonText: "Registra tu Restaurante Gratis",
    registerType: "RESTAURANT",
    gradient: "from-red-600 via-amber-600 to-amber-500",
  },
  ctalo: {
    badge: "¿TIENES UNA TIENDA DE ROPA, CALZADO O JOYERÍA?",
    title: "Crea tu catálogo e-commerce interactivo para WhatsApp",
    description: (name) =>
      `Vende por redes sociales con variantes de talla y color como ${name}. Carrito de compras flotante y pedidos directos sin pasarelas lentas ni comisiones.`,
    buttonText: "Crear Catálogo E-Commerce Gratis",
    registerType: "RETAIL",
    gradient: "from-amber-500 via-yellow-500 to-amber-600",
  },
  servicios: {
    badge: "¿ERES TÉCNICO, ELECTRICISTA O PLOMERO?",
    title: "Cotizador express con subida de fotos y geolocalización GPS",
    description: (name) =>
      `Recibe solicitudes técnicas detalladas en WhatsApp como ${name}. Cotiza en 60 segundos y cierra más trabajos a domicilio.`,
    buttonText: "Crear Cotizador Express Gratis",
    registerType: "SERVICES",
    gradient: "from-cyan-500 via-blue-500 to-indigo-600",
  },
  citas: {
    badge: "¿TIENES UN CONSULTORIO, BARBERÍA O SPA?",
    title: "Agenda de turnos online con recordatorios por WhatsApp",
    description: (name) =>
      `Deja de coordinar horarios manualmente. Permite que tus clientes agenden turnos 24/7 con sus especialistas favoritos como en ${name}.`,
    buttonText: "Crear Agenda Online Gratis",
    registerType: "SERVICES",
    gradient: "from-purple-500 via-indigo-500 to-purple-600",
  },
  reservas: {
    badge: "¿ADMINISTRAS CABAÑAS, HOSTAL O GLAMPING?",
    title: "Motor de reservas directas sin comisiones de Airbnb o Booking",
    description: (name) =>
      `Recibe reservas directas con calendario de disponibilidad en tiempo real como ${name} y ahorra hasta el 25% en comisiones por estancia.`,
    buttonText: "Crear Motor de Reservas Gratis",
    registerType: "SERVICES",
    gradient: "from-emerald-500 via-teal-500 to-emerald-600",
  },
};

export function BusinessCompactFooter({
  businessName,
  slug = "",
  ubicameUrl = null,
  vertical = "menuqr",
  showAffiliateCta = true,
  className = "",
}: BusinessCompactFooterProps) {
  const cta = CTA_DATA[vertical] || CTA_DATA.menuqr;
  const effectiveUbiUrl =
    ubicameUrl && ubicameUrl.trim() !== ""
      ? ubicameUrl.trim()
      : slug
      ? `https://ubicame.info/${slug}`
      : "https://ubicame.info";

  return (
    <footer className={`mt-14 w-full text-slate-300 font-sans pb-32 sm:pb-24 ${className}`}>
      <div className="max-w-4xl mx-auto px-4 space-y-6">

        {/* 1. Banner Opcional de Afiliación / Captación SaaS */}
        {showAffiliateCta && (
          <div className="relative overflow-hidden rounded-3xl bg-slate-900/90 border border-slate-800 p-6 sm:p-8 backdrop-blur-xl shadow-2xl text-center">
            {/* Glow decorativo de fondo */}
            <div className="absolute top-0 right-1/4 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 space-y-4">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-800/80 border border-slate-700/80 text-amber-300">
                <Sparkles className="w-3 h-3" /> {cta.badge}
              </span>

              <h3 className="text-xl sm:text-2xl font-black text-white leading-tight max-w-xl mx-auto">
                {cta.title}
              </h3>

              <p className="text-xs sm:text-sm text-slate-400 max-w-lg mx-auto leading-relaxed">
                {cta.description(businessName)}
              </p>

              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link
                  href={`/registro?type=${cta.registerType}&ref=${encodeURIComponent(slug)}`}
                  className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r ${cta.gradient} hover:opacity-95 text-white font-black text-xs uppercase tracking-wider shadow-lg transition-all hover:scale-[1.02] active:scale-95`}
                >
                  <span>🚀 {cta.buttonText}</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>

                <Link
                  href="/"
                  target="_blank"
                  rel="noreferrer"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-xs transition border border-white/5"
                >
                  <span>Conoce Ubícame Pro</span>
                  <ExternalLink className="w-3.5 h-3.5 text-indigo-400" />
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* 2. Insignia Verificada en Directorio Ubícame.info */}
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 backdrop-blur shadow-md">
          <div className="flex items-center gap-3.5 text-left w-full sm:w-auto">
            <div className="w-10 h-10 rounded-xl bg-sky-500/15 text-sky-400 flex items-center justify-center shrink-0 border border-sky-500/30">
              <MapPin className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-black text-white truncate max-w-[180px] sm:max-w-[240px]">
                  {businessName}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30">
                  Verificado en Ubícame.info
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                Consulta la ficha oficial, mapa GPS y datos verificados en el Directorio Nacional.
              </p>
            </div>
          </div>

          <a
            href={effectiveUbiUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 hover:text-white border border-sky-500/30 text-xs font-bold transition-all shrink-0 hover:scale-[1.02]"
          >
            <span>Ver Ficha en Ubícame.info</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        {/* 3. Barra del Ecosistema de 5 Aplicaciones SaaS */}
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/40 border border-slate-800/60 space-y-3">
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-indigo-500"></span>
              Otras Aplicaciones de la Red Ubícame.cc
            </span>
            <Link
              href="/"
              target="_blank"
              className="text-[11px] text-indigo-400 hover:text-indigo-300 font-bold transition flex items-center gap-1"
            >
              <span>Hub Principal</span>
              <span>→</span>
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {APPS.map((app) => {
              const IconComp = app.icon;
              const isCurrent = app.id === vertical;

              return (
                <Link
                  key={app.id}
                  href={app.path}
                  target="_blank"
                  className={`group p-2.5 rounded-xl border transition-all flex flex-col items-center text-center ${
                    isCurrent
                      ? "bg-slate-800/80 border-slate-700 shadow-sm"
                      : "bg-slate-900/60 border-slate-800/60 hover:border-slate-700 hover:bg-slate-800/50"
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-lg ${app.bgClass} flex items-center justify-center mb-1.5 transition-transform group-hover:scale-110`}
                  >
                    <IconComp className={`w-3.5 h-3.5 ${app.colorClass}`} />
                  </div>
                  <span className="text-[11px] font-bold text-white block truncate w-full">
                    {app.name}
                  </span>
                  <span className="text-[9px] text-slate-400 block truncate w-full">
                    {isCurrent ? "Esta Categoría" : app.category}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>

        {/* 4. Firma Tecnológica, Legal & Copyright */}
        <div className="pt-2 border-t border-slate-800/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-2 text-center sm:text-left">
            <div className="h-5 w-5 rounded-md bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center text-white shrink-0">
              <Globe className="w-3 h-3" />
            </div>
            <span className="text-[11px]">
              Impulsado por <strong className="text-slate-300 font-bold">Ubícame.cc</strong> — Plataforma Multi-Tenant para Comercio Digital
            </span>
          </div>

          <div className="flex items-center gap-3 text-[11px]">
            <Link href="/privacidad" target="_blank" className="hover:text-slate-300 transition">
              Privacidad
            </Link>
            <span>•</span>
            <Link href="/terminos" target="_blank" className="hover:text-slate-300 transition">
              Términos
            </Link>
            <span>•</span>
            <a
              href="https://ubicame.info"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sky-400 hover:text-sky-300 font-medium transition"
            >
              Directorio Ubícame.info
            </a>
          </div>
        </div>

      </div>
    </footer>
  );
}
