import { prismaTenant } from "@/lib/db";
import Link from "next/link";
import { UtensilsCrossed, MapPin, Search, ArrowRight, Sparkles, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import { getBaseUrl, generateBreadcrumbJsonLd } from "@/lib/seo";
import { ecuadorData } from "@/lib/ecuador";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Directorio de Restaurantes y Menús Digitales en Ecuador | MenuQR Pro",
  description: "Explora los mejores restaurantes, cafeterías y bares en Ecuador. Consulta sus menús digitales QR, especialidades, precios y realiza tu pedido directo a WhatsApp en Quito, Guayaquil, Cuenca, Montañita, Manta y más.",
  keywords: [
    "Restaurantes en Ecuador",
    "Menús digitales Ecuador",
    "Dónde comer en Quito",
    "Dónde comer en Guayaquil",
    "Dónde comer en Montañita",
    "Restaurantes Cuenca",
    "Carta digital restaurantes Ecuador",
  ],
  alternates: {
    canonical: `${getBaseUrl()}/restaurantes`,
  },
  openGraph: {
    title: "Directorio de Restaurantes y Menús Digitales en Ecuador | MenuQR Pro",
    description: "Encuentra los mejores restaurantes en Ecuador con menú digital QR interactivo. Revisa cartas, especialidades y haz tu pedido por WhatsApp.",
    url: `${getBaseUrl()}/restaurantes`,
    type: "website",
  },
};

