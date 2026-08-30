import { prisma } from "@/lib/db";
import { MenuClient } from "./components/MenuClient";
import { UtensilsCrossed } from "lucide-react";
import Link from "next/link";
import { getUserSession, getSuperAdminSession } from "@/lib/auth";
import { centralApiService } from "@/lib/api-service";

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

function normalizeMenuName(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Función auxiliar para seleccionar valores respetando la prioridad: API Central -> PostgreSQL Local -> Predeterminado
function pickVal<T>(centralVal: any, localVal: any, defaultVal: T): T {
  if (centralVal !== null && centralVal !== undefined) {
    if (typeof centralVal === "string" && centralVal.trim().length > 0) {
      return centralVal as unknown as T;
    } else if (typeof centralVal === "number" && !isNaN(centralVal)) {
      return centralVal as unknown as T;
    } else if (typeof centralVal === "boolean") {
      return centralVal as unknown as T;
    }
  }
  if (localVal !== null && localVal !== undefined) {
    if (typeof localVal === "string" && localVal.trim().length > 0) {
      return localVal as unknown as T;
    } else if (typeof localVal === "number" && !isNaN(localVal)) {
      return localVal as unknown as T;
    } else if (typeof localVal === "boolean") {
      return localVal as unknown as T;
    }
  }
  return defaultVal;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const slug = params.slug.toLowerCase().trim();

  if (IGNORED_STATIC_SLUGS.includes(slug)) {
    return {};
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
  } catch {
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

      let localRest: any = null;
      let localImageMap: Map<string, string> = new Map();

      try {
        localRest = await prisma.restaurant.findUnique({
          where: { slug },
          include: {
            categories: {
              include: {
                dishes: true,
              },
            },
          },
        });

        if (localRest) {
          for (const cat of localRest.categories || []) {
            for (const dish of cat.dishes || []) {
              if (dish.name && dish.imageUrl) {
                localImageMap.set(normalizeMenuName(dish.name), dish.imageUrl);
              }
            }
          }
        }
      } catch {
        // Ignorar si falla la consulta secundaria de datos locales
      }

      const categories = (primaryMenu.categories || []).map((c: any) => ({
        id: c.id,
        name: c.name,
        order: c.order ?? 0,
        isActive: c.isActive ?? true,
        dishes: (c.products || []).map((p: any) => {
          const numPrice = Number(p.price);
          const cleanName = normalizeMenuName(p.name);
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

      const phoneNum = pickVal<string>(b.phone || biz.whatsapp || biz.phone, localRest?.whatsapp, "");

      const serializedRestaurant = {
        id: b.id,
        name: pickVal<string>(biz.name || b.name, localRest?.name, slug),
        slug: pickVal<string>(b.slug || biz.slug, localRest?.slug, slug),
        specialty: pickVal<string>(biz.industry || biz.specialty || b.specialty, localRest?.specialty, "Gastronomía"),
        description: pickVal<string>(biz.description || b.description, localRest?.description, ""),
        logoUrl: pickVal<string | null>(biz.logoUrl || b.logoUrl, localRest?.logoUrl, null),
        coverUrl: pickVal<string | null>(biz.coverUrl || b.coverUrl, localRest?.coverUrl, null),
        paymentQrUrl: pickVal<string | null>(b.qrCobroUrl || b.paymentQrUrl || biz.qrCobroUrl, localRest?.qrCobroUrl, null),
        whatsapp: phoneNum,
        whatsappNumber: phoneNum,
        instagram: pickVal<string | null>(biz.instagram || b.instagram, localRest?.instagram, null),
        facebook: pickVal<string | null>(biz.facebook || b.facebook, localRest?.facebook, null),
        tiktok: pickVal<string | null>(biz.tiktok || b.tiktok, localRest?.tiktok, null),
        address: pickVal<string | null>(b.address || biz.address, localRest?.address, null),
        locality: pickVal<string | null>(b.locality || b.city || (b.provincia ? `${b.city ? b.city + ", " : ""}${b.provincia}` : null), localRest?.locality, "Ecuador"),
        city: pickVal<string | null>(b.city, (localRest as any)?.city || null, null),
        provincia: pickVal<string | null>(b.provincia || b.state, (localRest as any)?.province || (localRest as any)?.provincia || null, null),
        phone: pickVal<string | null>(b.phone || biz.phone, (localRest as any)?.phone || localRest?.whatsapp || null, null),
        email: pickVal<string | null>(b.email || biz.email, (localRest as any)?.email || null, null),
        tablesConfig: pickVal<string>(b.tablesConfig, localRest?.tablesConfig, "1,2,3,4,5,6,7,8,9,10"),
        schedule: pickVal<string | null>(b.schedule, localRest?.schedule, null),
        localSchedule: pickVal<string | null>(b.localSchedule, (localRest as any)?.localSchedule || localRest?.schedule || null, null),
        deliverySchedule: pickVal<string | null>(b.deliverySchedule, (localRest as any)?.deliverySchedule || localRest?.schedule || null, null),
        deliveryEnabled: pickVal<boolean>(b.deliveryEnabled, localRest?.deliveryEnabled, true),
        deliveryCost: pickVal<number>(b.deliveryCost, localRest?.deliveryCost, 0.0),
        deliveryRates: pickVal<string | null>(b.deliveryRates, localRest?.deliveryRates, null),
        ivaPercent: pickVal<number>(b.ivaPercent, localRest?.ivaPercent, 15.0),
        servicePercent: pickVal<number>(b.servicePercent, localRest?.servicePercent, 10.0),
        bankName: pickVal<string | null>(b.bankName, localRest?.bankName, null),
        bankAccountType: pickVal<string | null>(b.bankAccountType, localRest?.bankAccountType, null),
        bankAccountNumber: pickVal<string | null>(b.bankAccountNumber, localRest?.bankAccountNumber, null),
        bankAccountName: pickVal<string | null>(b.bankAccountName, localRest?.bankAccountName, null),
        bankAccountDocument: pickVal<string | null>(b.bankAccountDocument, localRest?.bankAccountDocument, null),
        bankAccountEmail: pickVal<string | null>(b.bankAccountEmail, localRest?.bankAccountEmail, null),
        themeColor: pickVal<string>(b.themeColor || biz.themeColor, localRest?.themeColor, "#ef4444"),
        mapEmbedUrl: pickVal<string | null>(b.mapEmbedUrl || biz.mapEmbedUrl, localRest?.mapEmbedUrl, null),
        ubicameUrl: pickVal<string | null>(b.ubicameUrl || biz.ubicameUrl, localRest?.ubicameUrl, null),
        services: pickVal<string | null>(b.services || biz.services, localRest?.services, null),
        contactNumbers: pickVal<string | null>(b.contactNumbers || biz.contactNumbers, localRest?.contactNumbers, null),
        ivaOnTable: pickVal<boolean>(b.ivaOnTable, localRest?.ivaOnTable, true),
        ivaOnTakeout: pickVal<boolean>(b.ivaOnTakeout, localRest?.ivaOnTakeout, true),
        serviceOnTable: pickVal<boolean>(b.serviceOnTable, localRest?.serviceOnTable, true),
        serviceOnTakeout: pickVal<boolean>(b.serviceOnTakeout, localRest?.serviceOnTakeout, false),
        plan: "PRO",
        isOwner: !!session || isSuperAdmin,
        trialEndsAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
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
            <h1 className="text-2xl font-bold text-amber-400">Suscripción Expirada</h1>
            <p className="text-slate-300 text-sm">El menú de {restaurant.name} se encuentra temporalmente inactivo por vencimiento de plan.</p>
          </div>
        </div>
      );
    }

    const [session, isSuperAdmin] = await Promise.all([
      getUserSession(),
      getSuperAdminSession(),
    ]);

    const serializedRestaurant = {
      ...restaurant,
      trialEndsAt: restaurant.trialEndsAt.toISOString(),
      createdAt: restaurant.createdAt.toISOString(),
      updatedAt: restaurant.updatedAt.toISOString(),
      isOwner: !!session || isSuperAdmin,
      categories: restaurant.categories.map((cat: any) => ({
        ...cat,
        createdAt: cat.createdAt.toISOString(),
        updatedAt: cat.updatedAt.toISOString(),
        dishes: cat.dishes.map((dish: any) => ({
          ...dish,
          createdAt: dish.createdAt.toISOString(),
          updatedAt: dish.updatedAt.toISOString(),
        })),
      })),
      seasonRates: (restaurant.seasonRates || []).map((rate: any) => ({
        ...rate,
        startDate: rate.startDate.toISOString(),
        endDate: rate.endDate.toISOString(),
        createdAt: rate.createdAt.toISOString(),
        updatedAt: rate.updatedAt.toISOString(),
      })),
    };

    return (
      <MenuClient restaurant={serializedRestaurant as any} />
    );
  } catch (err: any) {
    console.error("[MenuPage Error] Fallo critico en Server Component:", err);
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-6 text-center">
        <h1 className="text-xl font-bold text-red-500">Error al cargar el restaurante</h1>
        <p className="text-slate-400 text-xs mt-2">{err?.message || "Ocurrió un error inesperado."}</p>
      </div>
    );
  }
}
