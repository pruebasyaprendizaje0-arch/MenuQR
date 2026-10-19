import React from "react";
import { prisma } from "@/lib/db";
import { findRestaurantBySlugOrHistory } from "@/lib/slugs";
import type { Metadata } from "next";
import { CtaloClient } from "./components/CtaloClient";
import { redirect } from "next/navigation";
import { getBusinessLabels } from "@/lib/business-labels";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{
    slug: string;
  }>;
}

export async function generateMetadata({ params: paramsPromise }: PageProps): Promise<Metadata> {
  const params = await paramsPromise;
  const slug = params.slug.toLowerCase().trim();

  if (slug === "demo") {
    return {
      title: "Catálogo Demo | Boutique & Calzado Pro",
      description: "Catálogo interactivo con variantes de tallas, colores y carrito de compras para WhatsApp.",
    };
  }

  try {
    const store = await prisma.restaurant.findUnique({
      where: { slug },
      select: {
        name: true,
        description: true,
        logoUrl: true,
        specialty: true,
        city: true,
      },
    });

    if (store) {
      return {
        title: `${store.name} | Catálogo E-Commerce`,
        description: store.description || `Catálogo oficial de ${store.name}. Compra con variantes de tallas y colores directo por WhatsApp.`,
      };
    }
  } catch {}

  return {
    title: "Catálogo E-Commerce | Ubícame Pro",
  };
}

// Datos demo si el comercio no existe o si se solicita /ctalo/demo
function getMockDemoStore() {
  return {
    id: "demo-boutique-id",
    name: "Aura Boutique & Calzado Urbano",
    slug: "demo",
    whatsapp: "593999999999",
    logoUrl: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=200&auto=format&fit=crop&q=80",
    coverUrl: "https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?w=1200&auto=format&fit=crop&q=80",
    address: "Mall del Sol, Nivel 2, Local 45, Guayaquil",
    description: "Colección exclusiva de moda femenina, calzado en cuero genuino, joyas en plata 925 y accesorios de temporada.",
    galleryImages: [
      "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1000&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?w=1000&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=1000&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?w=1000&auto=format&fit=crop&q=80",
    ],
    deliveryCost: 3.5,
    categories: [
      {
        id: "cat-calzado",
        name: "👟 Calzado & Sneakers",
        imageAspectRatio: "DEFAULT",
        products: [
          {
            id: "prod-1",
            name: "Sneakers Urbanos Blancos Suela Chunky",
            description: "Calzado de cuero sintético premium transpirable, plantilla ortopédica acolchada y suela antideslizante de alta duración.",
            price: 49.99,
            imageUrl: "https://images.unsplash.com/photo-1549298916-b41d501d3772?w=600&auto=format&fit=crop&q=80",
            tallas: ["36", "37", "38", "39", "40"],
            colores: ["Blanco Puro", "Blanco con Detalles Oro", "Beige Arena"],
            stock: 12,
            isNew: true,
          },
          {
            id: "prod-2",
            name: "Botines de Cuero Chelsea Dark",
            description: "Botines clásicos con elásticos laterales, forro térmico suave y tacón bajo cuadrado de 4 cm muy cómodo.",
            price: 68.0,
            imageUrl: "https://images.unsplash.com/photo-1520639888713-7851133b1ed0?w=600&auto=format&fit=crop&q=80",
            tallas: ["37", "38", "39", "40", "41"],
            colores: ["Negro Mate", "Café Chocolate", "Vino"],
            stock: 8,
            isNew: false,
          },
        ],
      },
      {
        id: "cat-ropa",
        name: "👗 Ropa & Prendas",
        imageAspectRatio: "DEFAULT",
        products: [
          {
            id: "prod-3",
            name: "Vestido Midi Plisado Seda Fría",
            description: "Corte evasé con escote en V, cinto ajustable a la cintura y falda fluida con forro interno que no transparenta.",
            price: 39.5,
            imageUrl: "https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=600&auto=format&fit=crop&q=80",
            tallas: ["S", "M", "L", "XL"],
            colores: ["Verde Esmeralda", "Terracota", "Negro Clásico", "Azul Noche"],
            stock: 15,
            isNew: true,
          },
          {
            id: "prod-4",
            name: "Blazer Oversize Sastrería Chic",
            description: "Chaqueta estructurada con hombreras suaves, solapa invertida y botones dorados grabados.",
            price: 45.0,
            imageUrl: "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=600&auto=format&fit=crop&q=80",
            tallas: ["S", "M", "L"],
            colores: ["Beige Camel", "Blanco Marfil", "Negro", "Lila Pastel"],
            stock: 6,
            isNew: false,
          },
        ],
      },
      {
        id: "cat-joyas",
        name: "💍 Joyería & Accesorios",
        imageAspectRatio: "DEFAULT",
        products: [
          {
            id: "prod-5",
            name: "Juego de Aretes y Collar Perlas Barrocas",
            description: "Bañado en oro de 18k hipoalergénico con perlas de agua dulce cultivadas. Incluye estuche de regalo.",
            price: 28.0,
            imageUrl: "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=600&auto=format&fit=crop&q=80",
            tallas: ["Única"],
            colores: ["Oro 18k", "Plata 925"],
            stock: 20,
            isNew: true,
          },
        ],
      },
    ],
  };
}

