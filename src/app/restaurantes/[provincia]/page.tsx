import { prismaTenant } from "@/lib/db";
import Link from "next/link";
import { UtensilsCrossed, MapPin, ArrowRight, Sparkles, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import { getBaseUrl, unslugify, generateBreadcrumbJsonLd } from "@/lib/seo";
import { ecuadorData } from "@/lib/ecuador";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

interface Props {
  params: {
    provincia: string;
  };
}

function findExactProvinceName(provSlug: string): string | null {
  const normTarget = provSlug.toLowerCase().trim();
  for (const prov of Object.keys(ecuadorData)) {
    const normProv = prov.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "-");
    if (normProv === normTarget) {
      return prov;
    }
  }
  return unslugify(provSlug);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const provName = findExactProvinceName(params.provincia);
  const baseUrl = getBaseUrl();

  return {
    title: `Restaurantes y Menús Digitales en ${provName}, Ecuador | MenuQR Pro`,
    description: `Descubre los mejores restaurantes, cafeterías y bares en la provincia de ${provName}. Revisa cartas digitales QR, menús con precios y haz tu pedido por WhatsApp.`,
    alternates: {
      canonical: `${baseUrl}/restaurantes/${params.provincia}`,
    },
    openGraph: {
      title: `Restaurantes en ${provName} | Menús Digitales QR`,
      description: `Guía gastronómica de ${provName}, Ecuador. Códigos QR, cartas con precios y pedidos por WhatsApp.`,
      url: `${baseUrl}/restaurantes/${params.provincia}`,
    },
  };
}

export default async function ProvinceDirectoryPage({ params }: Props) {
  const provName = findExactProvinceName(params.provincia);
  const baseUrl = getBaseUrl();

  // Get cities/cantons for this province from ecuadorData
  const citiesInProvince = ecuadorData[provName] || [];

  let restaurants: any[] = [];
  try {
    restaurants = await prismaTenant.restaurant.findMany({
      where: {
        OR: [
          { province: { equals: provName, mode: "insensitive" } },
          { locality: { contains: provName, mode: "insensitive" } },
          ...citiesInProvince.map((city) => ({
            locality: { contains: city, mode: "insensitive" },
          })),
          ...citiesInProvince.map((city) => ({
            city: { equals: city, mode: "insensitive" },
          })),
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
    console.error(`[ProvinceDirectoryPage Error] ${provName}:`, err);
    restaurants = [];
  }

  const breadcrumbs = [
    { name: "Inicio", url: "/" },
    { name: "Restaurantes", url: "/restaurantes" },
    { name: provName, url: `/restaurantes/${params.provincia}` },
  ];

  const breadcrumbSchema = generateBreadcrumbJsonLd(breadcrumbs);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between relative overflow-hidden font-sans">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
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
        <Link href="/restaurantes" className="text-xs text-amber-400 font-bold hover:underline">
          Ver Todo Ecuador
        </Link>
      </header>

      <main className="max-w-6xl w-full mx-auto px-6 py-10 relative z-10 space-y-10">
        <nav className="flex items-center gap-2 text-xs text-slate-400">
          <Link href="/" className="hover:text-amber-400 transition">Inicio</Link>
          <ChevronRight className="w-3 h-3 text-slate-600" />
          <Link href="/restaurantes" className="hover:text-amber-400 transition">Restaurantes</Link>
          <ChevronRight className="w-3 h-3 text-slate-600" />
          <span className="text-amber-400 font-bold">{provName}</span>
        </nav>

        <div className="space-y-4 text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-extrabold uppercase tracking-wider">
            <MapPin className="w-4 h-4" /> Provincia de {provName}
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold text-white tracking-tight leading-tight">
            Dónde Comer en <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-orange-500 to-amber-500">
              {provName}, Ecuador
            </span>
          </h1>
          <p className="text-slate-400 text-sm md:text-base leading-relaxed">
            Descubre cartas digitales QR, menús actualizados y realiza tus pedidos por WhatsApp en los cantones y localidades de {provName}.
          </p>
        </div>

        {/* Cities/Cantons Grid */}
        {citiesInProvince.length > 0 && (
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-6 space-y-4">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" /> Cantones y Localidades en {provName}
            </h2>
            <div className="flex flex-wrap gap-2 text-xs">
              {citiesInProvince.map((city) => {
                const citySlug = city.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "-");
                return (
                  <Link
                    key={city}
                    href={`/restaurantes/${params.provincia}/${citySlug}`}
                    className="px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 hover:border-amber-500/50 hover:text-amber-300 transition"
                  >
                    {city}
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
            Restaurantes en {provName} ({restaurants.length})
          </h2>

          {restaurants.length === 0 ? (
            <div className="text-center py-12 bg-slate-900/40 rounded-3xl border border-slate-800 space-y-3">
              <p className="text-slate-400 text-sm">No se encontraron restaurantes registrados en {provName} por el momento.</p>
              <Link href="/registro" className="inline-block text-xs text-amber-400 font-bold hover:underline">
                Sé el primer restaurante en registrarte en {provName} →
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
                          <span className="truncate">{r.city || r.locality || provName}</span>
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
      </main>

      <footer className="max-w-6xl w-full mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-500 border-t border-slate-900 mt-12">
        <p>© 2026 MenuQR Pro Ecuador. Todos los derechos reservados.</p>
        <Link href="/restaurantes" className="hover:text-slate-300 transition">Volver a Directorio</Link>
      </footer>
    </div>
  );
}
