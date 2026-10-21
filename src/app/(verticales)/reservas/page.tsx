import React from "react";
import Link from "next/link";
import type { Metadata } from "next";
import {
  Hotel,
  Zap,
  ArrowRight,
  CheckCircle2,
  Calendar,
  Compass,
  Flame,
  ShieldCheck,
  Smartphone,
  Coffee,
  Sparkles,
  Percent,
  Trees,
} from "lucide-react";
import { getVerticalMarketplaceData } from "@/lib/marketplace";
import { VerticalMarketplaceSection } from "@/components/marketplace/VerticalMarketplaceSection";
import { EcosystemFooter } from "@/components/footer/EcosystemFooter";

export const metadata: Metadata = {
  title: "Reservas Pro | Motor de Reservas de Hospedaje sin Comisiones",
  description:
    "Motor de reservas directas para hostales, cabañas, glampings y hoteles boutique. Ahorra hasta el 25% de comisiones de Airbnb y Booking con pagos directos a tu banco o WhatsApp.",
  keywords: [
    "Motor de reservas cabañas",
    "Reservas hostales WhatsApp",
    "Glamping Ecuador reservas",
    "Software reservas hoteles boutique",
    "Reservas directas sin comisiones",
  ],
};

export default async function ReservasLandingPage() {
  const marketplaceData = await getVerticalMarketplaceData("reservas");
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-emerald-500 selection:text-slate-950">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-slate-950/80 border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="h-11 w-11 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 font-black text-xl shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition-transform">
                <Trees className="w-6 h-6 text-slate-950" />
              </div>
              <div>
                <span className="text-lg font-black tracking-tight text-white block">
                  Reservas <span className="text-emerald-400">Pro</span>
                </span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block -mt-1">
                  Cabañas, Hostales & Glamping
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
              <Link href="/servicios" className="px-3 py-1.5 rounded-full text-slate-400 hover:text-white transition flex items-center gap-1.5">
                🔧 Servicios Técnicos
              </Link>
              <Link href="/citas" className="px-3 py-1.5 rounded-full text-slate-400 hover:text-white transition flex items-center gap-1.5">
                📅 Citas & Barberías
              </Link>
              <span className="px-3 py-1.5 rounded-full bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/30 flex items-center gap-1.5">
                🏡 Cabañas & Hospedaje
              </span>
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
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2"
            >
              <span>Crear mi Motor Gratis</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-12 pb-24 overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-gradient-to-b from-emerald-500/15 via-teal-500/10 to-transparent rounded-full blur-[120px] pointer-events-none"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-950/60 border border-emerald-800/60 text-emerald-400 text-xs font-bold mb-8 shadow-inner animate-pulse">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span>Vertical Oficial: reservas.ubicame.cc • Motor de Reservas Directas</span>
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black text-white tracking-tight max-w-4xl mx-auto leading-[1.1] mb-6">
            Motor de Reservas Directas para Cabañas y Hospedaje{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400">
              Sin Comisiones de Airbnb
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Ahorra entre el 15% y el 25% que te descuentan las plataformas en cada reserva. Permite a tus huéspedes elegir fechas de Check-in y Check-out, número de personas y servicios adicionales con pago directo.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Link
              href="/registro?type=SERVICES"
              className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 text-slate-950 font-extrabold text-base shadow-xl shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all flex items-center justify-center gap-2"
            >
              <span>Empezar con mi Hospedaje</span>
              <ArrowRight className="w-5 h-5 text-slate-950" />
            </Link>
            <Link
              href="/reservas/demo"
              className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-200 font-bold text-base transition-all flex items-center justify-center gap-2 hover:bg-slate-850"
            >
              <Smartphone className="w-5 h-5 text-emerald-400" />
              <span>Ver Motor Demo (Cabañas & Glamping)</span>
            </Link>
          </div>

          {/* Interactive Feature Highlights */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto text-left">
            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur hover:border-emerald-500/40 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Calendar className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Check-in y Check-out Dinámico</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Tus huéspedes eligen sus fechas de llegada y salida. El sistema calcula automáticamente el número exacto de noches y el valor total de la estancia.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur hover:border-teal-500/40 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-teal-500/10 text-teal-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Coffee className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Venta de Extras & Experiencias</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Aumenta el ticket promedio ofreciendo desayunos campestres, cestas de leña para fogata, acceso a jacuzzi privado o tours a caballo.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur hover:border-emerald-500/40 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Percent className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Cero Porcentajes Retenidos</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                El 100% del pago entra directo a tu cuenta bancaria o billetera digital Deuna. Sin retenciones de 30 días ni cancelaciones injustificadas.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Vitrina Dinámica Marketplace de Hospedajes & Cabañas Sugeridos */}
      <VerticalMarketplaceSection data={marketplaceData} />

      {/* Tipos de Alojamientos */}
      <section className="py-16 bg-slate-900/40 border-y border-slate-800/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-8">
            Diseñado para Alojamientos con Encanto y Turismo
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 text-center">
              <div className="text-2xl mb-1">🏕️</div>
              <div className="font-bold text-white text-sm">Glampings & Domos</div>
              <div className="text-xs text-slate-400">Vistas a montañas, fogatas</div>
            </div>
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 text-center">
              <div className="text-2xl mb-1">🏡</div>
              <div className="font-bold text-white text-sm">Cabañas Rústicas</div>
              <div className="text-xs text-slate-400">Madera, chimenea, campo</div>
            </div>
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 text-center">
              <div className="text-2xl mb-1">🏨</div>
              <div className="font-bold text-white text-sm">Hostales & Lodges</div>
              <div className="text-xs text-slate-400">Habitaciones privadas y compartidas</div>
            </div>
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 text-center">
              <div className="text-2xl mb-1">🏖️</div>
              <div className="font-bold text-white text-sm">Casas de Playa & Campo</div>
              <div className="text-xs text-slate-400">Piscina privada, familias</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="py-24 text-center relative overflow-hidden">
        <div className="max-w-4xl mx-auto px-4 relative z-10">
          <h2 className="text-3xl sm:text-5xl font-black text-white mb-6">
            Empieza a recibir reservas directas en tu WhatsApp
          </h2>
          <p className="text-slate-400 text-base max-w-xl mx-auto mb-10">
            Comparte tu enlace de reservas en tu perfil de Instagram, Facebook y Google Maps y deja de regalar tus comisiones.
          </p>
          <Link
            href="/registro?type=SERVICES"
            className="inline-flex items-center gap-3 px-9 py-4 rounded-2xl bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 text-slate-950 font-extrabold text-lg shadow-xl shadow-emerald-500/30 transition-all hover:scale-105"
          >
            <span>Crear mi Motor de Reservas Ahora</span>
            <ArrowRight className="w-5 h-5 text-slate-950" />
          </Link>
        </div>
      </section>

      {/* Footer de Ecosistema Ubícame */}
      <EcosystemFooter currentVertical="reservas" />
    </div>
  );
}
