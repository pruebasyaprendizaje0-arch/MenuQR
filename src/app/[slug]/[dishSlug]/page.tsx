import { prismaTenant } from "@/lib/db";
import Link from "next/link";
import { UtensilsCrossed, MapPin, ArrowLeft, MessageSquare, Check, Sparkles, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import { getBaseUrl, normalizeSlug, generateBreadcrumbJsonLd } from "@/lib/seo";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{
    slug: string;
    dishSlug: string;
  }>;
}

export async function generateMetadata({ params: paramsPromise }: Props): Promise<Metadata> {
  const params = await paramsPromise;
  const { slug, dishSlug } = params;

  try {
    const restaurant = await prismaTenant.restaurant.findUnique({
      where: { slug: slug.toLowerCase() },
      include: {
        dishes: true,
      },
    });

    if (!restaurant) return {};

    const dish = restaurant.dishes.find(
      (d: any) => normalizeSlug(d.name) === dishSlug.toLowerCase() || d.id === dishSlug
    );

    if (!dish) return {};

    const location = restaurant.city || restaurant.locality || "Ecuador";
    const title = `${dish.name} - $${Number(dish.price).toFixed(2)} | ${restaurant.name} en ${location}`;
    const description = dish.description 
      ? `${dish.description}. Disfruta ${dish.name} por $${Number(dish.price).toFixed(2)} en ${restaurant.name} (${location}). Haz tu pedido por WhatsApp.` 
      : `Pide ${dish.name} por $${Number(dish.price).toFixed(2)} en el menú digital de ${restaurant.name} en ${location}. Pedidos inmediatos a WhatsApp.`;

    const baseUrl = getBaseUrl();
    const url = `${baseUrl}/${slug}/${dishSlug}`;
    const imageUrl = dish.imageUrl 
      ? (dish.imageUrl.startsWith("http") ? dish.imageUrl : `${baseUrl}${dish.imageUrl}`)
      : (restaurant.logoUrl ? (restaurant.logoUrl.startsWith("http") ? restaurant.logoUrl : `${baseUrl}${restaurant.logoUrl}`) : `${baseUrl}/icon.png`);

    return {
      title,
      description,
      alternates: {
        canonical: url,
      },
      openGraph: {
        title: `${dish.name} en ${restaurant.name}`,
        description,
        url,
        images: [{ url: imageUrl, alt: dish.name }],
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: [imageUrl],
      },
    };
  } catch {
    return {};
  }
}