export default async function CtaloSlugPage({ params: paramsPromise }: PageProps) {
  const params = await paramsPromise;
  const slug = params.slug.toLowerCase().trim();

  if (slug === "demo") {
    const demoStore = getMockDemoStore();
    return <CtaloClient store={demoStore} />;
  }

  try {
    const slugCheck = await findRestaurantBySlugOrHistory(slug);
    if (slugCheck.isRedirect && slugCheck.targetSlug) {
      redirect(`/ctalo/${slugCheck.targetSlug}`);
    }
    const realSlug = slugCheck.restaurant?.slug || slug;

    let store = await prisma.restaurant.findUnique({
      where: { slug: realSlug },
      include: {
        categories: {
          orderBy: { order: "asc" },
          include: {
            dishes: {
              where: { isAvailable: true },
              orderBy: { createdAt: "desc" },
            },
          },
        },
      },
    });

    if (!store && slug) {
      store = await prisma.restaurant.findFirst({
        where: {
          OR: [
            { slug: { contains: slug } },
            { name: { contains: slug, mode: "insensitive" } },
          ],
        },
        include: {
          categories: {
            orderBy: { order: "asc" },
            include: {
              dishes: {
                where: { isAvailable: true },
                orderBy: { createdAt: "desc" },
              },
            },
          },
        },
      });
    }

    if (!store) {
      const demoStore = getMockDemoStore();
      demoStore.name = `Tienda (${slug})`;
      demoStore.slug = slug;
      return <CtaloClient store={demoStore} />;
    }

    let rawCategoryAspectRatios: Array<{ id: string; imageAspectRatio: string | null }> = [];
    try {
      if (store?.id) {
        rawCategoryAspectRatios = await prisma.$queryRaw<Array<{ id: string; imageAspectRatio: string | null }>>`
          SELECT "id", "imageAspectRatio" FROM "Category" WHERE "restaurantId" = ${store.id}
        `;
      }
    } catch (err) {
      console.error("Error fetching raw category aspect ratios in CtaloSlugPage:", err);
    }
    const aspectMap = new Map(rawCategoryAspectRatios.map((r) => [r.id, r.imageAspectRatio]));
    const bLabels = getBusinessLabels(store.customLabels, "RETAIL");

    let customMeta: any = {};
    if ((store as any).customLabels) {
      try {
        customMeta = JSON.parse((store as any).customLabels);
      } catch {}
    }

    // Normalizar datos de la BD al formato del Catálogo E-Commerce
    const formattedStore = {
      id: store.id,
      name: store.name,
      slug: store.slug,
      imageAspectRatio: bLabels.imageAspectRatio,
      suggestedAspectRatio: bLabels.suggestedAspectRatio,
      popularAspectRatio: bLabels.popularAspectRatio,
      galleryImages: Array.isArray(customMeta.galleryImages) && customMeta.galleryImages.length > 0
        ? customMeta.galleryImages.filter((u: any) => typeof u === "string" && u.trim().length > 0).slice(0, 4)
        : (getMockDemoStore().galleryImages || []),
      whatsapp: store.whatsapp || "",
      logoUrl: store.logoUrl || null,
      coverUrl: store.coverUrl || null,
      qrCobroUrl: store.qrCobroUrl || null,
      paymentQrUrl: store.qrCobroUrl || null,
      bankName: store.bankName || null,
      bankAccountType: store.bankAccountType || null,
      bankAccountNumber: store.bankAccountNumber || null,
      bankAccountName: store.bankAccountName || null,
      bankAccountDocument: store.bankAccountDocument || null,
      bankAccountEmail: store.bankAccountEmail || null,
      address: store.address || "Local Comercial",
      description: store.description || "Catálogo de productos con entrega a domicilio y retiro en tienda.",
      deliveryCost: store.deliveryCost || 3.0,
      deliveryRates: (store as any).deliveryRates || null,
      enableDelivery: (store as any).enableDelivery ?? true,
      enableTakeout: (store as any).enableTakeout ?? true,
      taxRate: store.ivaPercent || 0,
      serviceRate: store.servicePercent || 0,
      categories: store.categories.map((cat) => ({
        id: cat.id,
        name: cat.name,
        imageAspectRatio: aspectMap.get(cat.id) || (cat as any).imageAspectRatio || "DEFAULT",
        products: cat.dishes.map((dish) => {
          let hasVariants = false;
          let attribute1Name: string | null = null;
          let attribute1Options: string[] = [];
          let attribute2Name: string | null = null;
          let attribute2Options: string[] = [];

          if (dish.variants) {
            try {
              const parsed = typeof dish.variants === "string" ? JSON.parse(dish.variants) : dish.variants;
              if (parsed && typeof parsed === "object") {
                if (parsed.hasVariants || (Array.isArray(parsed.attribute1Options) && parsed.attribute1Options.length > 0)) {
                  hasVariants = true;
                  attribute1Name = parsed.attribute1Name || "Presentación";
                  attribute1Options = Array.isArray(parsed.attribute1Options) ? parsed.attribute1Options : [];
                  if (parsed.attribute2Name && Array.isArray(parsed.attribute2Options) && parsed.attribute2Options.length > 0) {
                    attribute2Name = parsed.attribute2Name;
                    attribute2Options = parsed.attribute2Options;
                  }
                } else if (Array.isArray(parsed.tallas) && parsed.tallas.length > 0) {
                  // Compatibilidad para tiendas de ropa que ya tenían tallas guardadas
                  hasVariants = true;
                  attribute1Name = "Talla";
                  attribute1Options = parsed.tallas;
                  if (Array.isArray(parsed.colores) && parsed.colores.length > 0) {
                    attribute2Name = "Color";
                    attribute2Options = parsed.colores;
                  }
                }
              }
            } catch {}
          }

          return {
            id: dish.id,
            name: dish.name,
            description: dish.description || "",
            price: dish.price,
            imageUrl: dish.imageUrl || null,
            hasVariants,
            attribute1Name,
            attribute1Options,
            attribute2Name,
            attribute2Options,
            tallas: attribute1Name === "Talla" ? attribute1Options : [],
            colores: attribute2Name === "Color" ? attribute2Options : [],
            stock: dish.stock !== null ? dish.stock : 10,
            isNew: dish.isSuggested || false,
          };
        }),
      })),
      themeColor: store.themeColor || "#f59e0b",
      specialty: store.specialty || "Tienda Oficial & Catálogo de Productos",
      slogan: store.slogan || "¡Calidad, variedad y los mejores productos para ti!",
      instagram: store.instagram,
      facebook: store.facebook,
      tiktok: store.tiktok,
      whatsappNumber: store.whatsapp,
      ubicameUrl: store.ubicameUrl || "https://ubicame.info",
      reservationUrl: store.reservationUrl,
      googleBusinessUrl: store.googleBusinessUrl,
      locality: store.locality,
      city: store.city,
      province: store.province,
      priceRange: store.priceRange || "$$",
      services: store.services,
      contactNumbers: store.contactNumbers,
      schedule: store.schedule,
      localSchedule: store.localSchedule,
      structuredSchedule: store.structuredSchedule,
      blockedDates: store.blockedDates,
      mapEmbedUrl: store.mapEmbedUrl,
    };

    return <CtaloClient store={formattedStore} />;
  } catch (error) {
    console.error("[CtaloSlugPage Error]:", error);
    const demoStore = getMockDemoStore();
    return <CtaloClient store={demoStore} />;
  }
}
