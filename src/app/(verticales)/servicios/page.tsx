import React from "react";
import Link from "next/link";
import type { Metadata } from "next";
import {
  Wrench,
  Zap,
  ArrowRight,
  CheckCircle2,
  Camera,
  MapPin,
  Clock,
  ShieldCheck,
  Smartphone,
  PhoneCall,
  Flame,
  Sparkles,
} from "lucide-react";
import { getVerticalMarketplaceData } from "@/lib/marketplace";
import { VerticalMarketplaceSection } from "@/components/marketplace/VerticalMarketplaceSection";

export const metadata: Metadata = {
  title: "Servicios Pro | Cotizador Express con Fotos y GPS para Técnicos",
  description:
    "Recibe solicitudes de servicio técnico con fotos de la avería y geolocalización GPS directa en WhatsApp. Ideal para plomeros, electricistas y técnicos en Ecuador.",
  keywords: [
    "Cotizador express servicios",
    "Plomeros WhatsApp Ecuador",
    "Electricistas a domicilio Quito Guayaquil",
    "Servicios técnicos GPS",
    "Cotizaciones técnicas WhatsApp",
  ],
};

export default async function ServiciosLandingPage() {
  const marketplaceData = await getVerticalMarketplaceData("servicios");
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-cyan-500 selection:text-slate-950">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-slate-950/80 border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="h-11 w-11 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-500 flex items-center justify-center text-slate-950 font-black text-xl shadow-lg shadow-cyan-500/20 group-hover:scale-105 transition-transform">
                <Wrench className="w-6 h-6 text-slate-950" />
              </div>
              <div>
                <span className="text-lg font-black tracking-tight text-white block">
                  Servicios <span className="text-cyan-400">Pro</span>
                </span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block -mt-1">
                  Técnicos, Plomeros & Electricistas
                </span>
              </div>
            </Link>

            {/* Vertical Switcher Tabs */}
            <div className="hidden lg:inline-flex p-1 bg-slate-900/90 rounded-full border border-slate-800 text-xs font-semibold gap-1">
              <Link href="/menuqr" className="px-3 py-1.5 rounded-full text-slate-400 hover:text-white transition flex items-center gap-1.5">
                🍔 Restaurantes
              </Link>
              <Link href="/ctalo" className="px-3 py-1.5 rounded-full text-slate-400 hover:text-white transition flex items-center gap-1.5">
                🛍️ Tiendas (Catálogo)
              </Link>
              <span className="px-3 py-1.5 rounded-full bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/30 flex items-center gap-1.5">
                🔧 Servicios Técnicos
              </span>
              <Link href="/citas" className="px-3 py-1.5 rounded-full text-slate-400 hover:text-white transition flex items-center gap-1.5">
                📅 Citas & Barberías
              </Link>
              <Link href="/reservas" className="px-3 py-1.5 rounded-full text-slate-400 hover:text-white transition flex items-center gap-1.5">
                🏡 Cabañas & Hospedaje
              </Link>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-900 transition-all"
            >
              Iniciar Sesión
            </Link>
            <Link
              href="/registro?type=SERVICES"
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 shadow-lg shadow-cyan-500/20 transition-all flex items-center gap-2"
            >
              <span>Crear Perfil Gratis</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-12 pb-24 overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-gradient-to-b from-cyan-500/15 via-blue-500/10 to-transparent rounded-full blur-[120px] pointer-events-none"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-950/60 border border-cyan-800/60 text-cyan-400 text-xs font-bold mb-8 shadow-inner animate-pulse">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <span>Vertical Oficial: servicios.ubicame.cc • Cotizador Express con Fotos & GPS</span>
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black text-white tracking-tight max-w-4xl mx-auto leading-[1.1] mb-6">
            Cotiza Trabajos Técnicos en 60 Segundos con{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-400">
              Fotos y Ubicación GPS
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Elimina las llamadas eternas y las direcciones confusas. Tus clientes suben fotos de la avería, comparten su geolocalización exacta y te llega todo ordenado a tu WhatsApp.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Link
              href="/registro?type=SERVICES"
              className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-slate-950 font-extrabold text-base shadow-xl shadow-cyan-500/25 hover:shadow-cyan-500/40 transition-all flex items-center justify-center gap-2"
            >
              <span>Crear Perfil Profesional Gratis</span>
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              href="/servicios/demo"
              className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-200 font-bold text-base transition-all flex items-center justify-center gap-2 hover:bg-slate-850"
            >
              <Smartphone className="w-5 h-5 text-cyan-400" />
              <span>Ver Cotizador Demo (Técnico Pro)</span>
            </Link>
          </div>

          {/* Interactive Feature Highlights */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto text-left">
            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur hover:border-cyan-500/40 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Camera className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Subida de Fotos del Desperfecto</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                El cliente fotografía la tubería rota, el enchufe quemado o el electrodoméstico fallando para que lleves los repuestos exactos a la primera visita.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur hover:border-cyan-500/40 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <MapPin className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Geolocalización GPS Directa</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Con un solo toque el cliente envía sus coordenadas. Abre la ruta directamente en Google Maps o Waze sin perderte en el tráfico.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur hover:border-cyan-500/40 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Clock className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Urgencias 24/7 vs Programadas</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Filtra emergencias inmediatas que requieren atención urgente de visitas regulares programadas durante la semana.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Vitrina Dinámica Marketplace de Servicios Sugeridos & Populares */}
      <VerticalMarketplaceSection data={marketplaceData} />

      {/* Profesiones soportadas */}
      <section className="py-16 bg-slate-900/40 border-y border-slate-800/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-8">
            Ideal para Todo Tipo de Profesionales Independientes y Talleres
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 text-center">
              <div className="text-2xl mb-1">🚰</div>
              <div className="font-bold text-white text-sm">Plomería & Gasfitería</div>
              <div className="text-xs text-slate-400">Fugas, bombas, calefones</div>
            </div>
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 text-center">
              <div className="text-2xl mb-1">⚡</div>
              <div className="font-bold text-white text-sm">Electricidad Residencial</div>
              <div className="text-xs text-slate-400">Cortocircuitos, cableado</div>
            </div>
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 text-center">
              <div className="text-2xl mb-1">❄️</div>
              <div className="font-bold text-white text-sm">Aire Acondicionado</div>
              <div className="text-xs text-slate-400">Mantenimiento y recarga</div>
            </div>
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 text-center">
              <div className="text-2xl mb-1">🔑</div>
              <div className="font-bold text-white text-sm">Cerrajería Rápida</div>
              <div className="text-xs text-slate-400">Aperturas y cambio de claves</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="py-24 text-center relative overflow-hidden">
        <div className="max-w-4xl mx-auto px-4 relative z-10">
          <h2 className="text-3xl sm:text-5xl font-black text-white mb-6">
            Profesionaliza tus cotizaciones de servicio hoy
          </h2>
          <p className="text-slate-400 text-base max-w-xl mx-auto mb-10">
            Comparte tu enlace de cotizador en WhatsApp Business y responde a tus clientes como una empresa de primer nivel.
          </p>
          <Link
            href="/registro?type=SERVICES"
            className="inline-flex items-center gap-3 px-9 py-4 rounded-2xl bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-slate-950 font-extrabold text-lg shadow-xl shadow-cyan-500/30 transition-all hover:scale-105"
          >
            <span>Crear mi Cotizador Express</span>
            <ArrowRight className="w-5 h-5 text-slate-950" />
          </Link>
        </div>
      </section>
    </div>
  );
}
