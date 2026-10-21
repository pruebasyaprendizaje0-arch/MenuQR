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
  CheckCircle2,
  PhoneCall,
  Sparkles,
  ArrowRight,
} from "lucide-react";

export type VerticalType = "menuqr" | "ctalo" | "servicios" | "citas" | "reservas" | "hub";

interface EcosystemFooterProps {
  currentVertical?: VerticalType;
  whatsappSupport?: string;
}

interface VerticalAppItem {
  id: VerticalType;
  name: string;
  subdomain: string;
  path: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  colorClass: string;
  bgClass: string;
  badgeClass: string;
}

const VERTICAL_APPS: VerticalAppItem[] = [
  {
    id: "menuqr",
    name: "MenuQR Pro",
    subdomain: "menuqr.ubicame.cc",
    path: "/menuqr",
    description: "Restaurantes, Bares & Cafés",
    icon: UtensilsCrossed,
    colorClass: "text-red-400 group-hover:text-red-300",
    bgClass: "bg-red-500/15 group-hover:bg-red-500/25",
    badgeClass: "bg-red-950/70 text-red-400 border-red-800/50",
  },
  {
    id: "ctalo",
    name: "Catálogo Pro",
    subdomain: "catalogo.ubicame.cc",
    path: "/ctalo",
    description: "Moda, Calzado & Joyería",
    icon: ShoppingBag,
    colorClass: "text-amber-400 group-hover:text-amber-300",
    bgClass: "bg-amber-500/15 group-hover:bg-amber-500/25",
    badgeClass: "bg-amber-950/70 text-amber-400 border-amber-800/50",
  },
  {
    id: "servicios",
    name: "Servicios Pro",
    subdomain: "servicios.ubicame.cc",
    path: "/servicios",
    description: "Técnicos & Cotizador GPS",
    icon: Wrench,
    colorClass: "text-cyan-400 group-hover:text-cyan-300",
    bgClass: "bg-cyan-500/15 group-hover:bg-cyan-500/25",
    badgeClass: "bg-cyan-950/70 text-cyan-400 border-cyan-800/50",
  },
  {
    id: "citas",
    name: "Citas Pro",
    subdomain: "citas.ubicame.cc",
    path: "/citas",
    description: "Consultorios & Barberías",
    icon: Calendar,
    colorClass: "text-purple-400 group-hover:text-purple-300",
    bgClass: "bg-purple-500/15 group-hover:bg-purple-500/25",
    badgeClass: "bg-purple-950/70 text-purple-400 border-purple-800/50",
  },
  {
    id: "reservas",
    name: "Reservas Pro",
    subdomain: "reservas.ubicame.cc",
    path: "/reservas",
    description: "Cabañas, Hostales & Glamping",
    icon: Trees,
    colorClass: "text-emerald-400 group-hover:text-emerald-300",
    bgClass: "bg-emerald-500/15 group-hover:bg-emerald-500/25",
    badgeClass: "bg-emerald-950/70 text-emerald-400 border-emerald-800/50",
  },
];

