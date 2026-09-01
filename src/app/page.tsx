import Link from "next/link";
import { UtensilsCrossed, Sparkles, QrCode, MessageSquare, ShieldCheck, ArrowRight, MapPin, HelpCircle } from "lucide-react";
import { prismaControl, prismaTenant } from "@/lib/db";
import { LandingSearch } from "./components/LandingSearch";
import { ScrollVideoBackground } from "./components/ScrollVideoBackground";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  // Query all restaurants from the DB to build the public directory safely
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
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  } catch (error) {
    console.error("Error fetching restaurants on root landing page:", error);
    restaurants = [];
  }

  let whatsappSupport = "";
  try {
    const whatsappSupportSetting = await prismaControl.systemSetting.findUnique({
      where: { key: "whatsapp_support" }
    });
    whatsappSupport = whatsappSupportSetting?.value || process.env.NEXT_PUBLIC_WHATSAPP_SUPPORT || process.env.WHATSAPP_SUPPORT || "593999999999";
  } catch (error) {
    console.warn("WARNING: SystemSetting table is missing or not migrated yet.", error);
    whatsappSupport = process.env.NEXT_PUBLIC_WHATSAPP_SUPPORT || process.env.WHATSAPP_SUPPORT || "593999999999";
  }

  const rawPhone = (whatsappSupport || "593999999999").toString();
  let formattedPhone = rawPhone.replace(/\D/g, "");
  if (!formattedPhone.startsWith("593") && formattedPhone.startsWith("0")) {
    formattedPhone = "593" + formattedPhone.substring(1);
  } else if (!formattedPhone.startsWith("593") && formattedPhone.length === 9) {
    formattedPhone = "593" + formattedPhone;
  }

  const waUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent("Hola, quisiera saber más información sobre MenuQR Pro")}`;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between relative overflow-hidden font-sans">
      <ScrollVideoBackground />
      {/* Background decoration */}
      <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-red-600/10 rounded-full blur-[150px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-amber-600/10 rounded-full blur-[150px] pointer-events-none"></div>

      {/* Header */}
      <header className="max-w-6xl w-full mx-auto px-6 py-6 flex items-center justify-between relative z-10">
        <div className="flex items-center gap-2">
          <div className="h-10 w-10 bg-gradient-to-tr from-red-600 to-amber-500 rounded-xl flex items-center justify-center shadow-lg">
            <UtensilsCrossed className="h-5 w-5 text-white" />
          </div>
          <span className="font-extrabold text-white text-lg tracking-tight">
            MenuQR <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-amber-500">Pro</span>
          </span>
        </div>
        <Link 
          href="/admin" 
          className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 border border-slate-800 hover:bg-slate-800 rounded-xl transition"
        >
          Iniciar Sesión
        </Link>
      </header>

      {/* Hero section */}
      <main className="max-w-5xl w-full mx-auto px-6 py-12 md:py-20 flex flex-col items-center text-center relative z-10 space-y-16">
        
        {/* Top Hero Text */}
        <div className="space-y-8 flex flex-col items-center max-w-3xl animate-fade-in">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-[10px] uppercase tracking-wider font-extrabold text-amber-500">
            <Sparkles className="h-3 w-3 animate-spin" /> Plataforma SaaS Ultra Moderna
          </div>

          <div className="space-y-6">
            <h1 className="text-4xl md:text-6xl font-extrabold text-white leading-tight tracking-tight">
              Crea tu Menú Digital QR <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-orange-500 to-amber-500">
                Profesional en Segundos
              </span>
            </h1>
            <p className="text-slate-400 text-sm md:text-base max-w-2xl mx-auto leading-relaxed">
              Digitaliza tu restaurante, genera códigos QR para tus mesas y recibe pedidos completos directamente en tu WhatsApp de forma automatizada.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center w-full max-w-sm pt-2">
            <Link 
              href="/mamma-mia"
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3.5 rounded-2xl font-bold text-xs uppercase tracking-wider text-white bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 shadow-xl shadow-red-950/20 transform hover:scale-[1.02] transition-all duration-200"
            >
              Ver Menú de Demo
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link 
              href="/registro" 
              className="w-full sm:w-auto px-8 py-3.5 rounded-2xl font-bold text-xs uppercase tracking-wider bg-slate-900 border border-slate-800 hover:bg-slate-800 text-white transition-all text-center"
            >
              Empezar Gratis
            </Link>
          </div>
        </div>

        {/* Dedicated Spacing Block: Exposes the full-screen background video in the center */}
        <div className="py-20 md:py-36 w-full pointer-events-none"></div>

        {/* Directory Search & Filter Section */}
        <div className="w-full space-y-6 pt-4">
          <div className="flex items-center justify-center gap-2 text-amber-500 text-xs font-black uppercase tracking-widest">
            <Sparkles className="h-4 w-4" />
            <span>Negocios Registrados ({restaurants.length})</span>
          </div>

          <LandingSearch restaurants={restaurants} />
        </div>

        {/* Features grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full text-left pt-12">
          <div className="bg-slate-900/60 border border-slate-800/80 p-6 rounded-3xl space-y-4 hover:border-red-500/30 transition duration-300">
            <div className="h-12 w-12 bg-red-950/50 border border-red-900/50 rounded-2xl flex items-center justify-center text-red-500">
              <QrCode className="h-6 w-6" />
            </div>
            <h3 className="font-extrabold text-white text-lg">Códigos QR Ilimitados</h3>
            <p className="text-slate-400 text-xs leading-relaxed">
              Genera e imprime códigos QR para cada mesa o punto de venta. Tus clientes escanean y ven el menú al instante sin descargar apps.
            </p>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 p-6 rounded-3xl space-y-4 hover:border-amber-500/30 transition duration-300">
            <div className="h-12 w-12 bg-amber-950/50 border border-amber-900/50 rounded-2xl flex items-center justify-center text-amber-500">
              <MessageSquare className="h-6 w-6" />
            </div>
            <h3 className="font-extrabold text-white text-lg">Pedidos a tu WhatsApp</h3>
            <p className="text-slate-400 text-xs leading-relaxed">
              El cliente arma su carrito de compras y te envía el pedido formateado con detalle, número de mesa, recargos y total directo a tu número.
            </p>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 p-6 rounded-3xl space-y-4 hover:border-orange-500/30 transition duration-300">
            <div className="h-12 w-12 bg-orange-950/50 border border-orange-900/50 rounded-2xl flex items-center justify-center text-orange-500">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h3 className="font-extrabold text-white text-lg">Panel de Gestión Fácil</h3>
            <p className="text-slate-400 text-xs leading-relaxed">
              Administra tus categorías, productos, precios, fotos, horarios y datos bancarios desde un panel intuitivo sin depender de programadores.
            </p>
          </div>
        </div>

        {/* Pricing Section - Único Plan Premium ($10 USD/mes) */}
        <div className="w-full max-w-2xl bg-gradient-to-b from-slate-900/90 to-slate-950/90 border border-amber-500/30 rounded-[2.5rem] p-8 md:p-12 shadow-2xl relative overflow-hidden text-center space-y-8 my-8">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>
          
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold uppercase tracking-wider mx-auto">
            <Sparkles className="w-4 h-4 text-amber-400" /> Único Plan Transparente
          </div>

          <div className="space-y-3">
            <h2 className="text-3xl md:text-4xl font-extrabold text-white">Plan Premium SaaS</h2>
            <p className="text-slate-400 text-xs md:text-sm max-w-md mx-auto">
              Todas las funciones avanzadas para tu restaurante por un precio fijo mensual sin sorpresas ni comisiones por ventas.
            </p>
          </div>

          <div className="bg-slate-950/80 p-6 rounded-3xl border border-slate-800 inline-block w-full max-w-sm mx-auto shadow-inner">
            <div className="flex items-baseline justify-center gap-1">
              <span className="text-5xl font-black text-white">$10</span>
              <span className="text-lg font-bold text-amber-400">.00 USD</span>
              <span className="text-slate-400 text-xs ml-1">/ mes</span>
            </div>
            <p className="text-[11px] text-emerald-400 font-semibold mt-2">
              ✨ Incluye 30 Días de Prueba 100% Gratuita
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left text-xs text-slate-300 max-w-lg mx-auto">
            <div className="flex items-center gap-2.5 bg-slate-900/50 p-3 rounded-2xl border border-slate-800/80">
              <QrCode className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Menú Digital QR Ilimitado</span>
            </div>
            <div className="flex items-center gap-2.5 bg-slate-900/50 p-3 rounded-2xl border border-slate-800/80">
              <MessageSquare className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Pedidos directos a WhatsApp</span>
            </div>
            <div className="flex items-center gap-2.5 bg-slate-900/50 p-3 rounded-2xl border border-slate-800/80">
              <UtensilsCrossed className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Catálogo CRUD sin límite de platos</span>
            </div>
            <div className="flex items-center gap-2.5 bg-slate-900/50 p-3 rounded-2xl border border-slate-800/80">
              <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Cero comisiones por cada pedido</span>
            </div>
          </div>

          <div className="pt-2">
            <Link
              href="/registro"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl font-bold text-xs uppercase tracking-wider text-slate-950 bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 hover:from-amber-300 hover:to-amber-400 shadow-xl shadow-amber-500/20 transform hover:scale-[1.02] transition-all"
            >
              Comenzar Prueba Gratis de 30 Días
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* GEO Coverage Section - Generative & Local Search Optimization */}
        <div className="w-full max-w-4xl bg-transparent border border-white/10 rounded-[2.5rem] p-8 text-left space-y-6">
          <div className="flex items-center gap-2 text-amber-500 text-xs font-bold uppercase tracking-wider">
            <MapPin className="w-4 h-4" /> Cobertura Nacional en Ecuador
          </div>
          <h2 className="text-2xl font-extrabold text-white">Presentes en Todas las Provincias y Ciudades de Ecuador</h2>
          <p className="text-slate-400 text-xs leading-relaxed">
            MenuQR Pro potencia la transformación digital gastronómica en <strong>Quito, Guayaquil, Cuenca, Ambato, Manta, Loja, Machala, Santo Domingo, Portoviejo, Ibarra, Salinas, Babahoyo, Quevedo, Riobamba y Esmeraldas</strong>. Optimizado para el mercado ecuatoriano con soporte nativo para IVA del 15%, servicio del 10% y transferencias bancarias directas.
          </p>
          <div className="flex flex-wrap gap-2 text-[11px] text-slate-400 pt-2">
            <span className="px-3 py-1 bg-slate-900 border border-slate-800 rounded-full">Pichincha</span>
            <span className="px-3 py-1 bg-slate-900 border border-slate-800 rounded-full">Guayas</span>
            <span className="px-3 py-1 bg-slate-900 border border-slate-800 rounded-full">Azuay</span>
            <span className="px-3 py-1 bg-slate-900 border border-slate-800 rounded-full">Manabí</span>
            <span className="px-3 py-1 bg-slate-900 border border-slate-800 rounded-full">Tungurahua</span>
            <span className="px-3 py-1 bg-slate-900 border border-slate-800 rounded-full">Loja</span>
            <span className="px-3 py-1 bg-slate-900 border border-slate-800 rounded-full">El Oro</span>
            <span className="px-3 py-1 bg-slate-900 border border-slate-800 rounded-full">Santo Domingo</span>
            <span className="px-3 py-1 bg-slate-900 border border-slate-800 rounded-full">Los Ríos</span>
            <span className="px-3 py-1 bg-slate-900 border border-slate-800 rounded-full">Chimborazo</span>
            <span className="px-3 py-1 bg-slate-900 border border-slate-800 rounded-full">Imbabura</span>
          </div>
        </div>

        {/* AEO FAQ Section - Answer Engine Optimization for Search & AI */}
        <div className="w-full max-w-4xl text-left space-y-8 my-8">
          <script
            type="application/ld+json"
            suppressHydrationWarning
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "FAQPage",
                "mainEntity": [
                  {
                    "@type": "Question",
                    "name": "¿Qué es MenuQR Pro y cómo funciona en Ecuador?",
                    "acceptedAnswer": {
                      "@type": "Answer",
                      "text": "MenuQR Pro es una plataforma SaaS en Ecuador que permite a restaurantes, cafeterías y bares crear un menú digital QR interactivo. Los clientes escanean el código QR en la mesa y envían su pedido detallado a través de WhatsApp de forma automatizada.",
                    },
                  },
                  {
                    "@type": "Question",
                    "name": "¿Cuánto cuesta MenuQR Pro en Ecuador?",
                    "acceptedAnswer": {
                      "@type": "Answer",
                      "text": "MenuQR Pro cuenta con un Único Plan Premium de $10.00 USD mensuales. Todos los usuarios nuevos reciben 30 días de prueba completa totalmente gratis.",
                    },
                  },
                  {
                    "@type": "Question",
                    "name": "¿MenuQR Pro cobra comisiones sobre las ventas o pedidos?",
                    "acceptedAnswer": {
                      "@type": "Answer",
                      "text": "No. MenuQR Pro no cobra ninguna comisión por venta ni tarifa de intermediación por los pedidos de tu restaurante.",
                    },
                  },
                  {
                    "@type": "Question",
                    "name": "¿Cómo reciben los restaurantes los pedidos de sus clientes?",
                    "acceptedAnswer": {
                      "@type": "Answer",
                      "text": "Los clientes seleccionan los platos y mesas desde el menú digital y el pedido estructurado con totales e impuestos se envía instantáneamente al número de WhatsApp del establecimiento.",
                    },
                  },
                ],
              }),
            }}
          />

          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 text-amber-500 text-xs font-bold uppercase tracking-wider">
              <HelpCircle className="w-4 h-4" /> Preguntas Frecuentes (AEO)
            </div>
            <h2 className="text-3xl font-extrabold text-white">Todo lo que necesitas saber sobre MenuQR Pro</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-900/60 border border-slate-800/80 p-6 rounded-3xl space-y-3">
              <h3 className="font-bold text-white text-sm">¿Qué es MenuQR Pro y cómo funciona en Ecuador?</h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                Es una solución SaaS pensada para establecimientos gastronómicos en Ecuador. Te brinda un menú QR interactivo con enrutamiento de pedidos automatizado directamente a tu WhatsApp personal o de caja.
              </p>
            </div>

            <div className="bg-slate-900/60 border border-slate-800/80 p-6 rounded-3xl space-y-3">
              <h3 className="font-bold text-white text-sm">¿Cuánto cuesta y cómo funciona la prueba gratis?</h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                Obtienes <strong>30 días de prueba 100% gratuita</strong> al registrarte. Luego de la prueba, el servicio mantiene un valor fijo transparente de solo <strong>$10.00 USD al mes</strong>.
              </p>
            </div>

            <div className="bg-slate-900/60 border border-slate-800/80 p-6 rounded-3xl space-y-3">
              <h3 className="font-bold text-white text-sm">¿Existen comisiones adicionales por pedido o venta?</h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                No. A diferencia de las apps de delivery tradicionales, en MenuQR Pro te quedas con el 100% de tus ventas sin comisiones por pedido.
              </p>
            </div>

            <div className="bg-slate-900/60 border border-slate-800/80 p-6 rounded-3xl space-y-3">
              <h3 className="font-bold text-white text-sm">¿Permite configurar IVA y recargo por servicio en Ecuador?</h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                Sí. Puedes configurar de forma flexible el IVA (15% u otro porcentaje), el recargo de servicio (10%) y los datos bancarios para transferencias directas en Ecuador.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-6xl w-full mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4 relative z-10 text-xs text-slate-500 border-t border-slate-900 mt-8">
        <p>© 2026 MenuQR Pro Ecuador. Todos los derechos reservados.</p>
        <div className="flex items-center gap-4">
          <Link href="/terminos" className="hover:text-slate-300 transition">
            Términos y Condiciones
          </Link>
          <span>•</span>
          <Link href="/privacidad" className="hover:text-slate-300 transition">
            Política de Privacidad (LOPDP)
          </Link>
        </div>
      </footer>
      {/* Floating WhatsApp Action Button */}
      <a
        href={waUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 bg-[#25D366] hover:bg-[#20ba59] text-white p-3.5 sm:px-5 sm:py-3.5 rounded-full shadow-[0_10px_30px_rgba(37,211,102,0.5)] hover:shadow-[0_15px_35px_rgba(37,211,102,0.7)] transition-all duration-300 hover:scale-105 active:scale-95 group/wa cursor-pointer"
        title="Contactar por WhatsApp"
      >
        <div className="relative flex items-center justify-center">
          <MessageSquare className="h-6 w-6 text-white shrink-0 group-hover/wa:rotate-12 transition-transform duration-300" />
          <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-emerald-200 animate-ping opacity-75"></span>
          <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-white"></span>
        </div>
        <span className="hidden sm:inline text-xs font-black uppercase tracking-wider">WhatsApp Soporte</span>
      </a>
    </div>
  );
}
