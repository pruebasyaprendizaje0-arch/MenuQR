import React from "react";
import Link from "next/link";
import type { Metadata } from "next";
import {
  ShoppingBag,
  Zap,
  ArrowRight,
  CheckCircle2,
  Tag,
  Palette,
  Truck,
  Layers,
  Sparkles,
  Smartphone,
  ShieldCheck,
  Percent,
} from "lucide-react";
import { getVerticalMarketplaceData } from "@/lib/marketplace";
import { VerticalMarketplaceSection } from "@/components/marketplace/VerticalMarketplaceSection";

export const metadata: Metadata = {
  title: "Catálogo Pro | E-Commerce con Variantes de Talla y Color para WhatsApp",
  description:
    "Crea tu catálogo e-commerce interactivo para ropa, calzado y joyería. Carrito de compras, selector de tallas y colores, y pedidos directos a WhatsApp sin comisiones.",
  keywords: [
    "Catálogo digital ropa",
    "Tienda calzado WhatsApp",
    "Catálogo e-commerce variantes",
    "Vender ropa WhatsApp Ecuador",
    "Tienda online sin comisiones",
  ],
};

export default async function CtaloLandingPage() {
  const marketplaceData = await getVerticalMarketplaceData("retail");
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-amber-500 selection:text-slate-950">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-slate-950/80 border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="h-11 w-11 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-400 flex items-center justify-center text-slate-950 font-black text-xl shadow-lg shadow-amber-500/20 group-hover:scale-105 transition-transform">
                <ShoppingBag className="w-6 h-6 text-slate-950" />
              </div>
              <div>
                <span className="text-lg font-black tracking-tight text-white block">
                  Catálogo <span className="text-amber-400">Pro</span>
                </span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block -mt-1">
                  Moda, Calzado & Joyería
                </span>
              </div>
            </Link>

            {/* Vertical Switcher Tabs */}
            <div className="hidden lg:inline-flex p-1 bg-slate-900/90 rounded-full border border-slate-800 text-xs font-semibold gap-1">
              <Link href="/menuqr" className="px-3 py-1.5 rounded-full text-slate-400 hover:text-white transition flex items-center gap-1.5">
                🍔 Restaurantes
              </Link>
              <span className="px-3 py-1.5 rounded-full bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/30 flex items-center gap-1.5">
                🛍️ Tiendas (Catálogo)
              </span>
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
              href="/registro?type=RETAIL"
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 shadow-lg shadow-amber-500/20 transition-all flex items-center gap-2"
            >
              <span>Crear Catálogo Gratis</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-12 pb-24 overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-gradient-to-b from-amber-500/15 via-yellow-500/10 to-transparent rounded-full blur-[120px] pointer-events-none"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-950/60 border border-amber-800/60 text-amber-400 text-xs font-bold mb-8 shadow-inner animate-pulse">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Vertical Oficial: catalogo.ubicame.cc / ctalo.ubicame.cc • E-Commerce WhatsApp</span>
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black text-white tracking-tight max-w-4xl mx-auto leading-[1.1] mb-6">
            Convierte tu Stock en Ventas con un{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-yellow-300 to-orange-400">
              Catálogo E-Commerce
            </span>{" "}
            para WhatsApp
          </h1>

          <p className="text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Permite que tus clientes elijan tallas, colores y unidades desde un carrito interactivo ultrarrápido y te envíen el pedido listo para despachar. Sin pasarelas lentas ni comisiones.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Link
              href="/registro?type=RETAIL"
              className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-extrabold text-base shadow-xl shadow-amber-500/25 hover:shadow-amber-500/40 transition-all flex items-center justify-center gap-2"
            >
              <span>Crear Tienda en 5 Minutos</span>
              <ArrowRight className="w-5 h-5 text-slate-950" />
            </Link>
            <Link
              href="/ctalo/demo"
              className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-200 font-bold text-base transition-all flex items-center justify-center gap-2 hover:bg-slate-850"
            >
              <Smartphone className="w-5 h-5 text-amber-400" />
              <span>Ver Catálogo Demo (Boutique)</span>
            </Link>
          </div>

          {/* Interactive Feature Highlights */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto text-left">
            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur hover:border-amber-500/40 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Palette className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Variantes de Tallas & Colores</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Tus clientes eligen la talla exacta (S, M, L o 38 a 43) y el tono preferido con muestras visuales. Olvídate de preguntar "¿en qué color buscabas?".
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur hover:border-amber-500/40 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-yellow-500/10 text-yellow-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <ShoppingBag className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Carrito Flotante & Checkout WhatsApp</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                El comprador añade múltiples prendas o accesorios al carrito. Al finalizar, recibes en tu WhatsApp un ticket ordenado con dirección de entrega y subtotal.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur hover:border-amber-500/40 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-orange-500/10 text-orange-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Truck className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Envíos a Domicilio o Retiro</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Configura tarifas de envío por sector o ciudad, o permite que recojan en tu local comercial sin costo de flete.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Vitrina Dinámica Marketplace de Productos Sugeridos & Populares */}
      <VerticalMarketplaceSection data={marketplaceData} />

      {/* Target Businesses */}
      <section className="py-16 bg-slate-900/40 border-y border-slate-800/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-8">
            Diseñado para Comercios que Venden por Redes Sociales
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 text-center">
              <div className="text-2xl mb-1">👗</div>
              <div className="font-bold text-white text-sm">Boutiques & Ropa</div>
              <div className="text-xs text-slate-400">Vestidos, blusas, jeans</div>
            </div>
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 text-center">
              <div className="text-2xl mb-1">👟</div>
              <div className="font-bold text-white text-sm">Tiendas de Calzado</div>
              <div className="text-xs text-slate-400">Sneakers, tacones, botas</div>
            </div>
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 text-center">
              <div className="text-2xl mb-1">💍</div>
              <div className="font-bold text-white text-sm">Joyería & Relojes</div>
              <div className="text-xs text-slate-400">Anillos, cadenas, plata</div>
            </div>
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 text-center">
              <div className="text-2xl mb-1">💄</div>
              <div className="font-bold text-white text-sm">Cosmética & Perfumes</div>
              <div className="text-xs text-slate-400">Skincare, maquillaje, aromas</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="py-24 text-center relative overflow-hidden">
        <div className="max-w-4xl mx-auto px-4 relative z-10">
          <h2 className="text-3xl sm:text-5xl font-black text-white mb-6">
            Lleva tu tienda de ropa o calzado al siguiente nivel
          </h2>
          <p className="text-slate-400 text-base max-w-xl mx-auto mb-10">
            Pon el enlace en tu biografía de Instagram o TikTok y empieza a cerrar ventas directamente por WhatsApp hoy.
          </p>
          <Link
            href="/registro?type=RETAIL"
            className="inline-flex items-center gap-3 px-9 py-4 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-extrabold text-lg shadow-xl shadow-amber-500/30 transition-all hover:scale-105"
          >
            <span>Crear Catálogo E-Commerce Gratis</span>
            <ArrowRight className="w-5 h-5 text-slate-950" />
          </Link>
        </div>
      </section>
    </div>
  );
}
