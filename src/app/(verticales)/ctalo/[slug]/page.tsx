import React from "react";
import { prisma } from "@/lib/db";
import { findRestaurantBySlugOrHistory, sanitizeSlug } from "@/lib/slugs";
import type { Metadata } from "next";
import { CtaloClient } from "./components/CtaloClient";
import { redirect } from "next/navigation";
import { getBusinessLabels } from "@/lib/business-labels";
import Link from "next/link";
import { ShoppingBag, ArrowLeft, Store } from "lucide-react";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{
    slug: string;
  }>;
}

export async function generateMetadata({ params: paramsPromise }: PageProps): Promise<Metadata> {
  const params = await paramsPromise;
  let decodedSlug = params.slug;
  try {
    decodedSlug = decodeURIComponent(params.slug);
  } catch {}
  const rawSlug = decodedSlug.toLowerCase().trim();
  const cleanSlug = sanitizeSlug(decodedSlug);

  if (rawSlug === "demo" || cleanSlug === "demo") {
    return {
      title: "Catálogo Demo | Boutique & Calzado Pro",
      description: "Catálogo interactivo con variantes de tallas, colores y carrito de compras para WhatsApp.",
    };
  }

  try {
    const store = await prisma.restaurant.findFirst({
      where: {
        OR: [
          { slug: cleanSlug },
          { slug: rawSlug },
        ],
      },
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

// Datos demo EXCLUSIVOS si se solicita /ctalo/demo de forma explícita
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
  let decodedSlug = params.slug;
  try {
    decodedSlug = decodeURIComponent(params.slug);
  } catch {}
  const rawSlug = decodedSlug.toLowerCase().trim();
  const cleanSlug = sanitizeSlug(decodedSlug);

  // Modo demo oficial
  if (rawSlug === "demo" || cleanSlug === "demo") {
    const demoStore = getMockDemoStore();
    return <CtaloClient store={demoStore} />;
  }

  try {
    const slugCheck = await findRestaurantBySlugOrHistory(decodedSlug);
    if (slugCheck.isRedirect && slugCheck.targetSlug) {
      redirect(`/ctalo/${slugCheck.targetSlug}`);
    }
    const realSlug = slugCheck.restaurant?.slug || cleanSlug;

    let store = await prisma.restaurant.findFirst({
      where: {
        OR: [
          { slug: realSlug },
          { slug: cleanSlug },
          { slug: rawSlug },
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
        campaigns: {
          where: {
            isActive: true,
            OR: [
              { endDate: null },
              { endDate: { gte: new Date() } },
            ],
          },
          include: {
            dishes: {
              include: {
                dish: {
                  select: {
                    id: true,
                    name: true,
                    price: true,
                    imageUrl: true,
                    isAvailable: true,
                  },
                },
              },
            },
          },
          orderBy: [{ order: "asc" }, { createdAt: "desc" }],
        },
      },
    });

    if (!store && decodedSlug) {
      store = await prisma.restaurant.findFirst({
        where: {
          OR: [
            { slug: { contains: cleanSlug } },
            { name: { contains: decodedSlug, mode: "insensitive" } },
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
          campaigns: {
            where: {
              isActive: true,
              OR: [
                { endDate: null },
                { endDate: { gte: new Date() } },
              ],
            },
            include: {
              dishes: {
                include: {
                  dish: {
                    select: {
                      id: true,
                      name: true,
                      price: true,
                      imageUrl: true,
                      isAvailable: true,
                    },
                  },
                },
              },
            },
            orderBy: [{ order: "asc" }, { createdAt: "desc" }],
          },
        },
      });
    }

    if (!store) {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-6 text-center relative overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] h-[340px] bg-amber-500/10 rounded-full blur-[120px] pointer-events-none"></div>
          <div className="relative z-10 max-w-md space-y-6">
            <div className="h-16 w-16 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-center mx-auto text-amber-400 shadow-xl">
              <ShoppingBag className="h-8 w-8" />
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl font-extrabold tracking-tight text-white">Catálogo no encontrado</h1>
              <p className="text-slate-400 text-sm">
                El catálogo comercial <code className="text-amber-300 bg-slate-900 px-1.5 py-0.5 rounded font-mono">/{decodedSlug}</code> no existe o su enlace fue actualizado.
              </p>
            </div>
            <div className="pt-4 flex flex-col gap-2.5">
              <Link href="/catalogos" className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-sm shadow-lg transition-all">
                Explorar Catálogos y Tiendas
              </Link>
              <Link href="/admin" className="px-6 py-3 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-850 text-slate-300 font-semibold text-sm transition-all">
                Ingresar al Panel Administrativo
              </Link>
            </div>
          </div>
        </div>
      );
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
      deunaPhone: (store as any).deunaPhone || null,
      payphoneUrl: (store as any).payphoneUrl || null,
      payphonePhone: (store as any).payphonePhone || null,
      payphoneQrUrl: (store as any).payphoneQrUrl || null,
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
            stock: typeof dish.stock === "number" ? dish.stock : 0,
            isAvailable: dish.isAvailable && (typeof dish.stock !== "number" || dish.stock > 0),
            trackStock: dish.trackStock,
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
      campaigns: ((store as any).campaigns || []).map((camp: any) => ({
        ...camp,
        startDate: camp.startDate ? camp.startDate.toISOString() : null,
        endDate: camp.endDate ? camp.endDate.toISOString() : null,
        eventDate: camp.eventDate ? camp.eventDate.toISOString() : null,
        createdAt: camp.createdAt.toISOString(),
        updatedAt: camp.updatedAt.toISOString(),
        dishes: (camp.dishes || []).map((cd: any) => ({
          ...cd,
          createdAt: cd.createdAt.toISOString(),
          dish: cd.dish,
        })),
      })),
    };

    return <CtaloClient store={formattedStore} />;
  } catch (error) {
    console.error("[CtaloSlugPage Error]:", error);
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-6 text-center relative overflow-hidden">
        <div className="relative z-10 max-w-md space-y-4">
          <div className="h-14 w-14 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-center mx-auto text-amber-400 shadow-xl">
            <ShoppingBag className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold text-white">Error al cargar el catálogo</h1>
          <p className="text-slate-400 text-xs">
            Ocurrió un problema momentáneo al cargar los productos de esta tienda. Por favor intenta recargar.
          </p>
          <div className="pt-2">
            <Link href="/catalogos" className="inline-block px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg transition-all">
              Volver al Directorio de Catálogos
            </Link>
          </div>
        </div>
      </div>
    );
  }
}
