import Link from "next/link";
import type { Metadata } from "next";
import {
  UtensilsCrossed,
  Sparkles,
  QrCode,
  ShoppingBag,
  Wrench,
  Calendar,
  Hotel,
  ShieldCheck,
  ArrowRight,
  MapPin,
  HelpCircle,
  CheckCircle2,
  Zap,
  Rocket,
  Headphones,
  Globe,
  Layers,
  Trees,
} from "lucide-react";
import { prismaControl, prismaTenant } from "@/lib/db";
import { LandingSearch } from "./components/LandingSearch";
import { MarketplaceShowcase } from "./components/MarketplaceShowcase";
import { getMarketplaceDishesAction } from "@/lib/suggested-dishes-actions";
import { EcosystemFooter } from "@/components/footer/EcosystemFooter";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Ubícame.cc | Plataforma Todo-en-Uno para Vender, Cotizar y Agendar",
  description:
    "Ecosistema SaaS multi-vertical con subdominios especializados en Ecuador y Latinoamérica: MenuQR (Restaurantes), Catálogo (Moda y Joyería), Servicios (Técnicos), Citas (Turnos) y Reservas (Hospedaje).",
  keywords: [
    "Ubícame.cc",
    "SaaS Ecuador",
    "MenuQR Pro",
    "Catálogo WhatsApp",
    "Agenda de turnos online",
    "Cotizador de servicios técnicos",
    "Motor de reservas cabañas",
    "Plataforma multi-vertical",
  ],
};

