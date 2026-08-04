import Link from "next/link";
import { UtensilsCrossed, Sparkles, QrCode, MessageSquare, ShieldCheck, ArrowRight } from "lucide-react";
import { prisma } from "@/lib/db";
import { LandingSearch } from "./components/LandingSearch";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  // Query all restaurants from the DB to build the public directory
  const restaurants = await prisma.restaurant.findMany({
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

  const whatsappSupportSetting = await prisma.systemSetting.findUnique({
    where: { key: "whatsapp_support" }
  });
  const whatsappSupport = whatsappSupportSetting?.value || "";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between relative overflow-hidden font-sans">
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
        <div className="space-y-12 flex flex-col items-center">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-[10px] uppercase tracking-wider font-extrabold text-amber-500">
            <Sparkles className="h-3 w-3 animate-spin" /> Plataforma SaaS Ultra Moderna
          </div>

          <div className="space-y-6 max-w-3xl">
            <h1 className="text-4xl md:text-6xl font-extrabold text-white leading-tight tracking-tight">
              Crea tu Menú Digital QR <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-orange-500 to-amber-500">
                Profesional en Segundos
              </span>
            </h1>
            <p className="text-slate-400 text-base md:text-lg max-w-2xl mx-auto leading-relaxed">
              Digitaliza tu restaurante, genera códigos QR para tus mesas y recibe pedidos completos directamente en tu WhatsApp de forma automatizada.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center w-full max-w-md pt-4">
            <Link 
              href="/mamma-mia"
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-4 rounded-2xl font-bold text-sm text-white bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 shadow-xl shadow-red-950/20 transform hover:scale-[1.02] transition-all duration-200"
            >
              Ver Menú de Demo
              <ArrowRight className="h-4.5 w-4.5" />
            </Link>
            <Link 
              href="/registro" 
              className="w-full sm:w-auto px-8 py-4 rounded-2xl font-bold text-sm bg-slate-900 border border-slate-800 hover:bg-slate-800 text-white transition-all text-center"
            >
              Empezar Gratis
            </Link>
          </div>
        </div>

        {/* Dynamic Search & Showcase Section */}
        <div className="w-full border-t border-slate-900/60 pt-16">
          <LandingSearch restaurants={restaurants} />
        </div>

        {/* Feature grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-8 w-full text-left">
          <div className="bg-slate-900/40 border border-slate-850 p-6 rounded-3xl backdrop-blur-md">
            <div className="h-10 w-10 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl flex items-center justify-center mb-4">
              <QrCode className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-white text-base mb-2">Generador de QR</h3>
            <p className="text-slate-400 text-xs leading-relaxed">Genera códigos QR listos para imprimir y colocar en tus mesas para que tus clientes escaneen y ordenen.</p>
          </div>

          <div className="bg-slate-900/40 border border-slate-850 p-6 rounded-3xl backdrop-blur-md">
            <div className="h-10 w-10 bg-orange-500/10 border border-orange-500/20 text-orange-400 rounded-xl flex items-center justify-center mb-4">
              <MessageSquare className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-white text-base mb-2">Pedidos por WhatsApp</h3>
            <p className="text-slate-400 text-xs leading-relaxed">Tus clientes arman su carrito completo y el pedido se envía automáticamente con formato directo a tu WhatsApp.</p>
          </div>

          <div className="bg-slate-900/40 border border-slate-850 p-6 rounded-3xl backdrop-blur-md">
            <div className="h-10 w-10 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl flex items-center justify-center mb-4">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-white text-base mb-2">Panel Admin CRUD</h3>
            <p className="text-slate-400 text-xs leading-relaxed">Crea, edita y elimina platos o categorías al instante, sube fotos y cambia la disponibilidad en tiempo real.</p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-6xl w-full mx-auto px-6 py-8 border-t border-slate-900 flex flex-col md:flex-row items-center justify-between gap-4 relative z-10 text-xs text-slate-500">
        <p>© 2026 MenuQR Pro. Todos los derechos reservados.</p>
        <p>Diseño oscuro premium y ultra rápido.</p>
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
