import { prismaTenant } from "@/lib/db";
import Link from "next/link";
import { UtensilsCrossed, MapPin, ArrowRight, ChevronRight, HelpCircle } from "lucide-react";
import type { Metadata } from "next";
import { getBaseUrl, unslugify, generateBreadcrumbJsonLd, generateCityCategoryJsonLd } from "@/lib/seo";

export const dynamic = "force-dynamic";

interface Props {
  params: {
    provincia: string;
    ciudad: string;
    categoria: string;
  };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const cityName = unslugify(params.ciudad);
  const provName = unslugify(params.provincia);
  const catName = unslugify(params.categoria);
  const baseUrl = getBaseUrl();

  let count = 0;
  try {
    count = await prismaTenant.restaurant.count({
      where: {
        AND: [
          {
            OR: [
              { city: { equals: cityName, mode: "insensitive" } },
              { sector: { equals: cityName, mode: "insensitive" } },
              { parish: { equals: cityName, mode: "insensitive" } },
              { locality: { contains: cityName, mode: "insensitive" } },
            ],
          },
          {
            OR: [
              { specialty: { contains: catName, mode: "insensitive" } },
              { categories: { some: { name: { contains: catName, mode: "insensitive" } } } },
              { dishes: { some: { name: { contains: catName, mode: "insensitive" } } } },
            ],
          },
        ],
      },
    });
  } catch (err) {
    console.warn(`[SEO Warning] Failed to count restaurants for city ${cityName} category ${catName}:`, err);
  }

  const isIndexable = count > 0;

  return {
    title: `Restaurantes de ${catName} en ${cityName} (${provName}) | MenuQR Pro`,
    description: `¿Dónde comer ${catName} en ${cityName}? Revisa menús digitales QR, cartas con precios, platillos y realiza tu pedido directo a WhatsApp.`,
    robots: {
      index: isIndexable,
      follow: true,
    },
    alternates: {
      canonical: `${baseUrl}/restaurantes/${params.provincia}/${params.ciudad}/${params.categoria}`,
    },
    openGraph: {
      title: `${catName} en ${cityName} | Menús Digitales QR`,
      description: `Los mejores lugares de ${catName} en ${cityName}, ${provName}. Revisa la carta completa y precios.`,
      url: `${baseUrl}/restaurantes/${params.provincia}/${params.ciudad}/${params.categoria}`,
    },
  };
}

export default async function CityCategoryDirectoryPage({ params }: Props) {
  const cityName = unslugify(params.ciudad);
  const provName = unslugify(params.provincia);
  const catName = unslugify(params.categoria);
  const baseUrl = getBaseUrl();

  let restaurants: any[] = [];
  try {
    restaurants = await prismaTenant.restaurant.findMany({
      where: {
        AND: [
          {
            OR: [
              { city: { equals: cityName, mode: "insensitive" } },
              { sector: { equals: cityName, mode: "insensitive" } },
              { parish: { equals: cityName, mode: "insensitive" } },
              { locality: { contains: cityName, mode: "insensitive" } },
            ],
          },
          {
            OR: [
              { specialty: { contains: catName, mode: "insensitive" } },
              {
                categories: {
                  some: {
                    name: { contains: catName, mode: "insensitive" },
                  },
                },
              },
            ],
          },
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
      },
    });
  } catch (err) {
    console.error(`[CityCategoryDirectoryPage Error] ${cityName}/${catName}:`, err);
    restaurants = [];
  }

  const breadcrumbs = [
    { name: "Inicio", url: "/" },
    { name: "Restaurantes", url: "/restaurantes" },
    { name: provName, url: `/restaurantes/${params.provincia}` },
    { name: cityName, url: `/restaurantes/${params.provincia}/${params.ciudad}` },
    { name: catName, url: `/restaurantes/${params.provincia}/${params.ciudad}/${params.categoria}` },
  ];

  const breadcrumbSchema = generateBreadcrumbJsonLd(breadcrumbs);
  const cityCatSchema = generateCityCategoryJsonLd(cityName, catName, restaurants);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between relative overflow-hidden font-sans">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(cityCatSchema) }}
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
        <Link href={`/restaurantes/${params.provincia}/${params.ciudad}`} className="text-xs text-amber-400 font-bold hover:underline">
          Ver Todo {cityName}
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
          <Link href={`/restaurantes/${params.provincia}/${params.ciudad}`} className="hover:text-amber-400 transition">{cityName}</Link>
          <ChevronRight className="w-3 h-3 text-slate-600" />
          <span className="text-amber-400 font-bold">{catName}</span>
        </nav>

        <div className="space-y-4 text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-extrabold uppercase tracking-wider">
            <UtensilsCrossed className="w-4 h-4" /> {catName} en {cityName}
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold text-white tracking-tight leading-tight">
            Los Mejores Lugares de {catName} en <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-orange-500 to-amber-500">
              {cityName}, {provName}
            </span>
          </h1>
          <p className="text-slate-400 text-sm md:text-base leading-relaxed">
            Compara precios, platillos destacados y realiza tu pedido directo al WhatsApp en los restaurantes especializados en {catName} en {cityName}.
          </p>
        </div>

        {/* Restaurants grid */}
        <div className="space-y-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <UtensilsCrossed className="w-5 h-5 text-red-500" />
            Restaurantes encontrados ({restaurants.length})
          </h2>

          {restaurants.length === 0 ? (
            <div className="text-center py-12 bg-slate-900/40 rounded-3xl border border-slate-800 space-y-3">
              <p className="text-slate-400 text-sm">No se encontraron locales de {catName} en {cityName} todavía.</p>
              <Link href={`/restaurantes/${params.provincia}/${params.ciudad}`} className="inline-block text-xs text-amber-400 font-bold hover:underline">
                Ver todos los restaurantes en {cityName} →
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
                    <span>Ver Menú de {catName}</span>
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>

      <footer className="max-w-6xl w-full mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-500 border-t border-slate-900 mt-12">
        <p>© 2026 MenuQR Pro Ecuador. Todos los derechos reservados.</p>
        <Link href={`/restaurantes/${params.provincia}/${params.ciudad}`} className="hover:text-slate-300 transition">Volver a {cityName}</Link>
      </footer>
    </div>
  );
}
