import { prisma } from "@/lib/db";
import { MenuClient } from "./components/MenuClient";
import { UtensilsCrossed } from "lucide-react";
import Link from "next/link";
import { getUserSession, getSuperAdminSession } from "@/lib/auth";
import { centralApiService, isCentralApiEnabled } from "@/lib/api-service";

export const dynamic = "force-dynamic";

import type { Metadata } from "next";

interface PageProps {
  params: {
    slug: string;
  };
}

const IGNORED_STATIC_SLUGS = [
  "favicon.ico",
  "robots.txt",
  "sitemap.xml",
  "icon.png",
  "apple-touch-icon.png",
  "manifest.json",
];

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const slug = params.slug.toLowerCase().trim();

  if (IGNORED_STATIC_SLUGS.includes(slug)) {
    return {};
  }

  // 1. Intentar la API Central como fuente principal para metadata
  try {
    const apiMenu = await centralApiService.getMenu(slug);
    if (apiMenu?.branch) {
      const name = apiMenu.branch.business?.name || apiMenu.branch.name || slug;
      const logoUrl = apiMenu.branch.business?.logoUrl || null;
      const coverUrl = apiMenu.branch.business?.coverUrl || null;
      const title = `Menú Digital de ${name} en Ecuador`;
      const description = `Escanea el código QR y consulta la carta digital completa de ${name}. Haz tu pedido directo a WhatsApp.`;
      return {
        title,
        description,
        openGraph: {
          title: `${name} | Menú Digital QR`,
          description,
          images: [{ url: logoUrl || coverUrl || "/icon.png", alt: `Logo de ${name}` }],
        },
        twitter: {
          card: "summary_large_image",
          title: `${name} | Menú Digital QR`,
          description,
          images: [logoUrl || coverUrl || "/icon.png"],
        },
      };
    }
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      console.warn(`[Metadata Warning] Central API menu lookup for ${slug} failed, fallback to local:`, err);
    }
  }

  try {
    const restaurant = await prisma.restaurant.findUnique({
      where: { slug },
      select: {
        name: true,
        specialty: true,
        locality: true,
        description: true,
        logoUrl: true,
        coverUrl: true,
      },
    });

    if (!restaurant) {
      return {
        title: "Menú no encontrado | MenuQR Pro",
      };
    }

    const title = `Menú Digital de ${restaurant.name} ${restaurant.locality ? `(${restaurant.locality})` : "en Ecuador"}`;
    const description = restaurant.description || `Escanea el código QR y consulta la carta digital completa de ${restaurant.name}. Especialidad: ${restaurant.specialty || "Gastronomía"}. Haz tu pedido directo a WhatsApp.`;

    return {
      title,
      description,
      openGraph: {
        title: `${restaurant.name} | Menú Digital QR`,
        description,
        images: [
          {
            url: restaurant.logoUrl || restaurant.coverUrl || "/icon.png",
            alt: `Logo de ${restaurant.name}`,
          },
        ],
      },
      twitter: {
        card: "summary_large_image",
        title: `${restaurant.name} | Menú Digital QR`,
        description,
        images: [restaurant.logoUrl || restaurant.coverUrl || "/icon.png"],
      },
    };
  } catch (err) {
    return {
      title: "Menú Digital QR | MenuQR Pro",
    };
  }
}

