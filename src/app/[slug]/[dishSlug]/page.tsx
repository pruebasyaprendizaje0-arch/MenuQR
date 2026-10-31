import { cache } from "react";
import { prismaTenant } from "@/lib/db";
import Link from "next/link";
import { UtensilsCrossed, MapPin, ArrowLeft, MessageSquare, Check, Sparkles, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import { getBaseUrl, normalizeSlug, unslugify, generateBreadcrumbJsonLd, resolvePublicImageUrl } from "@/lib/seo";
import { parseDishImages } from "@/lib/dish-images";
import { notFound } from "next/navigation";
import { SmartLogo } from "@/components/SmartImage";
import { FloatingWhatsAppButton } from "@/components/public/FloatingWhatsAppButton";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{
    slug: string;
    dishSlug: string;
  }>;
}

const getDishWithRestaurant = cache(async (restaurantSlug: string, dishSlug: string) => {
  let cleanRestSlug = restaurantSlug.trim().toLowerCase();
  let cleanDishSlug = dishSlug.trim().toLowerCase();
  try {
    cleanRestSlug = decodeURIComponent(restaurantSlug).trim().toLowerCase();
  } catch {}
  try {
    cleanDishSlug = decodeURIComponent(dishSlug).trim().toLowerCase();
  } catch {}

  const restaurant = await prismaTenant.restaurant.findUnique({
    where: { 
      slug: cleanRestSlug,
      isSuspended: false 
    },
    include: {
      dishes: {
        where: { isAvailable: true },
        include: { category: true }
      }
    }
  });

  if (!restaurant) {
    notFound();
  }

  // Matching flexible del plato:
  const normalizedCleanDishSlug = normalizeSlug(cleanDishSlug);
  const unslugifiedDishSlug = unslugify(cleanDishSlug).toLowerCase();

  const dish = restaurant.dishes.find(d => {
    // 1. Coincidencia por ID directo (UUID)
    if (d.id === cleanDishSlug) return true;
    
    // 2. Coincidencia por campo slug (si existe en el modelo)
    if ((d as any).slug && (d as any).slug.toLowerCase() === cleanDishSlug) return true;
    
    // 3. Coincidencia por nombre normalizado (sin paréntesis, tildes ni símbolos)
    const normalizedDishName = normalizeSlug(d.name);
    if (normalizedDishName === cleanDishSlug || normalizedDishName === normalizedCleanDishSlug) return true;
    
    // 4. Coincidencia por unslugify del slug recibido
    if (d.name.toLowerCase() === unslugifiedDishSlug) return true;

    return false;
  });

  if (!dish) {
    notFound();
  }

  return {
    ...dish,
    restaurant
  };
});

export async function generateMetadata({ params: paramsPromise }: Props): Promise<Metadata> {
  const params = await paramsPromise;
  const { slug, dishSlug } = params;

  try {
    const dish = await getDishWithRestaurant(slug, dishSlug);

    if (!dish || !dish.restaurant) {
      return {
        title: "Platillo no disponible | MenuQR Pro",
        robots: {
          index: false,
          follow: false,
        },
      };
    }

    const restaurant = dish.restaurant;
    const location = restaurant.city || restaurant.locality || "Ecuador";
    const title = `${dish.name} - $${Number(dish.price).toFixed(2)} | ${restaurant.name} en ${location}`;
    const description = dish.description 
      ? `${dish.description}. Disfruta ${dish.name} por $${Number(dish.price).toFixed(2)} en ${restaurant.name} (${location}). Haz tu pedido por WhatsApp.` 
      : `Pide ${dish.name} por $${Number(dish.price).toFixed(2)} en el menú digital de ${restaurant.name} en ${location}. Pedidos inmediatos a WhatsApp.`;

    const baseUrl = getBaseUrl();
    const url = `${baseUrl}/${slug}/${dishSlug}`;
    const imageUrl =
      resolvePublicImageUrl(dish.imageUrl) ||
      resolvePublicImageUrl(restaurant.logoUrl) ||
      `${baseUrl}/icon.png`;

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
    return {
      title: "Platillo | MenuQR Pro",
      robots: {
        index: false,
        follow: false,
      },
    };
  }
}

