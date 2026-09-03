import Link from "next/link";
import { UtensilsCrossed, HelpCircle, ArrowRight, Sparkles, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import { getBaseUrl, generateBreadcrumbJsonLd } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Preguntas Frecuentes (FAQ) | Menú Digital QR y Pedidos por WhatsApp | MenuQR Pro",
  description: "Respuestas a las preguntas más frecuentes sobre menús digitales QR, pedidos por WhatsApp, configuración de IVA 15%, servicio 10% y planes en Ecuador.",
  alternates: {
    canonical: `${getBaseUrl()}/faq`,
  },
  openGraph: {
    title: "Preguntas Frecuentes (FAQ) - MenuQR Pro Ecuador",
    description: "Todo lo que necesitas saber sobre los menús digitales QR y pedidos por WhatsApp para tu restaurante en Ecuador.",
    url: `${getBaseUrl()}/faq`,
  },
};

export default async function FaqPage() {
  const baseUrl = getBaseUrl();

  const faqs = [
    {
      q: "¿Qué es MenuQR Pro y cómo beneficia a mi restaurante en Ecuador?",
      a: "MenuQR Pro es una plataforma SaaS gastronómica en Ecuador que permite a restaurantes, cafeterías, bares y food trucks digitalizar su carta en un menú interactivo accesible por código QR. Facilita que los clientes vean platos con imágenes y precios, armen su pedido e informen el número de mesa directamente a tu WhatsApp personal o de caja.",
    },
    {
      q: "¿Cómo funcionan los pedidos por WhatsApp?",
      a: "El cliente escanea el código QR en la mesa, escoge los platillos y bebidas, ingresa notas especiales si lo desea y hace clic en 'Enviar Pedido'. El sistema formatea automáticamente el resumen con subtotal, IVA, recargo de servicio y mesa, y abre WhatsApp para enviártelo sin comisiones.",
    },
    {
      q: "¿Cuánto cuesta MenuQR Pro y qué incluye la prueba gratis?",
      a: "MenuQR Pro ofrece 30 días de prueba 100% gratuita al registrarte. Luego de la prueba, el valor es de tan solo $10.00 USD mensuales por restaurante. Incluye menú ilimitado, mesas ilimitadas, cero comisiones por venta y soporte técnico en Ecuador.",
    },
    {
      q: "¿MenuQR Pro cobra comisiones sobre las ventas o platillos?",
      a: "No. A diferencia de las aplicaciones de delivery tradicionales que cobran hasta 30% por pedido, en MenuQR Pro te quedas con el 100% de tus ventas sin ninguna comisión ni porcentaje oculto.",
    },
    {
      q: "¿Puedo configurar el IVA del 15% y el servicio del 10% en Ecuador?",
      a: "Sí. El panel administrativo te permite activar o desactivar dinámicamente el IVA (15%), el recargo por servicio (10%), costos de entrega para domicilio y datos bancarios para transferencias directas.",
    },
    {
      q: "¿Cómo se imprimen y configuran los códigos QR para las mesas?",
      a: "Desde tu panel administrativo puedes generar e imprimir automáticamente los códigos QR para cada mesa (Mesa 1, Mesa 2, etc.) o para código de cobro directo. Los clientes escanean el QR con la cámara de cualquier teléfono sin descargar apps.",
    },
    {
      q: "¿En qué ciudades de Ecuador funciona MenuQR Pro?",
      a: "Funciona a nivel nacional en Quito, Guayaquil, Cuenca, Ambato, Manta, Portoviejo, Salinas, Montañita, Olón, Loja, Machala, Santo Domingo, Ibarra, Babahoyo, Quevedo, Riobamba y cualquier rincón de Ecuador.",
    },
    {
      q: "¿Necesito conocimientos técnicos o programadores para cambiar mis precios o platos?",
      a: "No. Tu panel administrativo te permite agregar, editar o deshabilitar platos, categorías, fotos y precios en tiempo real desde tu teléfono móvil o laptop en segundos.",
    },
  ];

  const breadcrumbs = [
    { name: "Inicio", url: "/" },
    { name: "Preguntas Frecuentes", url: "/faq" },
  ];

  const breadcrumbSchema = generateBreadcrumbJsonLd(breadcrumbs);

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqs.map((f) => ({
      "@type": "Question",
      "name": f.q,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": f.a,
      },
    })),
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between relative overflow-hidden font-sans">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <header className="max-w-6xl w-full mx-auto px-6 py-6 flex items-center justify-between border-b border-slate-900 relative z-10">
        <Link href="/" className="flex items-center gap-2">
          <div className="h-10 w-10 bg-gradient-to-tr from-red-600 to-amber-500 rounded-xl flex items-center justify-center shadow-lg">
            <UtensilsCrossed className="h-5 w-5 text-white" />
          </div>
          <span className="font-extrabold text-white text-lg tracking-tight">
            MenuQR <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-amber-500">Pro</span>
          </span>
        </Link>
        <Link href="/registro" className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 border border-slate-800 hover:bg-slate-800 rounded-xl transition">
          Probar 30 Días Gratis
        </Link>
      </header>

      <main className="max-w-4xl w-full mx-auto px-6 py-10 relative z-10 space-y-10">
        <nav className="flex items-center gap-2 text-xs text-slate-400">
          <Link href="/" className="hover:text-amber-400 transition">Inicio</Link>
          <ChevronRight className="w-3 h-3 text-slate-600" />
          <span className="text-amber-400 font-bold">Preguntas Frecuentes</span>
        </nav>

        <div className="space-y-4 text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-extrabold uppercase tracking-wider">
            <HelpCircle className="w-4 h-4" /> Centro de Ayuda (AEO & AI Search)
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold text-white tracking-tight leading-tight">
            Preguntas Frecuentes sobre <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-orange-500 to-amber-500">
              MenuQR Pro en Ecuador
            </span>
          </h1>
          <p className="text-slate-400 text-sm md:text-base leading-relaxed max-w-2xl mx-auto">
            Resolvemos todas tus dudas sobre digitalización de menús, códigos QR, pedidos por WhatsApp y el modelo de negocio para restaurantes en Ecuador.
          </p>
        </div>

        <div className="space-y-6">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className="bg-slate-900/60 border border-slate-800/80 p-6 rounded-3xl space-y-3 hover:border-amber-500/30 transition duration-300"
            >
              <h3 className="font-extrabold text-white text-base flex items-start gap-3">
                <span className="text-amber-500 font-mono text-sm shrink-0 mt-0.5">0{index + 1}.</span>
                <span>{faq.q}</span>
              </h3>
              <p className="text-slate-400 text-xs md:text-sm leading-relaxed pl-8">
                {faq.a}
              </p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="bg-gradient-to-r from-red-950/40 via-slate-900 to-amber-950/40 border border-amber-500/30 p-8 rounded-3xl text-center space-y-4">
          <h2 className="text-2xl font-extrabold text-white">¿Listo para digitalizar tu restaurante?</h2>
          <p className="text-slate-400 text-xs max-w-lg mx-auto">
            Comienza tu prueba gratuita de 30 días hoy mismo y recibe pedidos ilimitados a tu WhatsApp.
          </p>
          <div>
            <Link
              href="/registro"
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-2xl font-bold text-xs uppercase tracking-wider text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 shadow-xl transition"
            >
              Crear Menú Gratis Ahora
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </main>

      <footer className="max-w-6xl w-full mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-500 border-t border-slate-900 mt-12">
        <p>© 2026 MenuQR Pro Ecuador. Todos los derechos reservados.</p>
        <Link href="/restaurantes" className="hover:text-slate-300 transition">Explorar Restaurantes</Link>
      </footer>
    </div>
  );
}