export default async function InstitutionalLandingPage() {
  // Obtener negocios para el directorio público
  let restaurants: any[] = [];
  try {
    restaurants = await prismaTenant.restaurant.findMany({
      select: {
        id: true,
        slug: true,
        name: true,
        logoUrl: true,
        specialty: true,
        locality: true,
        description: true,
        themeColor: true,
        latitude: true,
        longitude: true,
        parish: true,
        sector: true,
        businessType: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 24,
    });
  } catch (error) {
    console.error("Error fetching businesses on root landing page:", error);
    restaurants = [];
  }

  // Obtener productos destacados del marketplace
  let marketplaceData = { dishes: [] as any[], total: 0, restaurantCount: 0, storeCount: 0 };
  try {
    const mRes = await getMarketplaceDishesAction({
      type: "all",
      onlySuggested: true,
      limit: 8,
    });
    if (mRes.success) {
      marketplaceData = mRes;
    }
  } catch (error) {
    console.warn("Error fetching marketplace data for landing:", error);
  }

  let whatsappSupport = "";
  try {
    const whatsappSupportSetting = await prismaControl.systemSetting.findUnique({
      where: { key: "whatsapp_support" },
    });
    whatsappSupport =
      whatsappSupportSetting?.value ||
      process.env.NEXT_PUBLIC_WHATSAPP_SUPPORT ||
      process.env.WHATSAPP_SUPPORT ||
      "593999999999";
  } catch {
    whatsappSupport =
      process.env.NEXT_PUBLIC_WHATSAPP_SUPPORT ||
      process.env.WHATSAPP_SUPPORT ||
      "593999999999";
  }

  const rawPhone = (whatsappSupport || "593999999999").toString();
  let formattedPhone = rawPhone.replace(/\D/g, "");
  if (!formattedPhone.startsWith("593") && formattedPhone.startsWith("0")) {
    formattedPhone = "593" + formattedPhone.substring(1);
  } else if (!formattedPhone.startsWith("593") && formattedPhone.length === 9) {
    formattedPhone = "593" + formattedPhone;
  }

  const waUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(
    "Hola, quisiera saber más sobre la plataforma multi-vertical Ubícame.cc"
  )}`;

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        "name": "¿Qué es Ubícame.cc y qué verticales incluye?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Ubícame.cc es la plataforma SaaS multi-tenant todo-en-uno que digitaliza negocios bajo subdominios dinámicos dedicados: MenuQR (Restaurantes y Bares), Catálogo (Tiendas de Ropa, Calzado y Joyería), Servicios (Cotizador técnico express con GPS), Citas (Agenda de turnos online para consultorios y barberías) y Reservas (Motor para cabañas y hostales).",
        },
      },
      {
        "@type": "Question",
        "name": "¿Ubícame cobra comisiones por cada pedido o reserva?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "No, todas las verticales de Ubícame operan con 0% de comisiones por venta. El 100% de los ingresos de tus productos, servicios o habitaciones va directamente a tu negocio.",
        },
      },
      {
        "@type": "Question",
        "name": "¿Cómo funcionan los subdominios dinámicos?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Cada vertical cuenta con su propio subdominio especializado (menuqr.ubicame.cc, catalogo.ubicame.cc, servicios.ubicame.cc, citas.ubicame.cc, reservas.ubicame.cc) optimizado en diseño, flujo de compra y SEO para su industria específica.",
        },
      },
    ],
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between relative overflow-hidden font-sans selection:bg-indigo-500 selection:text-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      {/* Header Institucional */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-slate-950/80 border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="h-11 w-11 rounded-2xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform">
                <Globe className="w-6 h-6 text-white" />
              </div>
              <div>
                <span className="text-xl font-black tracking-tight text-white block">
                  Ubícame<span className="text-indigo-400">.cc</span>
                </span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block -mt-1">
                  Ecosistema Multi-Vertical SaaS
                </span>
              </div>
            </Link>

            {/* Selector Rápido de Verticales */}
            <nav className="hidden lg:inline-flex p-1 bg-slate-900/90 rounded-full border border-slate-800 text-xs font-semibold gap-1">
              <Link href="/menuqr" className="px-3 py-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition">
                🍔 Restaurantes
              </Link>
              <Link href="/ctalo" className="px-3 py-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition">
                🛍️ Catálogo
              </Link>
              <Link href="/servicios" className="px-3 py-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition">
                🔧 Servicios
              </Link>
              <Link href="/citas" className="px-3 py-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition">
                📅 Citas
              </Link>
              <Link href="/reservas" className="px-3 py-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition">
                🏡 Reservas
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-900 transition-all"
            >
              Iniciar Sesión
            </Link>
            <Link
              href="/registro"
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:opacity-90 shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-2"
            >
              <span>Registrar Negocio</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Institucional */}
      <section className="relative pt-16 pb-24 overflow-hidden text-center">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] bg-gradient-to-b from-indigo-500/15 via-purple-500/10 to-transparent rounded-full blur-[140px] pointer-events-none"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-950/60 border border-indigo-800/60 text-indigo-300 text-xs font-bold mb-8 shadow-inner animate-pulse">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <span>Arquitectura Multi-Tenant Dinámica • 5 Verticales de Negocio</span>
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black text-white tracking-tight max-w-5xl mx-auto leading-[1.1] mb-6">
            La Plataforma Todo-en-Uno para{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400">
              Vender, Cotizar y Agendar
            </span>{" "}
            en Ecuador y Latinoamérica
          </h1>

          <p className="text-lg sm:text-xl text-slate-400 max-w-3xl mx-auto mb-12 leading-relaxed">
            Potencia tu negocio con subdominios especializados, pedidos sin comisiones a WhatsApp, control en tiempo real y la mejor experiencia para tus clientes en cada sector.
          </p>

          {/* Grid de las 5 Verticales de Negocio */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto text-left mb-16">
            {/* 1. MenuQR */}
            <Link
              href="/menuqr"
              className="p-7 rounded-3xl bg-slate-900/70 border border-slate-800 hover:border-red-500/50 backdrop-blur transition-all group flex flex-col justify-between shadow-xl"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-red-500/15 text-red-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <UtensilsCrossed className="w-6 h-6" />
                  </div>
                  <span className="text-[11px] font-bold text-red-400 bg-red-950/60 px-3 py-1 rounded-full border border-red-800/50">
                    menuqr.ubicame.cc
                  </span>
                </div>
                <h3 className="text-xl font-black text-white mb-2 group-hover:text-red-400 transition-colors">
                  MenuQR Pro
                </h3>
                <p className="text-slate-400 text-xs leading-relaxed mb-4">
                  Restaurantes, Bares, Cafés y Food Trucks. Pedidos a mesa con códigos QR únicos, comandas KDS a cocina y división de cuenta inteligente.
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-red-400 group-hover:translate-x-1 transition-transform">
                <span>Explorar Vertical Restaurantes</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </Link>

            {/* 2. Catálogo Pro */}
            <Link
              href="/ctalo"
              className="p-7 rounded-3xl bg-slate-900/70 border border-slate-800 hover:border-amber-500/50 backdrop-blur transition-all group flex flex-col justify-between shadow-xl"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <ShoppingBag className="w-6 h-6" />
                  </div>
                  <span className="text-[11px] font-bold text-amber-400 bg-amber-950/60 px-3 py-1 rounded-full border border-amber-800/50">
                    catalogo.ubicame.cc
                  </span>
                </div>
                <h3 className="text-xl font-black text-white mb-2 group-hover:text-amber-400 transition-colors">
                  Catálogo E-Commerce
                </h3>
                <p className="text-slate-400 text-xs leading-relaxed mb-4">
                  Tiendas de Ropa, Calzado, Joyería y Boutiques. Carrito de compras flotante, selector de tallas y colores, y checkout directo a WhatsApp.
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400 group-hover:translate-x-1 transition-transform">
                <span>Explorar Vertical Catálogo</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </Link>

            {/* 3. Servicios Pro */}
            <Link
              href="/servicios"
              className="p-7 rounded-3xl bg-slate-900/70 border border-slate-800 hover:border-cyan-500/50 backdrop-blur transition-all group flex flex-col justify-between shadow-xl"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-cyan-500/15 text-cyan-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Wrench className="w-6 h-6" />
                  </div>
                  <span className="text-[11px] font-bold text-cyan-400 bg-cyan-950/60 px-3 py-1 rounded-full border border-cyan-800/50">
                    servicios.ubicame.cc
                  </span>
                </div>
                <h3 className="text-xl font-black text-white mb-2 group-hover:text-cyan-400 transition-colors">
                  Servicios Técnicos
                </h3>
                <p className="text-slate-400 text-xs leading-relaxed mb-4">
                  Técnicos, Plomeros, Electricistas y Cerrajería. Cotizador express en 60 segundos con subida de fotos del desperfecto y geolocalización GPS.
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-cyan-400 group-hover:translate-x-1 transition-transform">
                <span>Explorar Cotizador Express</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </Link>

            {/* 4. Citas Pro */}
            <Link
              href="/citas"
              className="p-7 rounded-3xl bg-slate-900/70 border border-slate-800 hover:border-purple-500/50 backdrop-blur transition-all group flex flex-col justify-between shadow-xl"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-purple-500/15 text-purple-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Calendar className="w-6 h-6" />
                  </div>
                  <span className="text-[11px] font-bold text-purple-400 bg-purple-950/60 px-3 py-1 rounded-full border border-purple-800/50">
                    citas.ubicame.cc
                  </span>
                </div>
                <h3 className="text-xl font-black text-white mb-2 group-hover:text-purple-400 transition-colors">
                  Agenda de Citas & Turnos
                </h3>
                <p className="text-slate-400 text-xs leading-relaxed mb-4">
                  Consultorios Médicos, Dentistas, Barberías y Spas. Selector de especialista, catálogo de tratamientos con duración y franjas horarias 24/7.
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-purple-400 group-hover:translate-x-1 transition-transform">
                <span>Explorar Agenda de Citas</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </Link>

            {/* 5. Reservas Pro */}
            <Link
              href="/reservas"
              className="p-7 rounded-3xl bg-slate-900/70 border border-slate-800 hover:border-emerald-500/50 backdrop-blur transition-all group flex flex-col justify-between shadow-xl md:col-span-2 lg:col-span-1"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Trees className="w-6 h-6" />
                  </div>
                  <span className="text-[11px] font-bold text-emerald-400 bg-emerald-950/60 px-3 py-1 rounded-full border border-emerald-800/50">
                    reservas.ubicame.cc
                  </span>
                </div>
                <h3 className="text-xl font-black text-white mb-2 group-hover:text-emerald-400 transition-colors">
                  Hospedaje & Cabañas
                </h3>
                <p className="text-slate-400 text-xs leading-relaxed mb-4">
                  Hostales, Glampings y Casas Vacacionales. Motor de reservas directas con Check-in/Check-out, cálculo de noches y extras sin el 20% de Airbnb.
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 group-hover:translate-x-1 transition-transform">
                <span>Explorar Motor de Reservas</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </Link>

            {/* Tarjeta de Registro Directo */}
            <div className="p-7 rounded-3xl bg-gradient-to-br from-indigo-950/70 via-purple-950/70 to-slate-900 border border-indigo-800/50 flex flex-col justify-between shadow-xl">
              <div>
                <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 inline-block mb-3">
                  Puesta en Marcha Inmediata
                </span>
                <h3 className="text-xl font-black text-white mb-2">¿Quieres que configuremos tu negocio?</h3>
                <p className="text-slate-400 text-xs leading-relaxed mb-4">
                  Envíanos fotos de tus productos, carta o servicios por WhatsApp y nuestro equipo lo digitaliza en menos de 24 horas.
                </p>
              </div>
              <a
                href={waUrl}
                target="_blank"
                rel="noreferrer"
                className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs text-center shadow-lg transition"
              >
                Hablar con un Asesor por WhatsApp
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Directorio Público de Negocios Registrados */}
      {restaurants.length > 0 && (
        <section className="py-16 bg-slate-900/40 border-t border-slate-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-10">
              <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-slate-300 border border-slate-700">
                Directorio Unificado Ubícame
              </span>
              <h2 className="text-3xl font-extrabold text-white mt-2">
                Negocios que confían en nuestra plataforma
              </h2>
            </div>

            <LandingSearch restaurants={restaurants} />
          </div>
        </section>
      )}

      {/* Vitrina de Productos / Platos Sugeridos */}
      {marketplaceData.dishes && marketplaceData.dishes.length > 0 && (
        <section className="py-16 border-t border-slate-800 bg-slate-950">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <MarketplaceShowcase
              initialDishes={marketplaceData.dishes}
              restaurantCount={marketplaceData.restaurantCount}
              storeCount={marketplaceData.storeCount}
            />
          </div>
        </section>
      )}

      {/* Footer de Ecosistema Ubícame */}
      <EcosystemFooter currentVertical="hub" whatsappSupport={whatsappSupport} />
    </div>
  );
}
