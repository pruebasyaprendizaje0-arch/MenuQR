import React from "react";
import Link from "next/link";
import { Metadata } from "next";
import { 
  ShoppingBag, 
  Zap, 
  CheckCircle2, 
  XCircle, 
  QrCode, 
  MessageSquare, 
  TrendingUp, 
  ShieldCheck, 
  Sparkles, 
  Store, 
  ArrowRight, 
  Check, 
  ChevronRight, 
  HelpCircle, 
  Globe, 
  PhoneCall, 
  Bot,
  Truck
} from "lucide-react";

export const metadata: Metadata = {
  title: "Catálogos Digitales e Interactivos para Comercios y Tiendas | MenuQR Pro",
  description: "Convierte tu inventario en ventas directas por WhatsApp en minutos. Sin comisiones por transacción, sin descargas de apps. Ideal para ropa, ferreterías, repuestos, farmacias y servicios.",
  keywords: ["Catálogo digital", "Tienda online WhatsApp", "Catálogo interactivo", "Ventas WhatsApp Ecuador", "Software para tiendas", "Menú QR comercio"],
};

export default function CatalogosLandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-amber-500 selection:text-slate-950">
      {/* Header / Navbar */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-slate-950/80 border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="h-11 w-11 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-400 flex items-center justify-center text-slate-950 font-black text-xl shadow-lg shadow-amber-500/20 group-hover:scale-105 transition-transform">
                MQR
              </div>
              <div>
                <span className="text-lg font-black tracking-tight text-white block">MenuQR <span className="text-amber-400">Pro</span></span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block -mt-1">Commerce SaaS</span>
              </div>
            </Link>

            {/* Navigation Context Switcher */}
            <div className="hidden md:inline-flex p-1 bg-slate-900 rounded-full border border-slate-800 text-xs font-semibold">
              <Link href="/" className="px-4 py-1.5 rounded-full text-slate-400 hover:text-white transition">
                🍔 Para Restaurantes
              </Link>
              <Link href="/catalogos" className="px-4 py-1.5 rounded-full bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20">
                🛍️ Para Tiendas y Comercios
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
              href="/registro?type=RETAIL" 
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 shadow-lg shadow-amber-500/10 transition-all flex items-center gap-2"
            >
              <span>Crear Catálogo Gratis</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-16 pb-24 overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-tr from-amber-500/15 via-orange-500/10 to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="text-center max-w-3xl mx-auto space-y-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold">
              <Sparkles className="w-4 h-4 animate-pulse" />
              <span>0% Comisiones por Venta • Pedidos Directos a WhatsApp</span>
            </div>

            <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-white leading-[1.1]">
              Convierte tu inventario en <span className="bg-clip-text text-transparent bg-gradient-to-r from-amber-400 via-orange-400 to-amber-300">ventas por WhatsApp</span> en minutos
            </h1>

            <p className="text-lg sm:text-xl text-slate-300 font-normal leading-relaxed">
              Publica tus productos físicos, ropa, repuestos o servicios profesionales en un catálogo web ultrarrápido. Tus clientes exploran, arman su pedido y lo envían directo a tu WhatsApp.
            </p>

            <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/registro?type=RETAIL"
                className="w-full sm:w-auto px-8 py-4 rounded-2xl text-sm font-black text-slate-950 bg-gradient-to-r from-amber-400 via-amber-300 to-orange-400 hover:from-amber-300 hover:to-orange-300 shadow-xl shadow-amber-500/20 transition-all flex items-center justify-center gap-2 group"
              >
                <ShoppingBag className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                <span>Crear mi Catálogo Digital Gratis</span>
              </Link>
              <a
                href="#demo"
                className="w-full sm:w-auto px-8 py-4 rounded-2xl text-sm font-bold text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 transition-all flex items-center justify-center gap-2"
              >
                <span>Ver Demostración</span>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </a>
            </div>

            {/* Badges */}
            <div className="pt-8 flex flex-wrap items-center justify-center gap-6 text-xs font-semibold text-slate-400">
              <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Sin descargas de apps</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Carga inmediata de SKUs</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Código QR para mostrador y empaques</span>
            </div>
          </div>
        </div>
      </section>

      {/* Target Verticals Grid */}
      <section className="py-16 bg-slate-900/50 border-y border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">Diseñado para Cualquier Tipo de Comercio</h2>
            <p className="text-slate-400 text-sm mt-2">Adaptable con un clic a la terminología de tu sector comercial.</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 hover:border-amber-500/50 transition-all group">
              <span className="text-3xl block mb-3 group-hover:scale-110 transition-transform">👗</span>
              <h3 className="font-bold text-white text-base">Boutiques & Ropa</h3>
              <p className="text-xs text-slate-400 mt-1">Variantes de talla, color, material y fotos en alta resolución.</p>
            </div>
            <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 hover:border-amber-500/50 transition-all group">
              <span className="text-3xl block mb-3 group-hover:scale-110 transition-transform">🛠️</span>
              <h3 className="font-bold text-white text-base">Ferreterías & Hogar</h3>
              <p className="text-xs text-slate-400 mt-1">Buscador instantáneo por SKU, marca o tipo de herramienta.</p>
            </div>
            <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 hover:border-amber-500/50 transition-all group">
              <span className="text-3xl block mb-3 group-hover:scale-110 transition-transform">💊</span>
              <h3 className="font-bold text-white text-base">Farmacias & Belleza</h3>
              <p className="text-xs text-slate-400 mt-1">Cosméticos, cuidado personal y suplementos con consulta rápida.</p>
            </div>
            <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 hover:border-amber-500/50 transition-all group">
              <span className="text-3xl block mb-3 group-hover:scale-110 transition-transform">💼</span>
              <h3 className="font-bold text-white text-base">Servicios Profesionales</h3>
              <p className="text-xs text-slate-400 mt-1">Tarifarios por hora o sesión y solicitud de cotización por WhatsApp.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Comparison: PDF vs MenuQR Pro Interactive Catalog */}
      <section id="demo" className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="text-xs font-bold uppercase tracking-widest text-amber-400 block mb-2">Evolución Comercial</span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white">¿Por qué los PDFs pasaron a la historia?</h2>
          <p className="text-slate-400 text-sm mt-3">Compara la experiencia de enviar un archivo estático pesado vs un catálogo interactivo fluido.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Traditional PDF */}
          <div className="bg-slate-900/60 p-8 rounded-3xl border border-red-500/20 space-y-6">
            <div className="flex items-center justify-between border-b border-red-500/20 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-red-500/10 text-red-400">
                  <XCircle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-white">PDFs / Catálogos Estáticos</h3>
                  <span className="text-xs text-red-400 font-semibold">Difícil de abrir y desactualizado</span>
                </div>
              </div>
            </div>
            <ul className="space-y-4 text-xs sm:text-sm text-slate-300">
              <li className="flex items-start gap-3">
                <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <span>Archivos pesados de 50MB que consumen los datos de tu cliente.</span>
              </li>
              <li className="flex items-start gap-3">
                <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <span>Imposible de actualizar sin volver a diseñar y reenviar a todos.</span>
              </li>
              <li className="flex items-start gap-3">
                <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <span>El cliente debe escribir manualmente qué producto desea en WhatsApp.</span>
              </li>
              <li className="flex items-start gap-3">
                <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <span>Sin buscador por palabras ni filtros por categoría o talla.</span>
              </li>
            </ul>
          </div>

          {/* MenuQR Pro Catalog */}
          <div className="bg-gradient-to-b from-amber-500/10 to-slate-900 p-8 rounded-3xl border border-amber-500/40 space-y-6 shadow-2xl relative">
            <div className="absolute top-4 right-4 px-3 py-1 bg-amber-500 text-slate-950 text-[10px] font-black uppercase tracking-wider rounded-full shadow-md">
              Recomendado
            </div>
            <div className="flex items-center justify-between border-b border-amber-500/30 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-white">Catálogo Digital MenuQR Pro</h3>
                  <span className="text-xs text-amber-300 font-semibold">Ultrarrápido e interactivo</span>
                </div>
              </div>
            </div>
            <ul className="space-y-4 text-xs sm:text-sm text-slate-200">
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <span>Carga instantánea en menos de 1 segundo en cualquier smartphone.</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <span>Cambia precios, stock o fotos en tiempo real desde tu celular.</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <span>Carrito interactivo que genera el mensaje estructurado para WhatsApp.</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <span>Buscador inteligente por código SKU, nombre o categoría.</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Feature Highlights */}
      <section className="py-16 bg-slate-900/40 border-t border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8">
            <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="p-3 w-fit rounded-xl bg-amber-500/10 text-amber-400">
                <QrCode className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-white text-lg">Código QR para Vitrinas</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Coloca tu QR en mostradores, fundas de empaque y tarjetas de presentación para que tus clientes descubran todo tu catálogo.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="p-3 w-fit rounded-xl bg-emerald-500/10 text-emerald-400">
                <MessageSquare className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-white text-lg">WhatsApp Bot Automático</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Responde preguntas frecuentes, envía la ubicación del local y datos bancarios de forma determinista 24/7.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="p-3 w-fit rounded-xl bg-blue-500/10 text-blue-400">
                <Truck className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-white text-lg">Envíos y Retiros</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Permite a tus clientes elegir entre despacho a domicilio con tarifas por zona o retiro directo en tu tienda física.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="text-xs font-bold uppercase tracking-widest text-amber-400 block mb-2">Planes Transparentes</span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white">Invierte en hacer crecer tus ventas</h2>
          <p className="text-slate-400 text-sm mt-3">Sin contratos forzosos. Cancela o cambia de plan en cualquier momento.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Plan Gratuito */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 space-y-6">
            <div>
              <h3 className="text-xl font-bold text-white">Plan Prueba Gratuita</h3>
              <p className="text-xs text-slate-400 mt-1">Ideal para comenzar a digitalizar tu inventario.</p>
              <div className="mt-4">
                <span className="text-4xl font-black text-white">$0</span>
                <span className="text-xs text-slate-400 font-medium"> / 30 días</span>
              </div>
            </div>

            <ul className="space-y-3 text-xs text-slate-300">
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Hasta 20 productos en catálogo</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Código QR descargable de alta definición</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Pedidos y consultas directas a WhatsApp</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Personalización de colores y datos del negocio</li>
            </ul>

            <Link
              href="/registro?type=RETAIL"
              className="block w-full text-center py-3 px-4 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white transition-all"
            >
              Probar Gratis
            </Link>
          </div>

          {/* Plan PRO */}
          <div className="bg-gradient-to-b from-amber-500/10 via-slate-900 to-slate-950 border-2 border-amber-500/50 rounded-3xl p-8 space-y-6 relative shadow-2xl">
            <div className="absolute -top-3.5 right-6 px-3 py-1 bg-amber-500 text-slate-950 text-[10px] font-black uppercase tracking-wider rounded-full">
              Más Popular
            </div>

            <div>
              <h3 className="text-xl font-bold text-white">Plan Comercial PRO</h3>
              <p className="text-xs text-amber-300/80 mt-1">Para tiendas y comercios que buscan vender sin límites.</p>
              <div className="mt-4">
                <span className="text-4xl font-black text-white">$14.99</span>
                <span className="text-xs text-slate-400 font-medium"> / mes</span>
              </div>
            </div>

            <ul className="space-y-3 text-xs text-slate-200">
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-amber-400" /> Productos y categorías ilimitadas</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-amber-400" /> Control de SKUs, variantes de talla/color y stock</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-amber-400" /> Pedidos y reservas directas por WhatsApp</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-amber-400" /> Importación masiva de inventario desde Excel</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-amber-400" /> Módulos de cupones de descuento y analíticas</li>
            </ul>

            <Link
              href="/registro?type=RETAIL"
              className="block w-full text-center py-3 px-4 rounded-xl text-xs font-black text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 to-amber-400 shadow-lg shadow-amber-500/20 transition-all"
            >
              Comenzar con Plan PRO
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 bg-slate-900/50 border-t border-slate-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">Preguntas Frecuentes</h2>
          </div>

          <div className="space-y-4">
            <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800">
              <h3 className="font-bold text-white text-sm">¿Cobran comisiones por las ventas que realizo?</h3>
              <p className="text-xs text-slate-400 mt-2">No. En MenuQR Pro cobramos 0% de comisión por venta. Las ventas se acuerdan directamente entre tú y tu comprador por WhatsApp.</p>
            </div>
            <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800">
              <h3 className="font-bold text-white text-sm">¿Mis clientes deben descargar alguna aplicación?</h3>
              <p className="text-xs text-slate-400 mt-2">No. Tu catálogo funciona como una página web ultrarrápida. Tus clientes escanean el código QR o abren tu enlace desde cualquier celular.</p>
            </div>
            <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800">
              <h3 className="font-bold text-white text-sm">¿Puedo subir mis productos desde un archivo de Excel?</h3>
              <p className="text-xs text-slate-400 mt-2">Sí. Contamos con un importador masivo en Excel/CSV para cargar cientos de productos en cuestión de segundos.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-10 bg-slate-950 text-slate-500 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-300">MenuQR Pro</span>
            <span>© {new Date().getFullYear()} Todos los derechos reservados.</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/" className="hover:text-slate-300 transition">Para Restaurantes</Link>
            <Link href="/catalogos" className="hover:text-slate-300 transition">Para Comercios</Link>
            <Link href="/privacidad" className="hover:text-slate-300 transition">Privacidad</Link>
            <Link href="/terminos" className="hover:text-slate-300 transition">Términos</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