export default async function DishDetailPage({ params: paramsPromise }: Props) {
  const params = await paramsPromise;
  const { slug, dishSlug } = params;

  const dish = await getDishWithRestaurant(slug, dishSlug);

  if (!dish || !dish.restaurant) {
    notFound();
  }

  const restaurant = dish.restaurant;
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
  const sanitizedDishImage = resolvePublicImageUrl(dish.imageUrl);
  const dishUrl = `${baseUrl}/${restaurant.slug}/${dishSlug}`;

  const menuItemSchema = {
    "@context": "https://schema.org",
    "@type": "MenuItem",
    "name": dish.name,
    "description": dish.description || `${dish.name} en ${restaurant.name}`,
    "image": sanitizedDishImage || undefined,
    "url": dishUrl,
    "offers": {
      "@type": "Offer",
      "price": String(dish.price || 0),
      "priceCurrency": "USD",
      "url": dishUrl,
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
          {(() => {
            const dishImages = parseDishImages(dish.imageUrl);
            if (dishImages.length === 0) return null;
            return (
              <div className="space-y-3">
                <div className="w-full h-64 md:h-80 rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 relative">
                  <img
                    src={dishImages[0]}
                    alt={`${dish.name} - ${restaurant.name}`}
                    className="w-full h-full object-cover"
                  />
                  {dishImages.length > 1 && (
                    <div className="absolute top-3 right-3 px-2.5 py-1 rounded-xl bg-slate-950/80 backdrop-blur border border-slate-700 text-amber-300 text-xs font-bold shadow-lg">
                      📷 Galería ({dishImages.length} fotos)
                    </div>
                  )}
                </div>

                {dishImages.length > 1 && (
                  <div className="grid grid-cols-3 gap-2">
                    {dishImages.map((imgUrl, idx) => (
                      <div key={idx} className="space-y-1">
                        <div className="h-24 rounded-xl overflow-hidden bg-slate-950 border border-slate-800 relative">
                          <img
                            src={imgUrl}
                            alt={`${dish.name} - ángulo ${idx + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <p className="text-[10px] text-center text-slate-400 font-medium">
                          {idx === 0 ? "Frente / Principal" : idx === 1 ? "Espalda / Reverso" : "Detalle"}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

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

          {/* Ficha Semántica AEO (Answer Engine Optimization) */}
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 rounded-2xl bg-slate-950/60 border border-slate-800 text-xs">
            <div>
              <dt className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Categoría</dt>
              <dd className="font-semibold text-slate-200 mt-0.5">{dish.category?.name || "Carta General"}</dd>
            </div>
            <div>
              <dt className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Precio</dt>
              <dd className="font-semibold text-amber-400 mt-0.5">${Number(dish.price).toFixed(2)} USD</dd>
            </div>
            <div>
              <dt className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Disponibilidad</dt>
              <dd className="font-semibold text-emerald-400 mt-0.5">
                {dish.isAvailable ? "Disponible de Inmediato" : "Agotado Temporalmente"}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Restaurante</dt>
              <dd className="font-semibold text-slate-200 mt-0.5">{restaurant.name}</dd>
            </div>
            <div>
              <dt className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Ubicación</dt>
              <dd className="font-semibold text-slate-200 mt-0.5">{location}</dd>
            </div>
            <div>
              <dt className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Canal de Pedido</dt>
              <dd className="font-semibold text-slate-200 mt-0.5">WhatsApp Directo</dd>
            </div>
          </dl>

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
            <SmartLogo
              src={restaurant.logoUrl}
              alt={restaurant.name}
              name={restaurant.name}
              className="h-12 w-12 rounded-xl object-cover border border-slate-800"
            />
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

      <footer className="max-w-4xl w-full mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400 border-t border-slate-900 mt-8">
        <p>© 2026 MenuQR Pro.</p>
        <div className="flex items-center gap-4">
          <Link href={`/${restaurant.slug}`} className="hover:text-slate-300 transition">Menú de {restaurant.name}</Link>
          <Link href={`/registro?ref=${encodeURIComponent(restaurant.slug || "")}`} className="text-amber-400 hover:text-amber-300 font-bold transition">
            🚀 Registra tu Negocio
          </Link>
        </div>
      </footer>

      {/* Floating WhatsApp Action Button */}
      <FloatingWhatsAppButton
        phone={restaurant.whatsapp}
        businessName={restaurant.name}
        customMessage={`¡Hola! Me interesa pedir el plato: ${dish.name} ($${Number(dish.price).toFixed(2)}) en *${restaurant.name}*.`}
        bottomOffsetClass="bottom-6 right-6 sm:bottom-8 sm:right-8"
      />
    </div>
  );
}
