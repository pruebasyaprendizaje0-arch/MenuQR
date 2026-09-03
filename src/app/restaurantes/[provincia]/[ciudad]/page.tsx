import { prismaTenant } from "@/lib/db";
import Link from "next/link";
import { UtensilsCrossed, MapPin, ArrowRight, Sparkles, ChevronRight, HelpCircle } from "lucide-react";
import type { Metadata } from "next";
import { getBaseUrl, unslugify, generateBreadcrumbJsonLd, generateCityCategoryJsonLd } from "@/lib/seo";

export const dynamic = "force-dynamic";

interface Props {
  params: {
    provincia: string;
    ciudad: string;
  };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const cityName = unslugify(params.ciudad);
  const provName = unslugify(params.provincia);
  const baseUrl = getBaseUrl();

  let count = 0;
  try {
    count = await prismaTenant.restaurant.count({
      where: {
        OR: [
          { city: { equals: cityName, mode: "insensitive" } },
          { sector: { equals: cityName, mode: "insensitive" } },
          { parish: { equals: cityName, mode: "insensitive" } },
          { locality: { contains: cityName, mode: "insensitive" } },
        ],
      },
    });
  } catch (err) {
    console.warn(`[SEO Warning] Failed to count restaurants for city ${cityName}:`, err);
  }

  const isIndexable = count > 0;

  return {
    title: `Restaurantes y Menús Digitales en ${cityName} (${provName}) | MenuQR Pro`,
    description: `Consulta el menú digital QR, la carta con precios, especialidades y haz tu pedido por WhatsApp en los mejores restaurantes de ${cityName}, ${provName}, Ecuador.`,
    robots: {
      index: isIndexable,
      follow: true,
    },
    alternates: {
      canonical: `${baseUrl}/restaurantes/${params.provincia}/${params.ciudad}`,
    },
    openGraph: {
      title: `Dónde Comer en ${cityName} (${provName}) | Menús QR`,
      description: `Guía gastronómica de ${cityName}. Revisa la carta de platos, precios y realiza tu pedido al instante.`,
      url: `${baseUrl}/restaurantes/${params.provincia}/${params.ciudad}`,
    },
  };
}

