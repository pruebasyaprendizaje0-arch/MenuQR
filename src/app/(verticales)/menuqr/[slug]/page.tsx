import { prisma } from "@/lib/db";
import { MenuClient } from "@/app/[slug]/components/MenuClient";
import { UtensilsCrossed } from "lucide-react";
import Link from "next/link";
import { redirect, RedirectType } from "next/navigation";
import { getUserSession, getSuperAdminSession } from "@/lib/auth";
import { findRestaurantBySlugOrHistory } from "@/lib/slugs";
import { trackAnalyticsEvent } from "@/lib/analytics";
import type { Metadata } from "next";
import { generateRestaurantJsonLd, getBaseUrl } from "@/lib/seo";
import { getMockDemoRestaurant } from "@/lib/demo-data";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{
    slug: string;
  }>;
}

const IGNORED_STATIC_SLUGS = [
  "favicon.ico",
  "robots.txt",
  "sitemap.xml",
  "icon.png",
  "apple-touch-icon.png",
  "manifest.json",
];

export async function generateMetadata({ params: paramsPromise }: PageProps): Promise<Metadata> {
  const params = await paramsPromise;
  const slug = params.slug.toLowerCase().trim();

  if (IGNORED_STATIC_SLUGS.includes(slug)) {
    return {};
  }

  if (slug === "demo") {
    return {
      title: "Menú Interactivo de Muestra | MenuQR Pro",
      description: "Prueba el menú interactivo con pedidos directos a mesa, delivery y división de cuenta.",
    };
  }

  try {
    const restaurant = await prisma.restaurant.findUnique({
      where: { slug },
      select: {
        name: true,
        specialty: true,
        locality: true,
        city: true,
        description: true,
        logoUrl: true,
        coverUrl: true,
        seoTitle: true,
        seoDescription: true,
        seoKeywords: true,
        seoImage: true,
      },
    });

    if (!restaurant) {
      return {
        title: "Menú no encontrado | MenuQR Pro",
      };
    }

    const baseUrl = getBaseUrl();
    const cityOrLocality = restaurant.city || restaurant.locality || "Ecuador";
    const title = restaurant.seoTitle || `Menú Digital de ${restaurant.name} (${cityOrLocality})`;
    const description =
      restaurant.seoDescription ||
      restaurant.description ||
      `Escanea el código QR y consulta la carta digital completa de ${restaurant.name}. Especialidad: ${restaurant.specialty || "Gastronomía"}. Haz tu pedido directo a WhatsApp.`;

    const rawImageUrl = restaurant.seoImage || restaurant.logoUrl || restaurant.coverUrl || "/icon.png";
    const imageUrl = rawImageUrl.startsWith("http") ? rawImageUrl : `${baseUrl}${rawImageUrl.startsWith("/") ? "" : "/"}${rawImageUrl}`;

    return {
      metadataBase: new URL(baseUrl),
      title,
      description,
      alternates: {
        canonical: `${baseUrl}/menuqr/${slug}`,
      },
      openGraph: {
        title,
        description,
        url: `${baseUrl}/menuqr/${slug}`,
        images: [{ url: imageUrl, alt: `Imagen de ${restaurant.name}` }],
      },
    };
  } catch {
    return {
      title: "Menú Digital QR | MenuQR Pro",
    };
  }
}

function toIso(val: any): string {
  if (!val) return new Date().toISOString();
  if (typeof val === "string") return val;
  if (val instanceof Date) return val.toISOString();
  try {
    return new Date(val).toISOString();
  } catch {
    return new Date().toISOString();
  }
}

