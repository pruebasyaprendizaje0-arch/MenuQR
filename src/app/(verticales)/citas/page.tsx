import React from "react";
import Link from "next/link";
import type { Metadata } from "next";
import {
  Calendar,
  Zap,
  ArrowRight,
  CheckCircle2,
  Clock,
  UserCheck,
  BellRing,
  Sparkles,
  Smartphone,
  ShieldCheck,
  Scissors,
  Stethoscope,
  Smile,
} from "lucide-react";
import { getVerticalMarketplaceData } from "@/lib/marketplace";
import { VerticalMarketplaceSection } from "@/components/marketplace/VerticalMarketplaceSection";
import { EcosystemFooter } from "@/components/footer/EcosystemFooter";

export const metadata: Metadata = {
  title: "Citas Pro | Agenda de Turnos y Especialistas para WhatsApp",
  description:
    "Sistema inteligente de agendamiento de turnos online para consultorios médicos, dentistas, barberías y salones de belleza. Recordatorios automáticos a WhatsApp.",
  keywords: [
    "Agenda de citas online",
    "Turnos barbería WhatsApp",
    "Agenda dentistas consultorios Ecuador",
    "Reservar turnos estética",
    "Software de citas WhatsApp",
  ],
};

export default async function CitasLandingPage() {
  const marketplaceData = await getVerticalMarketplaceData("citas");
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-purple-500 selection:text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-slate-950/80 border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="h-11 w-11 rounded-2xl bg-gradient-to-tr from-purple-500 to-indigo-500 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-purple-500/20 group-hover:scale-105 transition-transform">
                <Calendar className="w-6 h-6 text-white" />
              </div>
              <div>
                <span className="text-lg font-black tracking-tight text-white block">
                  Citas <span className="text-purple-400">Pro</span>
                </span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block -mt-1">
                  Salud, Belleza & Barberías
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
              <span className="px-3 py-1.5 rounded-full bg-purple-500 text-white font-bold shadow-md shadow-purple-500/30 flex items-center gap-1.5">
                📅 Citas & Barberías
              </span>
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
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 shadow-lg shadow-purple-500/20 transition-all flex items-center gap-2"
            >
              <span>Activar mi Agenda</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-12 pb-24 overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-gradient-to-b from-purple-500/15 via-indigo-500/10 to-transparent rounded-full blur-[120px] pointer-events-none"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-950/60 border border-purple-800/60 text-purple-400 text-xs font-bold mb-8 shadow-inner animate-pulse">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span>Vertical Oficial: citas.ubicame.cc • Agenda de Turnos 24/7</span>
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black text-white tracking-tight max-w-4xl mx-auto leading-[1.1] mb-6">
            Agenda Inteligente de Citas y Turnos{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-indigo-400">
              Disponible las 24 Horas
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Permite que tus pacientes o clientes reserven su turno eligiendo al especialista de su confianza, el servicio y el horario exacto. Con confirmaciones directas por WhatsApp.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Link
              href="/registro?type=SERVICES"
              className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 text-white font-extrabold text-base shadow-xl shadow-purple-500/25 hover:shadow-purple-500/40 transition-all flex items-center justify-center gap-2"
            >
              <span>Crear mi Agenda Gratis</span>
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              href="/citas/demo"
              className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-200 font-bold text-base transition-all flex items-center justify-center gap-2 hover:bg-slate-850"
            >
              <Smartphone className="w-5 h-5 text-purple-400" />
              <span>Ver Agenda Demo (Consultorio & Barbería)</span>
            </Link>
          </div>

          {/* Interactive Feature Highlights */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto text-left">
            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur hover:border-purple-500/40 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <UserCheck className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Selección de Especialista</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Tus clientes eligen qué doctor, barbero o terapeuta desean que los atienda con foto, especialidad y horarios personalizados.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur hover:border-purple-500/40 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-pink-500/10 text-pink-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Clock className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Duración y Horarios Dinámicos</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Cada servicio tiene su tiempo asignado (30m, 45m, 1h). El calendario bloquea automáticamente franjas ocupadas para evitar dobles turnos.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur hover:border-purple-500/40 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <BellRing className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Cero Ausentismos</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                El paciente recibe el resumen formal de su cita directo en WhatsApp para guardarlo en su calendario o confirmar asistencia con un toque.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Vitrina Dinámica Marketplace de Citas & Servicios Sugeridos */}
      <VerticalMarketplaceSection data={marketplaceData} />

      {/* Sectores destacados */}
      <section className="py-16 bg-slate-900/40 border-y border-slate-800/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-8">
            Solución Perfecta para Negocios Basados en Turnos
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 text-center">
              <div className="text-2xl mb-1">🦷</div>
              <div className="font-bold text-white text-sm">Odontología & Dentistas</div>
              <div className="text-xs text-slate-400">Limpiezas, ortodoncia, cirugías</div>
            </div>
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 text-center">
              <div className="text-2xl mb-1">💈</div>
              <div className="font-bold text-white text-sm">Barberías & Salones VIP</div>
              <div className="text-xs text-slate-400">Cortes, barba, diseño capilar</div>
            </div>
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 text-center">
              <div className="text-2xl mb-1">🩺</div>
              <div className="font-bold text-white text-sm">Consultorios Médicos</div>
              <div className="text-xs text-slate-400">Pediatría, ginecología, nutrición</div>
            </div>
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 text-center">
              <div className="text-2xl mb-1">💆</div>
              <div className="font-bold text-white text-sm">Spas & Estética</div>
              <div className="text-xs text-slate-400">Masajes, faciales, uñas acrílicas</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="py-24 text-center relative overflow-hidden">
        <div className="max-w-4xl mx-auto px-4 relative z-10">
          <h2 className="text-3xl sm:text-5xl font-black text-white mb-6">
            Deja de responder mensajes a deshoras para agendar
          </h2>
          <p className="text-slate-400 text-base max-w-xl mx-auto mb-10">
            Comparte tu enlace en redes sociales y deja que tus clientes elijan su propio horario disponible en segundos.
          </p>
          <Link
            href="/registro?type=SERVICES"
            className="inline-flex items-center gap-3 px-9 py-4 rounded-2xl bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 text-white font-extrabold text-lg shadow-xl shadow-purple-500/30 transition-all hover:scale-105"
          >
            <span>Crear mi Agenda Online Gratis</span>
            <ArrowRight className="w-5 h-5 text-white" />
          </Link>
        </div>
      </section>

      {/* Footer de Ecosistema Ubícame */}
      <EcosystemFooter currentVertical="citas" />
    </div>
  );
}
