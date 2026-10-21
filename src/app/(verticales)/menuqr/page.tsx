import React from "react";
import Link from "next/link";
import type { Metadata } from "next";
import {
  UtensilsCrossed,
  QrCode,
  Zap,
  ArrowRight,
  CheckCircle2,
  ChefHat,
  Smartphone,
  Flame,
  Users,
  Percent,
  Clock,
  Sparkles,
  ShoppingBag,
  Store,
  Calendar,
  Wrench,
  Hotel,
} from "lucide-react";

import { getVerticalMarketplaceData } from "@/lib/marketplace";
import { VerticalMarketplaceSection } from "@/components/marketplace/VerticalMarketplaceSection";
import { EcosystemFooter } from "@/components/footer/EcosystemFooter";

export const metadata: Metadata = {
  title: "MenuQR Pro | Menú Digital QR para Restaurantes, Bares y Cafeterías",
  description:
    "Digitaliza tu restaurante con pedidos directos a mesa, comandas en tiempo real a cocina, delivery por WhatsApp y cero comisiones. Desde $15/mes.",
  keywords: [
    "Menú QR Restaurantes",
    "Carta digital restaurantes Ecuador",
    "Pedidos a mesa QR",
    "Comandas cocina KDS",
    "Delivery WhatsApp restaurante",
  ],
};