export default async function DirectoryPage() {
  const baseUrl = getBaseUrl();

  let restaurants: any[] = [];
  try {
    restaurants = await prismaTenant.restaurant.findMany({
      select: {
        id: true,
        slug: true,
        name: true,
        logoUrl: true,
        coverUrl: true,
        specialty: true,
        locality: true,
        city: true,
        province: true,
        description: true,
        themeColor: true,
        categories: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  } catch (error) {
    console.error("[DirectoryPage Error] Failed to fetch restaurants:", error);
    restaurants = [];
  }

  // Extract unique locations and categories
  const locationsMap = new Map<string, number>();
  const categoriesMap = new Map<string, number>();

  restaurants.forEach((r) => {
    const loc = r.city || r.locality || "Ecuador";
    locationsMap.set(loc, (locationsMap.get(loc) || 0) + 1);

    (r.categories || []).forEach((cat: any) => {
      if (cat.name) {
        categoriesMap.set(cat.name, (categoriesMap.get(cat.name) || 0) + 1);
      }
    });
  });

  const breadcrumbs = [
    { name: "Inicio", url: "/" },
    { name: "Restaurantes", url: "/restaurantes" },
  ];

  const breadcrumbSchema = generateBreadcrumbJsonLd(breadcrumbs);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between relative overflow-hidden font-sans">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      {/* Header */}
      <header className="max-w-6xl w-full mx-auto px-6 py-6 flex items-center justify-between border-b border-slate-900 relative z-10">
        <Link href="/" className="flex items-center gap-2">
          <div className="h-10 w-10 bg-gradient-to-tr from-red-600 to-amber-500 rounded-xl flex items-center justify-center shadow-lg">
            <UtensilsCrossed className="h-5 w-5 text-white" />
          </div>
          <span className="font-extrabold text-white text-lg tracking-tight">
            MenuQR <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-amber-500">Pro</span>
          </span>
        </Link>
        <Link 
          href="/admin" 
          className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 border border-slate-800 hover:bg-slate-800 rounded-xl transition"
        >
          Acceso Restaurantes
        </Link>
      </header>

      <main className="max-w-6xl w-full mx-auto px-6 py-10 relative z-10 space-y-12">
        {/* Breadcrumb Visual Navigation */}
        <nav className="flex items-center gap-2 text-xs text-slate-400">
          <Link href="/" className="hover:text-amber-400 transition">Inicio</Link>
          <ChevronRight className="w-3 h-3 text-slate-600" />
          <span className="text-amber-400 font-bold">Restaurantes</span>
        </nav>

        {/* Hero Banner */}
        <div className="space-y-4 text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-extrabold uppercase tracking-wider">
            <Sparkles className="w-4 h-4" /> Directorio Gastronómico Ecuatoriano
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold text-white tracking-tight leading-tight">
            Descubre los mejores <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-orange-500 to-amber-500">
              Restaurantes con Menú Digital QR
            </span>
          </h1>
          <p className="text-slate-400 text-sm md:text-base leading-relaxed">
            Consulta la carta interactiva, precios, platillos destacados y realiza tu pedido directo al WhatsApp de tu establecimiento favorito en Ecuador.
          </p>
        </div>

        {/* Provinces & Cities Section */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-6 space-y-4">
          <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
            <MapPin className="w-4 h-4" /> Principales Destinos Gastronómicos
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            {Object.keys(ecuadorData).slice(0, 12).map((prov) => {
              const provSlug = prov.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "-");
              return (
                <Link
                  key={prov}
                  href={`/restaurantes/${provSlug}`}
                  className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-amber-500/50 hover:text-amber-300 transition"
                >
                  {prov}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Restaurants Grid */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <UtensilsCrossed className="w-5 h-5 text-red-500" />
              Restaurantes Destacados ({restaurants.length})
            </h2>
          </div>

          {restaurants.length === 0 ? (
            <div className="text-center py-12 bg-slate-900/40 rounded-3xl border border-slate-800 space-y-3">
              <p className="text-slate-400 text-sm">No se encontraron restaurantes registrados aún.</p>
              <Link href="/registro" className="inline-block text-xs text-amber-400 font-bold hover:underline">
                Registra tu restaurante gratis aquí →
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {restaurants.map((r) => {
                const cityOrLoc = r.city || r.locality || "Ecuador";
                return (
                  <Link
                    key={r.id}
                    href={`/${r.slug}`}
                    className="group bg-slate-900/60 border border-slate-800/80 hover:border-amber-500/40 rounded-3xl p-5 flex flex-col justify-between transition-all duration-300 hover:scale-[1.02] shadow-lg"
                  >
                    <div className="space-y-4">
                      <div className="flex items-center gap-4">
                        <div className="h-14 w-14 rounded-2xl bg-slate-950 border border-slate-800 overflow-hidden flex items-center justify-center shrink-0">
                          {r.logoUrl ? (
                            <img
                              src={r.logoUrl}
                              alt={`Logo de ${r.name}`}
                              className="h-full w-full object-cover"
                            />
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
                            <span className="truncate">{cityOrLoc}</span>
                          </div>
                        </div>
                      </div>

                      {r.description && (
                        <p className="text-slate-400 text-xs line-clamp-2 leading-relaxed">
                          {r.description}
                        </p>
                      )}

                      {r.specialty && (
                        <div className="inline-block px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] font-semibold text-amber-400">
                          {r.specialty}
                        </div>
                      )}
                    </div>

                    <div className="pt-4 mt-4 border-t border-slate-800/60 flex items-center justify-between text-xs text-amber-400 font-bold group-hover:translate-x-1 transition-transform">
                      <span>Ver Menú Digital</span>
                      <ArrowRight className="h-4 w-4" />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-6xl w-full mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-500 border-t border-slate-900 mt-12">
        <p>© 2026 MenuQR Pro Ecuador. Todos los derechos reservados.</p>
        <div className="flex items-center gap-4">
          <Link href="/faq" className="hover:text-slate-300 transition">Preguntas Frecuentes</Link>
          <span>•</span>
          <Link href="/terminos" className="hover:text-slate-300 transition">Términos</Link>
          <span>•</span>
          <Link href="/privacidad" className="hover:text-slate-300 transition">Privacidad</Link>
        </div>
      </footer>
    </div>
  );
}