export default async function RestaurantMenuPage({ params }: PageProps) {
  const pageStartTime = performance.now();
  const slug = params.slug.toLowerCase().trim();

  if (IGNORED_STATIC_SLUGS.includes(slug)) {
    return null;
  }

  // 1. FUENTE PRINCIPAL: Consultar la API Central
  const apiStartTime = performance.now();
  try {
    const apiMenu = await centralApiService.getMenu(slug);
    const apiDuration = Math.round(performance.now() - apiStartTime);

    if (apiMenu?.branch) {
      const b = apiMenu.branch;
      const biz = b.business || {};
      const menus = apiMenu.menus || [];
      const primaryMenu = menus[0] || {};

      // Consultar imágenes locales de respaldo en PostgreSQL para logoUrl, coverUrl y platos cuando el valor central sea nulo o vacío
      let localImageMap: Map<string, string> = new Map();
      let localLogoUrl: string | null = null;
      let localCoverUrl: string | null = null;

      try {
        const localRest = await prisma.restaurant.findUnique({
          where: { slug },
          select: {
            logoUrl: true,
            coverUrl: true,
            categories: {
              select: {
                dishes: {
                  select: {
                    name: true,
                    imageUrl: true,
                  },
                },
              },
            },
          },
        });

        if (localRest) {
          localLogoUrl = localRest.logoUrl || null;
          localCoverUrl = localRest.coverUrl || null;
          for (const cat of localRest.categories || []) {
            for (const dish of cat.dishes || []) {
              if (dish.name && dish.imageUrl) {
                localImageMap.set(dish.name.toLowerCase().trim(), dish.imageUrl);
              }
            }
          }
        }
      } catch {
        // Ignorar si falla la consulta secundaria de imágenes locales
      }

      const categories = (primaryMenu.categories || []).map((c: any) => ({
        id: c.id,
        name: c.name,
        order: c.order ?? 0,
        isActive: c.isActive ?? true,
        dishes: (c.products || []).map((p: any) => {
          const numPrice = Number(p.price);
          const cleanName = (p.name || "").toLowerCase().trim();
          const fallbackDishImage = localImageMap.get(cleanName) || null;
          const hasCentralImage = p.imageUrl && typeof p.imageUrl === "string" && p.imageUrl.trim().length > 0;

          return {
            id: p.id,
            name: p.name,
            description: p.description ?? null,
            price: Number.isFinite(numPrice) ? numPrice : 0,
            imageUrl: hasCentralImage ? p.imageUrl : fallbackDishImage,
            isAvailable: p.isAvailable ?? true,
          };
        }),
      }));

      const totalDuration = Math.round(performance.now() - pageStartTime);
      console.log(`[API CENTRAL INTERNA] Exitoso para '${slug}' (centralBranchId: ${b.id} | Categorías: ${categories.length}) - API Central: ${apiDuration}ms | Total Servidor: ${totalDuration}ms`);

      const [session, isSuperAdmin] = await Promise.all([
        getUserSession(),
        getSuperAdminSession(),
      ]);

      const hasCentralLogo = biz.logoUrl && typeof biz.logoUrl === "string" && biz.logoUrl.trim().length > 0;
      const hasCentralCover = biz.coverUrl && typeof biz.coverUrl === "string" && biz.coverUrl.trim().length > 0;

      const serializedRestaurant = {
        id: b.id,
        name: biz.name || b.name || slug,
        slug: b.slug || slug,
        specialty: biz.industry || "Gastronomía",
        locality: b.address || "Ecuador",
        description: biz.description || "",
        logoUrl: hasCentralLogo ? biz.logoUrl : localLogoUrl,
        coverUrl: hasCentralCover ? biz.coverUrl : localCoverUrl,
        whatsapp: b.phone || biz.whatsapp || "",
        whatsappNumber: b.phone || biz.whatsapp || "",
        paymentQrUrl: null,
        themeColor: "#ef4444",
        plan: "PRO",
        isOwner: !!session || isSuperAdmin,
        trialEndsAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        tablesConfig: "1,2,3,4,5,6,7,8,9,10",
        ivaPercent: 15,
        servicePercent: 10,
        deliveryCost: 0.0,
        deliveryEnabled: true,
        bankName: null,
        bankAccountType: null,
        bankAccountNumber: null,
        bankAccountName: null,
        bankAccountDocument: null,
        bankAccountEmail: null,
        ivaOnTable: true,
        ivaOnTakeout: true,
        serviceOnTable: true,
        serviceOnTakeout: false,
        orders: [],
        seasonRates: [],
        categories,
      };

      const restaurantSchema = {
        "@context": "https://schema.org",
        "@type": "Restaurant",
        "name": serializedRestaurant.name,
        "image": serializedRestaurant.logoUrl || serializedRestaurant.coverUrl || undefined,
        "description": serializedRestaurant.description || `Menú digital de ${serializedRestaurant.name}`,
        "servesCuisine": serializedRestaurant.specialty || "Gastronomía",
        "address": {
          "@type": "PostalAddress",
          "addressLocality": serializedRestaurant.locality || "Ecuador",
          "addressCountry": "EC",
        },
        "telephone": serializedRestaurant.whatsapp || undefined,
        "url": `${process.env.NEXT_PUBLIC_APP_URL || "https://menuqrpro.com"}/${serializedRestaurant.slug}`,
      };

      return (
        <>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(restaurantSchema) }}
          />
          <MenuClient restaurant={serializedRestaurant as any} centralBranchId={b.id} />
        </>
      );
    }
  } catch (err: any) {
    const apiDuration = Math.round(performance.now() - apiStartTime);
    console.warn(`[FALLBACK LOCAL] La API Central no respondió o superó el timeout de 3000ms en ${apiDuration}ms para '${slug}' (${err?.message}). Consultando PostgreSQL local via Prisma...`);
  }

  const prismaStartTime = performance.now();
  try {
    const restaurant = await prisma.restaurant.findUnique({
      where: { slug },
      include: {
        categories: {
          orderBy: { order: "asc" },
          include: {
            dishes: {
              orderBy: { createdAt: "desc" },
            },
          },
        },
        seasonRates: {
          where: { isActive: true },
          orderBy: { startDate: "asc" },
        },
      },
    });

    const prismaDuration = Math.round(performance.now() - prismaStartTime);

    if (!restaurant) {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-6 text-center relative overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-red-600/10 rounded-full blur-[100px] pointer-events-none"></div>
          <div className="relative z-10 max-w-md space-y-6">
            <div className="h-16 w-16 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-center mx-auto text-red-500 shadow-xl">
              <UtensilsCrossed className="h-8 w-8" />
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl font-extrabold tracking-tight text-white">Menú no encontrado</h1>
              <p className="text-slate-400 text-sm">
                El restaurante <code className="text-slate-300 bg-slate-900 px-1.5 py-0.5 rounded">/{params.slug}</code> no existe o ha sido modificado.
              </p>
            </div>
            <div className="pt-4 flex flex-col gap-2">
              <Link href="/admin" className="px-6 py-3 rounded-xl bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-bold text-sm shadow-lg transition-all">
                Ir al Panel Admin
              </Link>
              <Link href="/mamma-mia" className="text-xs text-slate-500 hover:text-slate-400 underline transition">
                Ver menú de muestra (Mamma Mia)
              </Link>
            </div>
          </div>
        </div>
      );
    }

    const totalDuration = Math.round(performance.now() - pageStartTime);
    console.log(`[MenuPage Performance Log] FALLBACK LOCAL: Restaurante '${slug}' cargado desde PostgreSQL local (Prisma: ${prismaDuration}ms | Total Servidor: ${totalDuration}ms)`);

    if (restaurant.trialEndsAt < new Date()) {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-6 text-center relative overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-amber-600/10 rounded-full blur-[100px] pointer-events-none"></div>
          <div className="relative z-10 max-w-md space-y-6">
            <div className="h-16 w-16 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-center mx-auto text-amber-500 shadow-xl">
              <UtensilsCrossed className="h-8 w-8" />
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl font-extrabold tracking-tight text-white">Demo Expirada</h1>
              <p className="text-slate-400 text-sm">
                El período de prueba de 30 días para <strong>{restaurant.name}</strong> ha finalizado.
              </p>
              <p className="text-xs text-slate-500 leading-relaxed">
                Contacta al administrador para renovar la suscripción.
              </p>
            </div>
            <div className="pt-4">
              <Link href="/admin" className="px-6 py-3 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-white font-bold text-sm shadow-lg transition-all">
                Acceder al Panel Admin
              </Link>
            </div>
          </div>
        </div>
      );
    }

    const session = await getUserSession();
    const isSuperAdmin = await getSuperAdminSession();
    const isOwner = (session && session.userId === restaurant.userId) || isSuperAdmin;

    // Build serialised restaurant with safe defaults for fields that may not yet exist in production DB
    const r = restaurant as any;
    const serializedRestaurant = {
      ...restaurant,
      whatsappNumber: r.whatsapp ?? "",
      paymentQrUrl: r.qrCobroUrl ?? null,
      coverUrl: r.coverUrl ?? null,
      isOwner: !!isOwner,
      trialEndsAt: restaurant.trialEndsAt.toISOString(),
      tablesConfig: r.tablesConfig ?? "1,2,3,4,5,6,7,8,9,10",
      ivaPercent: r.ivaPercent ?? 15,
      servicePercent: r.servicePercent ?? 10,
      deliveryCost: r.deliveryCost ?? 0.0,
      deliveryEnabled: r.deliveryEnabled ?? true,
      bankName: r.bankName ?? null,
      bankAccountType: r.bankAccountType ?? null,
      bankAccountNumber: r.bankAccountNumber ?? null,
      bankAccountName: r.bankAccountName ?? null,
      bankAccountDocument: r.bankAccountDocument ?? null,
      bankAccountEmail: r.bankAccountEmail ?? null,
      ivaOnTable: r.ivaOnTable ?? true,
      ivaOnTakeout: r.ivaOnTakeout ?? true,
      serviceOnTable: r.serviceOnTable ?? true,
      serviceOnTakeout: r.serviceOnTakeout ?? false,
      orders: [],
      seasonRates: ((restaurant as any).seasonRates ?? []).map((sr: any) => ({
        ...sr,
        startDate: sr.startDate.toISOString().split("T")[0],
        endDate: sr.endDate.toISOString().split("T")[0],
        createdAt: sr.createdAt.toISOString(),
        updatedAt: sr.updatedAt.toISOString(),
      })),
      categories: restaurant.categories.map((c) => ({
        ...c,
        dishes: c.dishes.map((d) => ({
          ...d,
          description: d.description ?? null,
          imageUrl: d.imageUrl ?? null,
        })),
      })),
    };

    const restaurantSchema = {
      "@context": "https://schema.org",
      "@type": "Restaurant",
      "name": restaurant.name,
      "image": restaurant.logoUrl || restaurant.coverUrl || undefined,
      "description": restaurant.description || `Menú digital de ${restaurant.name}`,
      "servesCuisine": restaurant.specialty || "Gastronomía",
      "address": {
        "@type": "PostalAddress",
        "addressLocality": restaurant.locality || "Ecuador",
        "addressCountry": "EC",
      },
      "telephone": restaurant.whatsapp || undefined,
      "url": `${process.env.NEXT_PUBLIC_APP_URL || "https://menuqrpro.com"}/${restaurant.slug}`,
    };

    return (
      <>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(restaurantSchema) }}
        />
        <MenuClient restaurant={serializedRestaurant} />
      </>
    );

  } catch (err) {
    // Print the real error to server stdout — visible in Coolify logs
    console.error(`[MenuPage] Error loading /${slug}:`, err);

    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-6 text-center relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-red-600/10 rounded-full blur-[100px] pointer-events-none"></div>
        <div className="relative z-10 max-w-md space-y-6">
          <div className="h-16 w-16 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-center mx-auto text-red-500 shadow-xl">
            <UtensilsCrossed className="h-8 w-8" />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-extrabold tracking-tight text-white">Error Temporal</h1>
            <p className="text-slate-400 text-sm">
              Hubo un problema al cargar el menú de <strong>/{slug}</strong>. Por favor intenta nuevamente en unos minutos.
            </p>
          </div>
          <div className="pt-4">
            <Link href={`/${slug}`} className="px-6 py-3 rounded-xl bg-gradient-to-r from-red-600 to-amber-600 text-white font-bold text-sm shadow-lg transition-all">
              Reintentar
            </Link>
          </div>
        </div>
      </div>
    );
  }
}