export default async function MenuQRDetailPage({ params: paramsPromise }: PageProps) {
  const params = await paramsPromise;
  const slug = params.slug.toLowerCase().trim();

  if (IGNORED_STATIC_SLUGS.includes(slug)) {
    return null;
  }

  // Si se solicita el demo especial
  if (slug === "demo") {
    const demoData = getMockDemoRestaurant();
    return <MenuClient restaurant={demoData as any} />;
  }

  try {
    const slugCheck = await findRestaurantBySlugOrHistory(slug);
    if (slugCheck.isRedirect && slugCheck.targetSlug) {
      redirect(`/menuqr/${slugCheck.targetSlug}`, RedirectType.replace);
    }

    const restaurant = await prisma.restaurant.findUnique({
      where: { slug },
      include: {
        categories: {
          orderBy: { order: "asc" },
          include: {
            dishes: {
              where: { isVisible: true },
              orderBy: { createdAt: "desc" },
            },
          },
        },
        seasonRates: {
          where: { isActive: true },
          orderBy: { startDate: "asc" },
        },
        ruletaConfig: {
          select: { activa: true },
        },
      },
    });

    if (!restaurant) {
      // Fallback a demo interactivo si el restaurante de prueba aún no está sembrado
      const demoData = getMockDemoRestaurant();
      demoData.name = `Restaurante (${slug})`;
      demoData.slug = slug;
      return <MenuClient restaurant={demoData as any} />;
    }

    // Registrar analítica
    trackAnalyticsEvent("RESTAURANT_VIEW", restaurant.id, { slug, locality: restaurant.locality, city: restaurant.city });

    const [session, isSuperAdmin] = await Promise.all([
      getUserSession(),
      getSuperAdminSession(),
    ]);

    let rawCategoryAspectRatios: Array<{ id: string; imageAspectRatio: string | null }> = [];
    try {
      if (restaurant?.id) {
        rawCategoryAspectRatios = await prisma.$queryRaw<Array<{ id: string; imageAspectRatio: string | null }>>`
          SELECT "id", "imageAspectRatio" FROM "Category" WHERE "restaurantId" = ${restaurant.id}
        `;
      }
    } catch {}

    const aspectMap = new Map(rawCategoryAspectRatios.map((r) => [r.id, r.imageAspectRatio]));

    const serializedRestaurant = {
      ...restaurant,
      whatsappNumber: restaurant.whatsapp || "",
      paymentQrUrl: restaurant.qrCobroUrl || null,
      trialEndsAt: toIso(restaurant.trialEndsAt),
      createdAt: toIso(restaurant.createdAt),
      updatedAt: toIso(restaurant.updatedAt),
      isOwner: !!session || isSuperAdmin,
      isRuletaActiva: (restaurant as any).ruletaConfig ? Boolean((restaurant as any).ruletaConfig.activa) : true,
      categories: (restaurant.categories || []).map((cat: any) => ({
        ...cat,
        imageAspectRatio: aspectMap.get(cat.id) || cat.imageAspectRatio || "DEFAULT",
        createdAt: toIso(cat.createdAt),
        updatedAt: toIso(cat.updatedAt),
        dishes: (cat.dishes || []).map((dish: any) => ({
          ...dish,
          createdAt: toIso(dish.createdAt),
          updatedAt: toIso(dish.updatedAt),
        })),
      })),
      seasonRates: (restaurant.seasonRates || []).map((rate: any) => ({
        ...rate,
        startDate: toIso(rate.startDate),
        endDate: toIso(rate.endDate),
        createdAt: toIso(rate.createdAt),
        updatedAt: toIso(rate.updatedAt),
      })),
    };

    const restaurantSchema = generateRestaurantJsonLd(restaurant);

    return (
      <>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(restaurantSchema) }}
        />
        <MenuClient restaurant={serializedRestaurant as any} />
      </>
    );
  } catch (err: any) {
    if (
      err?.digest?.startsWith("NEXT_REDIRECT") ||
      err?.message?.includes("NEXT_REDIRECT") ||
      err?.digest?.startsWith("NEXT_NOT_FOUND") ||
      err?.message?.includes("NEXT_NOT_FOUND")
    ) {
      throw err;
    }
    console.error("[MenuQRDetailPage Error]:", err);
    const demoData = getMockDemoRestaurant();
    return <MenuClient restaurant={demoData as any} />;
  }
}
