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
    </div>
  );
}
