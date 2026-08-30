import Link from "next/link";
import { UtensilsCrossed, Sparkles, QrCode, MessageSquare, ShieldCheck, ArrowRight, MapPin, HelpCircle } from "lucide-react";
import { prismaControl, prismaTenant } from "@/lib/db";
import { LandingSearch } from "./components/LandingSearch";
import { ScrollVideoBackground } from "./components/ScrollVideoBackground";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  // Query all restaurants from the DB to build the public directory
  const restaurants = await prismaTenant.restaurant.findMany({
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

  let whatsappSupport = "";
  try {
    const whatsappSupportSetting = await prismaControl.systemSetting.findUnique({
      where: { key: "whatsapp_support" }
    });
    whatsappSupport = whatsappSupportSetting?.value || "";
  } catch (error) {
    console.warn("WARNING: SystemSetting table is missing or not migrated yet.", error);
  }

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

        {/* Bottom Search Section */}
        <div className="w-full bg-transparent border border-white/10 rounded-[2.5rem] p-8 shadow-2xl">
          <LandingSearch restaurants={restaurants} />
        </div>

        {/* Feature grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full text-left">
          <div className="bg-transparent border border-white/10 p-8 rounded-[2rem] shadow-xl hover:scale-[1.02] transition-all duration-300">
            <div className="h-10 w-10 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl flex items-center justify-center mb-4">
              <QrCode className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-white text-base mb-2">Generador de QR</h3>
            <p className="text-slate-400 text-xs leading-relaxed">Genera códigos QR listos para imprimir y colocar en tus mesas para que tus clientes escaneen y ordenen.</p>
          </div>

          <div className="bg-transparent border border-white/10 p-8 rounded-[2rem] shadow-xl hover:scale-[1.02] transition-all duration-300">
            <div className="h-10 w-10 bg-orange-500/10 border border-orange-500/20 text-orange-400 rounded-xl flex items-center justify-center mb-4">
              <MessageSquare className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-white text-base mb-2">Pedidos por WhatsApp</h3>
            <p className="text-slate-400 text-xs leading-relaxed">Tus clientes arman su carrito completo y el pedido se envía automáticamente con formato directo a tu WhatsApp.</p>
          </div>

          <div className="bg-transparent border border-white/10 p-8 rounded-[2rem] shadow-xl hover:scale-[1.02] transition-all duration-300">
            <div className="h-10 w-10 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl flex items-center justify-center mb-4">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-white text-base mb-2">Panel Admin CRUD</h3>
            <p className="text-slate-400 text-xs leading-relaxed">Crea, edita y elimina platos o categorías al instante, sube fotos y cambia la disponibilidad en tiempo real.</p>
          </div>
        </div>

        {/* Pricing Section - Único Plan Premium ($5 USD/mes) */}
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
              <span className="text-5xl font-black text-white">$5</span>
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
                      "text": "MenuQR Pro cuenta con un Único Plan Premium de $5.00 USD mensuales. Todos los usuarios nuevos reciben 30 días de prueba completa totalmente gratis.",
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
                Obtienes <strong>30 días de prueba 100% gratuita</strong> al registrarte. Luego de la prueba, el servicio mantiene un valor fijo transparente de solo <strong>$5.00 USD al mes</strong>.
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
      {/* Floating WhatsApp Button */}
      {whatsappSupport && (
        <a
          href={`https://wa.me/${whatsappSupport.replace(/\D/g, "")}?text=Hola,%20quisiera%20saber%20más%20información%20sobre%20MenuQR%20Pro`}
          target="_blank"
          rel="noopener noreferrer"
          className="fixed bottom-6 right-6 z-50 bg-[#25D366] hover:bg-[#20ba5a] text-white p-4 rounded-full shadow-2xl transition-all duration-300 transform hover:scale-110 flex items-center justify-center hover:shadow-[#25D366]/20 hover:shadow-lg"
          title="Contactar por WhatsApp"
        >
          <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
            <path d="M17.472 14.382c-.022-.08-.124-.22-.326-.321-.202-.1-.197-.59-.197-.59s-.11-.223-.254-.3c-.144-.08-.854-.423-1.002-.493-.148-.07-.256-.104-.369.066-.113.17-.435.547-.533.66-.098.112-.197.126-.399.025-.202-.1-.854-.315-1.627-.887-.6-.52-1.005-1.164-1.123-1.365-.118-.2-.013-.309.088-.408.09-.09.202-.236.302-.354.1-.118.134-.2.202-.336.068-.135.034-.254-.017-.354-.05-.1-.435-.989-.595-1.378-.158-.387-.33-.33-.48-.33h-.414c-.16 0-.417.06-.635.293-.22.23-1.02.997-1.02 2.43 0 1.433 1.05 2.816 1.196 3.01.147.195 2.063 3.109 4.996 4.316.697.288 1.242.46 1.666.59.7.22 1.34.19 1.84.116.56-.083 1.72-.702 1.96-1.38.24-.678.24-1.258.17-1.38zM12.01 20c-1.62 0-3.1-.42-4.4-1.2l-.3-.2-3.2.9.9-3.1-.2-.3c-.8-1.4-1.3-3-1.3-4.7 0-4.9 4-9 9-9s9 4.1 9 9-4 9-9 9zM21 11.5C21 6.3 16.7 2 11.5 2S2 6.3 2 11.5c0 1.8.5 3.5 1.4 5L2 22l5.7-1.5c1.4.8 3 1.3 4.8 1.3 5.2 0 9.5-4.3 9.5-9.5z" />
          </svg>
        </a>
      )}
    </div>
  );
}