export default async function CityDirectoryPage({ params }: Props) {
  const cityName = unslugify(params.ciudad);
  const provName = unslugify(params.provincia);
  const baseUrl = getBaseUrl();

  let restaurants: any[] = [];
  try {
    restaurants = await prismaTenant.restaurant.findMany({
      where: {
        OR: [
          { city: { equals: cityName, mode: "insensitive" } },
          { sector: { equals: cityName, mode: "insensitive" } },
          { parish: { equals: cityName, mode: "insensitive" } },
          { locality: { contains: cityName, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        slug: true,
        name: true,
        logoUrl: true,
        specialty: true,
        locality: true,
        city: true,
        province: true,
        description: true,
        categories: {
          select: {
            name: true,
          },
        },
      },
    });
  } catch (err) {
    console.error(`[CityDirectoryPage Error] ${cityName}:`, err);
    restaurants = [];
  }

  // Categories present in this city
  const categoriesMap = new Map<string, number>();
  restaurants.forEach((r) => {
    (r.categories || []).forEach((c: any) => {
      if (c.name) categoriesMap.set(c.name, (categoriesMap.get(c.name) || 0) + 1);
    });
  });
  const categories = Array.from(categoriesMap.keys());

  const breadcrumbs = [
    { name: "Inicio", url: "/" },
    { name: "Restaurantes", url: "/restaurantes" },
    { name: provName, url: `/restaurantes/${params.provincia}` },
    { name: cityName, url: `/restaurantes/${params.provincia}/${params.ciudad}` },
  ];

  const breadcrumbSchema = generateBreadcrumbJsonLd(breadcrumbs);
  const citySchema = generateCityCategoryJsonLd(cityName, null, restaurants);

  const cityFaqs = [
    {
      question: `¿Dónde comer en ${cityName}?`,
      answer: `En ${cityName} puedes encontrar una variada oferta gastronómica. Consulta los restaurantes registrados en MenuQR Pro para revisar sus cartas digitales, especialidades y precios actualizados.`,
    },
    {
      question: `¿Cómo pedir comida a domicilio por WhatsApp en ${cityName}?`,
      answer: `Ingresa al menú digital del restaurante en MenuQR Pro, selecciona tus platillos y bebidas favoritas y presiona 'Enviar Pedido por WhatsApp'. El pedido se enviará formateado directamente al restaurante.`,
    },
    {
      question: `¿Qué restaurantes tienen menú digital QR en ${cityName}?`,
      answer: `Actualmente hay ${restaurants.length} establecimiento(s) con menú QR interactivo y actualizado en ${cityName}.`,
    },
  ];

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": cityFaqs.map((f) => ({
      "@type": "Question",
      "name": f.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": f.answer,
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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(citySchema) }}
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
        <Link href={`/restaurantes/${params.provincia}`} className="text-xs text-amber-400 font-bold hover:underline">
          Ver {provName}
        </Link>
      </header>

      <main className="max-w-6xl w-full mx-auto px-6 py-10 relative z-10 space-y-10">
        <nav className="flex items-center gap-2 text-xs text-slate-400">
          <Link href="/" className="hover:text-amber-400 transition">Inicio</Link>
          <ChevronRight className="w-3 h-3 text-slate-600" />
          <Link href="/restaurantes" className="hover:text-amber-400 transition">Restaurantes</Link>
          <ChevronRight className="w-3 h-3 text-slate-600" />
          <Link href={`/restaurantes/${params.provincia}`} className="hover:text-amber-400 transition">{provName}</Link>
          <ChevronRight className="w-3 h-3 text-slate-600" />
          <span className="text-amber-400 font-bold">{cityName}</span>
        </nav>

        <div className="space-y-4 text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-extrabold uppercase tracking-wider">
            <MapPin className="w-4 h-4" /> Gastronomía en {cityName}
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold text-white tracking-tight leading-tight">
            Restaurantes y Menús en <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-orange-500 to-amber-500">
              {cityName}, {provName}
            </span>
          </h1>
          <p className="text-slate-400 text-sm md:text-base leading-relaxed">
            Explora las cartas digitales de los restaurantes en {cityName}. Revisa precios, imágenes de platos y realiza tu pedido directo por WhatsApp.
          </p>
        </div>

        {/* Categories Tag Cloud */}
        {categories.length > 0 && (
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-6 space-y-4">
            <h2 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4" /> Categorías de Comida en {cityName}
            </h2>
            <div className="flex flex-wrap gap-2 text-xs">
              {categories.map((cat) => {
                const catSlug = cat.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "-");
                return (
                  <Link
                    key={cat}
                    href={`/restaurantes/${params.provincia}/${params.ciudad}/${catSlug}`}
                    className="px-3.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-amber-500/50 hover:text-amber-300 transition"
                  >
                    {cat} en {cityName}
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Restaurants list */}
        <div className="space-y-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <UtensilsCrossed className="w-5 h-5 text-red-500" />
            Locales en {cityName} ({restaurants.length})
          </h2>

          {restaurants.length === 0 ? (
            <div className="text-center py-12 bg-slate-900/40 rounded-3xl border border-slate-800 space-y-3">
              <p className="text-slate-400 text-sm">Aún no hay restaurantes registrados en {cityName}.</p>
              <Link href="/registro" className="inline-block text-xs text-amber-400 font-bold hover:underline">
                Registra tu negocio gratis en {cityName} →
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {restaurants.map((r) => (
                <Link
                  key={r.id}
                  href={`/${r.slug}`}
                  className="group bg-slate-900/60 border border-slate-800/80 hover:border-amber-500/40 rounded-3xl p-5 flex flex-col justify-between transition-all duration-300 hover:scale-[1.02] shadow-lg"
                >
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="h-14 w-14 rounded-2xl bg-slate-950 border border-slate-800 overflow-hidden flex items-center justify-center shrink-0">
                        {r.logoUrl ? (
                          <img src={r.logoUrl} alt={`Logo de ${r.name}`} className="h-full w-full object-cover" />
                        ) : (
                          <UtensilsCrossed className="h-6 w-6 text-slate-600" />
                        )}
                      </div>
                      <div className="overflow-hidden">
                        <h3 className="font-extrabold text-white text-base group-hover:text-amber-400 transition truncate">
                          {r.name}
                        </h3>
                        <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-1">
                          <MapPin className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                          <span className="truncate">{cityName}</span>
                        </div>
                      </div>
                    </div>
                    {r.description && <p className="text-slate-400 text-xs line-clamp-2 leading-relaxed">{r.description}</p>}
                  </div>
                  <div className="pt-4 mt-4 border-t border-slate-800/60 flex items-center justify-between text-xs text-amber-400 font-bold group-hover:translate-x-1 transition-transform">
                    <span>Ver Menú Digital</span>
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* City AEO FAQ Section */}
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-3xl p-6 space-y-6">
          <div className="flex items-center gap-2 text-amber-400 font-bold text-sm uppercase tracking-wider">
            <HelpCircle className="w-4 h-4" /> Preguntas Frecuentes sobre Restaurantes en {cityName}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            {cityFaqs.map((faq, i) => (
              <div key={i} className="bg-slate-950 p-4 rounded-2xl border border-slate-800/80 space-y-2">
                <h3 className="font-bold text-white text-sm">{faq.question}</h3>
                <p className="text-slate-400 leading-relaxed">{faq.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </main>

      <footer className="max-w-6xl w-full mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-500 border-t border-slate-900 mt-12">
        <p>© 2026 MenuQR Pro Ecuador. Todos los derechos reservados.</p>
        <Link href={`/restaurantes/${params.provincia}`} className="hover:text-slate-300 transition">Volver a {provName}</Link>
      </footer>
    </div>
  );
}