export default async function DishDetailPage({ params: paramsPromise }: Props) {
  const params = await paramsPromise;
  const { slug, dishSlug } = params;

  const restaurant = await prismaTenant.restaurant.findUnique({
    where: { slug: slug.toLowerCase() },
    include: {
      dishes: {
        include: {
          category: true,
        },
      },
    },
  });

  if (!restaurant) {
    notFound();
  }

  const dish = restaurant.dishes.find(
    (d: any) => normalizeSlug(d.name) === dishSlug.toLowerCase() || d.id === dishSlug
  );

  if (!dish) {
    notFound();
  }

  const baseUrl = getBaseUrl();
  const location = restaurant.city || restaurant.locality || "Ecuador";

  const rawPhone = (restaurant.whatsapp || "").replace(/\D/g, "");
  let formattedPhone = rawPhone;
  if (!formattedPhone.startsWith("593") && formattedPhone.startsWith("0")) {
    formattedPhone = "593" + formattedPhone.substring(1);
  } else if (!formattedPhone.startsWith("593") && formattedPhone.length === 9) {
    formattedPhone = "593" + formattedPhone;
  }

  const waMsg = `Hola ${restaurant.name}, me interesa pedir el plato: ${dish.name} ($${Number(dish.price).toFixed(2)}) de su menú digital.`;
  const waUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(waMsg)}`;

  const breadcrumbs = [
    { name: "Inicio", url: "/" },
    { name: "Restaurantes", url: "/restaurantes" },
    { name: restaurant.name, url: `/${restaurant.slug}` },
    { name: dish.name, url: `/${restaurant.slug}/${dishSlug}` },
  ];

  const breadcrumbSchema = generateBreadcrumbJsonLd(breadcrumbs);

  const menuItemSchema = {
    "@context": "https://schema.org",
    "@type": "MenuItem",
    "name": dish.name,
    "description": dish.description || `${dish.name} en ${restaurant.name}`,
    "image": dish.imageUrl ? (dish.imageUrl.startsWith("http") ? dish.imageUrl : `${baseUrl}${dish.imageUrl}`) : undefined,
    "offers": {
      "@type": "Offer",
      "price": String(dish.price || 0),
      "priceCurrency": "USD",
      "availability": dish.isAvailable ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    },
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between relative overflow-hidden font-sans">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(menuItemSchema) }}
      />

      <header className="max-w-4xl w-full mx-auto px-6 py-6 flex items-center justify-between border-b border-slate-900 relative z-10">
        <Link href={`/${restaurant.slug}`} className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-amber-400 transition">
          <ArrowLeft className="w-4 h-4" /> Volver al Menú de {restaurant.name}
        </Link>
        <span className="text-xs text-amber-500 font-extrabold uppercase tracking-wider">
          {restaurant.name}
        </span>
      </header>

      <main className="max-w-3xl w-full mx-auto px-6 py-10 relative z-10 space-y-8">
        <nav className="flex items-center gap-2 text-xs text-slate-400">
          <Link href="/" className="hover:text-amber-400 transition">Inicio</Link>
          <ChevronRight className="w-3 h-3 text-slate-600" />
          <Link href={`/${restaurant.slug}`} className="hover:text-amber-400 transition">{restaurant.name}</Link>
          <ChevronRight className="w-3 h-3 text-slate-600" />
          <span className="text-amber-400 font-bold">{dish.name}</span>
        </nav>

        <div className="bg-slate-900/80 border border-slate-800/80 rounded-3xl p-6 md:p-8 space-y-6 shadow-2xl">
          {dish.imageUrl && (
            <div className="w-full h-64 md:h-80 rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 relative">
              <img
                src={dish.imageUrl}
                alt={`${dish.name} - ${restaurant.name}`}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          <div className="space-y-3">
            {dish.category?.name && (
              <div className="inline-block px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold uppercase tracking-wider">
                {dish.category.name}
              </div>
            )}
            <h1 className="text-3xl font-extrabold text-white">{dish.name}</h1>
            <p className="text-slate-400 text-sm leading-relaxed">
              {dish.description || `Platillo preparado por ${restaurant.name} en ${location}.`}
            </p>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-800">
            <div>
              <span className="text-xs text-slate-500 uppercase tracking-wider block">Precio</span>
              <span className="text-3xl font-black text-white">${Number(dish.price).toFixed(2)}</span>
            </div>

            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl font-bold text-xs uppercase tracking-wider text-white bg-[#25D366] hover:bg-[#20ba59] shadow-lg shadow-emerald-950/40 transition-transform transform hover:scale-105"
            >
              <MessageSquare className="w-4 h-4" />
              Pedir por WhatsApp
            </a>
          </div>
        </div>

        {/* Restaurant Context Card */}
        <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-slate-950 border border-slate-800 overflow-hidden flex items-center justify-center shrink-0">
              {restaurant.logoUrl ? (
                <img src={restaurant.logoUrl} alt={`Logo de ${restaurant.name}`} className="h-full w-full object-cover" />
              ) : (
                <UtensilsCrossed className="w-5 h-5 text-slate-600" />
              )}
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">{restaurant.name}</h3>
              <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                <MapPin className="w-3 h-3 text-amber-500" /> {location}
              </p>
            </div>
          </div>

          <Link
            href={`/${restaurant.slug}`}
            className="px-5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-xs font-bold text-amber-400 transition"
          >
            Ver Menú Completo
          </Link>
        </div>
      </main>

      <footer className="max-w-4xl w-full mx-auto px-6 py-8 flex items-center justify-between text-xs text-slate-500 border-t border-slate-900 mt-8">
        <p>© 2026 MenuQR Pro Ecuador.</p>
        <Link href={`/${restaurant.slug}`} className="hover:text-slate-300 transition">Menú Digital</Link>
      </footer>
    </div>
  );
}