export function EcosystemFooter({
  currentVertical = "hub",
  whatsappSupport = "593999999999",
}: EcosystemFooterProps) {
  const cleanPhone = (whatsappSupport || "593999999999").replace(/\D/g, "");
  const waHelpUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(
    "Hola, quisiera soporte o información sobre las soluciones de Ubícame.cc"
  )}`;

  return (
    <footer className="border-t border-slate-800/80 bg-slate-950 text-slate-300 relative z-10 font-sans">
      {/* Franja Superior Informativa de Red */}
      <div className="bg-slate-900/60 border-b border-slate-800/60 py-3 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-400">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span>
              Ecosistema Activo: <strong className="text-white">5 Aplicaciones SaaS</strong> bajo subdominios dedicados en Ecuador
            </span>
          </div>
          <div className="flex items-center gap-4 text-slate-400">
            <span className="inline-flex items-center gap-1.5 text-indigo-400 font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" /> 0% Comisiones por venta
            </span>
            <span className="hidden md:inline text-slate-600">•</span>
            <span className="hidden md:inline-flex items-center gap-1.5 text-amber-400 font-semibold">
              <Sparkles className="w-3.5 h-3.5" /> Pedidos automáticos a WhatsApp
            </span>
          </div>
        </div>
      </div>

      {/* Contenido Principal en 4 Columnas */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          
          {/* Columna 1: Marca Matriz Ubícame.cc */}
          <div className="space-y-4">
            <Link href="/" className="inline-flex items-center gap-3 group">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform">
                <Globe className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className="text-lg font-black tracking-tight text-white block">
                  Ubícame<span className="text-indigo-400">.cc</span>
                </span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block -mt-0.5">
                  Ecosistema Multi-Vertical SaaS
                </span>
              </div>
            </Link>

            <p className="text-xs text-slate-400 leading-relaxed">
              Plataforma tecnológica en la nube diseñada para digitalizar negocios independientes, restaurantes, tiendas, servicios y hospedaje sin intermediarios ni comisiones abusivas.
            </p>

            <div className="pt-2">
              <Link
                href="/"
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-200 hover:text-white hover:border-indigo-500/50 transition-all group"
              >
                <span>Conoce el Hub ubicame.cc</span>
                <ArrowRight className="w-3 h-3 text-indigo-400 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>

            <div className="pt-1 text-[11px] text-slate-500">
              Infraestructura optimizada en VPS Vultr con base de datos PostgreSQL de alta disponibilidad.
            </div>
          </div>

          {/* Columna 2: Aplicaciones del Ecosistema */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-indigo-500"></span>
              <h4 className="text-sm font-extrabold uppercase tracking-wider text-white">
                Aplicaciones SaaS
              </h4>
            </div>

            <ul className="space-y-2.5">
              {VERTICAL_APPS.map((app) => {
                const IconComponent = app.icon;
                const isCurrent = app.id === currentVertical;

                return (
                  <li key={app.id}>
                    {isCurrent ? (
                      <div className="flex items-center justify-between p-2 rounded-xl bg-slate-900 border border-slate-700/80">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-7 h-7 rounded-lg ${app.bgClass} flex items-center justify-center text-white`}>
                            <IconComponent className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="text-xs font-extrabold text-white block">
                              {app.name}
                            </span>
                            <span className="text-[10px] text-slate-400 block">
                              {app.description}
                            </span>
                          </div>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          Actual
                        </span>
                      </div>
                    ) : (
                      <Link
                        href={app.path}
                        className="group flex items-center justify-between p-2 rounded-xl hover:bg-slate-900/90 border border-transparent hover:border-slate-800 transition-all"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className={`w-7 h-7 rounded-lg ${app.bgClass} flex items-center justify-center transition-transform group-hover:scale-110`}>
                            <IconComponent className={`w-4 h-4 ${app.colorClass}`} />
                          </div>
                          <div>
                            <span className={`text-xs font-bold text-slate-300 ${app.colorClass} block`}>
                              {app.name}
                            </span>
                            <span className="text-[10px] text-slate-500 block">
                              {app.description}
                            </span>
                          </div>
                        </div>
                        <span className="text-slate-600 group-hover:text-slate-400 text-xs transition-colors">
                          →
                        </span>
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Columna 3: Directorio Comercial Ubícame.info */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-sky-500"></span>
              <h4 className="text-sm font-extrabold uppercase tracking-wider text-white">
                Directorio Comercial
              </h4>
            </div>

            <div className="p-4 rounded-2xl bg-gradient-to-br from-sky-950/40 to-slate-900 border border-sky-800/40 relative overflow-hidden">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center">
                  <MapPin className="w-4 h-4" />
                </div>
                <span className="text-xs font-black text-white">Ubícame.info</span>
                <span className="text-[10px] bg-sky-500/20 text-sky-300 px-2 py-0.2 rounded-full border border-sky-500/30 font-bold ml-auto">
                  Directorio
                </span>
              </div>

              <p className="text-[11px] text-slate-300 leading-relaxed mb-3">
                Directorio nacional de negocios geolocalizados. Busca locales por ciudad, mapa GPS y especialidad comercial.
              </p>

              <a
                href="https://ubicame.info"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-bold text-xs shadow-md shadow-sky-500/20 transition-all hover:scale-[1.02]"
              >
                <span>Visitar Ubícame.info</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            <ul className="space-y-1.5 text-xs text-slate-400">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <a
                  href="https://ubicame.info"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition"
                >
                  Buscar negocios por mapa GPS
                </a>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <a
                  href="https://ubicame.info"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition"
                >
                  Ficha pública para todo comercio registrado
                </a>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <a
                  href="https://ubicame.info"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition"
                >
                  Cobertura en Quito, Guayaquil, Cuenca y más
                </a>
              </li>
            </ul>
          </div>

          {/* Columna 4: Soporte & Marco Legal */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
              <h4 className="text-sm font-extrabold uppercase tracking-wider text-white">
                Legal & Soporte
              </h4>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Cumplimiento estricto de la legislación de comercio electrónico y protección de datos (LOPDP) de la República del Ecuador.
            </p>

            <ul className="space-y-2 text-xs">
              <li>
                <Link
                  href="/privacidad"
                  className="text-slate-400 hover:text-white transition flex items-center gap-2"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-slate-500" />
                  <span>Política de Privacidad (LOPDP)</span>
                </Link>
              </li>
              <li>
                <Link
                  href="/terminos"
                  className="text-slate-400 hover:text-white transition flex items-center gap-2"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-slate-500" />
                  <span>Términos y Condiciones de Uso</span>
                </Link>
              </li>
              <li>
                <a
                  href={waHelpUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-400 hover:text-emerald-300 font-semibold transition flex items-center gap-2"
                >
                  <PhoneCall className="w-3.5 h-3.5" />
                  <span>Atención & Soporte por WhatsApp</span>
                </a>
              </li>
            </ul>

            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-slate-400">
              <span className="text-white font-bold block mb-0.5">Soporte Comercial</span>
              <span>Lunes a Domingo • Activación de planes y asistencia técnica inmediata.</span>
            </div>
          </div>

        </div>
      </div>

      {/* Barra Inferior de Copyright */}
      <div className="border-t border-slate-900 bg-slate-950/90 py-6 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div>
            © {new Date().getFullYear()} <strong className="text-slate-300 font-bold">Ubícame.cc</strong> — Plataforma SaaS Multi-Vertical. Todos los derechos reservados.
          </div>
          <div className="flex flex-wrap items-center justify-center gap-4 text-[11px]">
            <span>MenúQR</span>
            <span>•</span>
            <span>Catálogo</span>
            <span>•</span>
            <span>Servicios</span>
            <span>•</span>
            <span>Citas</span>
            <span>•</span>
            <span>Reservas</span>
            <span>•</span>
            <span className="text-sky-400 font-semibold">Ubícame.info</span>
          </div>
          <div className="text-slate-500 text-center md:text-right">
            Ecuador 🇪🇨 & Latinoamérica
          </div>
        </div>
      </div>
    </footer>
  );
}