export default async function MenuQRVerticalLanding() {
  const marketplaceData = await getVerticalMarketplaceData("restaurante");
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-red-500 selection:text-white">
      {/* Top Banner Navigation & Vertical Switcher */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-slate-950/80 border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="h-11 w-11 rounded-2xl bg-gradient-to-tr from-red-600 to-amber-500 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-red-500/20 group-hover:scale-105 transition-transform">
                <UtensilsCrossed className="w-6 h-6" />
              </div>
              <div>
                <span className="text-lg font-black tracking-tight text-white block">
                  MenuQR <span className="text-red-500">Pro</span>
                </span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block -mt-1">
                  Gastronomía & Bares
                </span>
              </div>
            </Link>

            {/* Vertical Switcher Tabs */}
            <div className="hidden lg:inline-flex p-1 bg-slate-900/90 rounded-full border border-slate-800 text-xs font-semibold gap-1">
              <span className="px-3 py-1.5 rounded-full bg-red-600 text-white font-bold shadow-md shadow-red-600/30 flex items-center gap-1.5">
                🍔 Restaurantes
              </span>
              <Link href="/ctalo" className="px-3 py-1.5 rounded-full text-slate-400 hover:text-white transition flex items-center gap-1.5">
                🛍️ Tiendas (Catálogo)
              </Link>
              <Link href="/servicios" className="px-3 py-1.5 rounded-full text-slate-400 hover:text-white transition flex items-center gap-1.5">
                🔧 Servicios Técnicos
              </Link>
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
              href="/registro?type=RESTAURANT"
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 shadow-lg shadow-red-600/20 transition-all flex items-center gap-2"
            >
              <span>Crear Menú Gratis</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-12 pb-24 overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-gradient-to-b from-red-600/15 via-amber-500/10 to-transparent rounded-full blur-[120px] pointer-events-none"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-950/60 border border-red-800/60 text-red-400 text-xs font-bold mb-8 shadow-inner animate-pulse">
            <Flame className="w-4 h-4 text-red-400" />
            <span>Vertical Oficial: menuqr.ubicame.cc • Especializada en Gastronomía</span>
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black text-white tracking-tight max-w-4xl mx-auto leading-[1.1] mb-6">
            El Menú Digital QR que{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-orange-400 to-amber-400">
              multiplica las ventas
            </span>{" "}
            de tu Restaurante
          </h1>

          <p className="text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Elimina las cartas de papel sucias y desactualizadas. Recibe pedidos directos de las mesas a la cocina, gestiona delivery a domicilio sin comisiones abusivas y divide cuentas al instante.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Link
              href="/registro?type=RESTAURANT"
              className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-extrabold text-base shadow-xl shadow-red-600/25 hover:shadow-red-600/40 transition-all flex items-center justify-center gap-2"
            >
              <span>Comenzar 30 Días Gratis</span>
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              href="/menuqr/demo"
              className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-200 font-bold text-base transition-all flex items-center justify-center gap-2 hover:bg-slate-850"
            >
              <Smartphone className="w-5 h-5 text-red-400" />
              <span>Ver Menú Interactivo Demo</span>
            </Link>
          </div>

          {/* Interactive Feature Highlights */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto text-left">
            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur hover:border-red-500/40 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-red-500/10 text-red-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <QrCode className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Códigos QR por Mesa</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Cada mesa tiene su código QR individualizado. Los clientes escanean, ordenan en tiempo real y solicitan la cuenta o atención del camarero.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur hover:border-amber-500/40 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <ChefHat className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Comandas de Cocina KDS</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Pantalla en tiempo real conectada a Socket.IO para el personal de cocina. Visualiza estados, notas de preparación y platos añadidos al momento.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur hover:border-orange-500/40 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-orange-500/10 text-orange-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">División de Cuenta (Split Bill)</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Los clientes pueden repartir el valor total de la cuenta equitativamente o por platos consumidos, con cálculo automático de propina e impuestos.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Vitrina Dinámica Marketplace de Platos Sugeridos & Populares */}
      <VerticalMarketplaceSection data={marketplaceData} />

      {/* Comparison Section: Cero Comisiones vs Apps de Delivery */}
      <section className="py-20 bg-slate-900/40 border-y border-slate-800/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4">
              ¿Por qué pagar hasta el 30% en cada pedido?
            </h2>
            <p className="text-slate-400 text-base">
              Compara el impacto de tener tu propio canal digital directo en WhatsApp vs plataformas intermediarias.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="p-8 rounded-3xl bg-slate-950/80 border border-red-500/30 relative overflow-hidden">
              <div className="absolute top-0 right-0 px-4 py-1.5 bg-red-600 text-white font-black text-xs uppercase rounded-bl-2xl">
                MenuQR Pro
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">Tu Propia Carta Digital</h3>
              <p className="text-slate-400 text-sm mb-6">Canal propio directo con tus comensales</p>
              <ul className="space-y-4 text-sm text-slate-300">
                <li className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <span><strong>0% de comisión</strong> por plato o pedido</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <span>Los datos y números de tus clientes son 100% tuyos</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <span>Cobro directo por Deuna, Transferencia o Efectivo</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <span>Tarifa fija transparente desde solo $15/mes</span>
                </li>
              </ul>
            </div>

            <div className="p-8 rounded-3xl bg-slate-900/50 border border-slate-800 text-slate-400">
              <h3 className="text-2xl font-bold text-slate-300 mb-2">Apps de Delivery Tradicionales</h3>
              <p className="text-slate-500 text-sm mb-6">Plataformas tercerizadas</p>
              <ul className="space-y-4 text-sm">
                <li className="flex items-center gap-3 text-red-400">
                  <span>❌</span>
                  <span>Hasta 25% - 30% de comisión por cada orden</span>
                </li>
                <li className="flex items-center gap-3 text-red-400">
                  <span>❌</span>
                  <span>Ocultan la información de tus clientes y promocionan a tu competencia</span>
                </li>
                <li className="flex items-center gap-3 text-red-400">
                  <span>❌</span>
                  <span>Pagos retenidos durante semanas</span>
                </li>
                <li className="flex items-center gap-3 text-red-400">
                  <span>❌</span>
                  <span>No sirven para comensales sentados dentro de tus mesas</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="py-24 text-center relative overflow-hidden">
        <div className="max-w-4xl mx-auto px-4 relative z-10">
          <h2 className="text-3xl sm:text-5xl font-black text-white mb-6">
            Activa el Menú QR de tu restaurante hoy mismo
          </h2>
          <p className="text-slate-400 text-base max-w-xl mx-auto mb-10">
            Sin contratos forzosos. Configura tus categorías, platos y mesas en menos de 10 minutos.
          </p>
          <Link
            href="/registro?type=RESTAURANT"
            className="inline-flex items-center gap-3 px-9 py-4 rounded-2xl bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-extrabold text-lg shadow-xl shadow-red-600/30 transition-all hover:scale-105"
          >
            <span>Crear Menú Digital Ahora</span>
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Footer de Ecosistema Ubícame */}
      <EcosystemFooter currentVertical="menuqr" />
    </div>
  );
}
