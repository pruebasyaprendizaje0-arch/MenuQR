import { prisma } from "@/lib/db";
import { resolveBusinessVertical, BusinessVertical } from "@/lib/business-labels";

export type MarketplaceVertical = "restaurante" | "retail" | "servicios" | "citas" | "reservas";

export interface MarketplaceItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  isSuggested: boolean;
  isPopular: boolean;
  orderCount?: number;
  categoryName?: string;
  badge?: string;
  restaurant: {
    id: string;
    name: string;
    slug: string;
    city: string | null;
    province: string | null;
    logoUrl: string | null;
    themeColor: string;
    whatsapp: string;
    specialty?: string | null;
  };
  targetUrl: string;
}

export interface MarketplaceData {
  vertical: MarketplaceVertical;
  title: string;
  subtitle: string;
  badgeText: string;
  accentColor: "red" | "amber" | "cyan" | "purple" | "emerald";
  items: MarketplaceItem[];
  cities: string[];
}

// Fallbacks de alta estética para que ninguna vertical se vea vacía en demostraciones
const CURATED_VERTICAL_DEFAULTS: Record<MarketplaceVertical, MarketplaceItem[]> = {
  restaurante: [
    {
      id: "demo-rest-1",
      name: "Hamburguesa Gourmet Doble Queso & Tocino",
      description: "Carne angus seleccionada, queso cheddar fundido, tocino crocante y salsa ahumada artesanal.",
      price: 9.5,
      imageUrl: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&auto=format&fit=crop&q=80",
      isSuggested: true,
      isPopular: true,
      orderCount: 42,
      categoryName: "Hamburguesas",
      badge: "🔥 Top Ventas",
      restaurant: {
        id: "demo-r1",
        name: "Burger Craft Co.",
        slug: "las-empanadas-de-mauro",
        city: "Quito",
        province: "Pichincha",
        logoUrl: null,
        themeColor: "#ef4444",
        whatsapp: "593999999999",
        specialty: "Hamburguesas & Grill",
      },
      targetUrl: "/las-empanadas-de-mauro",
    },
    {
      id: "demo-rest-2",
      name: "Ramen Tradicional Shoyu con Chashu",
      description: "Caldo cocinado a fuego lento por 12 horas, fideos artesanales, huevo marinado ajitama y alga nori.",
      price: 11.0,
      imageUrl: "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=600&auto=format&fit=crop&q=80",
      isSuggested: true,
      isPopular: false,
      categoryName: "Cocina Asiática",
      badge: "⭐ Sugerencia Chef",
      restaurant: {
        id: "demo-r2",
        name: "Tokyo Noodle Bar",
        slug: "mamma-mia",
        city: "Guayaquil",
        province: "Guayas",
        logoUrl: null,
        themeColor: "#f97316",
        whatsapp: "593999999999",
        specialty: "Ramen & Bowls",
      },
      targetUrl: "/mamma-mia",
    },
  ],
  retail: [
    {
      id: "demo-ret-1",
      name: "Sneakers Streetwear Urban Style",
      description: "Calzado deportivo urbano con amortiguación premium, disponible en tallas 38 a 43.",
      price: 49.99,
      imageUrl: "https://images.unsplash.com/photo-1552346154-21d32810aba3?w=600&auto=format&fit=crop&q=80",
      isSuggested: true,
      isPopular: true,
      categoryName: "Calzado",
      badge: "🔥 Tendencia",
      restaurant: {
        id: "demo-ret-1",
        name: "Urban Kicks Store",
        slug: "sumeria-liquors",
        city: "Guayaquil",
        province: "Guayas",
        logoUrl: null,
        themeColor: "#f59e0b",
        whatsapp: "593999999999",
        specialty: "Sneakers & Moda",
      },
      targetUrl: "/ctalo/sumeria-liquors",
    },
    {
      id: "demo-ret-2",
      name: "Chaqueta Denim Oversized Vintage",
      description: "Denim 100% algodón resistente, lavado especial vintage y botones metálicos reforzados.",
      price: 38.5,
      imageUrl: "https://images.unsplash.com/photo-1576995853123-5a10305d93c0?w=600&auto=format&fit=crop&q=80",
      isSuggested: true,
      isPopular: false,
      categoryName: "Ropa",
      badge: "⭐ Más Deseado",
      restaurant: {
        id: "demo-ret-2",
        name: "Vintage Aura Boutique",
        slug: "sumeria-liquors",
        city: "Quito",
        province: "Pichincha",
        logoUrl: null,
        themeColor: "#eab308",
        whatsapp: "593999999999",
        specialty: "Moda & Accesorios",
      },
      targetUrl: "/ctalo/sumeria-liquors",
    },
  ],
  servicios: [
    {
      id: "demo-serv-1",
      name: "Reparación y Mantenimiento de Calefones a Gas",
      description: "Diagnóstico express, limpieza de inyectores, cambio de diafragma y chequeo de fugas con GPS directo.",
      price: 35.0,
      imageUrl: "https://images.unsplash.com/photo-1581244277943-fe4a9c777189?w=600&auto=format&fit=crop&q=80",
      isSuggested: true,
      isPopular: true,
      categoryName: "Gasfitería & Plomería",
      badge: "⚡ Servicio Urgente",
      restaurant: {
        id: "demo-s1",
        name: "Técnicos 24/7 Ecuador",
        slug: "clinica-santa-lucia",
        city: "Quito",
        province: "Pichincha",
        logoUrl: null,
        themeColor: "#06b6d4",
        whatsapp: "593999999999",
        specialty: "Plomería y Gas",
      },
      targetUrl: "/servicios/clinica-santa-lucia",
    },
    {
      id: "demo-serv-2",
      name: "Instalación y Mantenimiento de Aire Acondicionado Split",
      description: "Carga de refrigerante ecológico, desinfección antibacteriana de turbina y pruebas de termostato.",
      price: 45.0,
      imageUrl: "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=600&auto=format&fit=crop&q=80",
      isSuggested: true,
      isPopular: false,
      categoryName: "Climatización",
      badge: "⭐ Cotización Express",
      restaurant: {
        id: "demo-s2",
        name: "ClimaTech Express",
        slug: "clinica-santa-lucia",
        city: "Guayaquil",
        province: "Guayas",
        logoUrl: null,
        themeColor: "#0ea5e9",
        whatsapp: "593999999999",
        specialty: "Climatización Residencial",
      },
      targetUrl: "/servicios/clinica-santa-lucia",
    },
  ],
  citas: [
    {
      id: "demo-citas-1",
      name: "Corte de Cabello Signature + Perfilado de Barba & Toalla Caliente",
      description: "Asesoría de imagen personalizada, degradado fade a navaja, exfoliación facial y bálsamo hidratante.",
      price: 15.0,
      imageUrl: "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=600&auto=format&fit=crop&q=80",
      isSuggested: true,
      isPopular: true,
      categoryName: "Barbería & Grooming",
      badge: "🔥 Turno Más Pedido",
      restaurant: {
        id: "demo-c1",
        name: "Royal Barber Club",
        slug: "sonrisas-del-mar",
        city: "Cuenca",
        province: "Azuay",
        logoUrl: null,
        themeColor: "#a855f7",
        whatsapp: "593999999999",
        specialty: "Barbería Premium",
      },
      targetUrl: "/citas/sonrisas-del-mar",
    },
    {
      id: "demo-citas-2",
      name: "Limpieza Dental Ultrasónica & Profilaxis Completa",
      description: "Remoción de cálculo dental con ultrasonido, pulido con pasta fluorada y valoración preventiva con cámara intraoral.",
      price: 25.0,
      imageUrl: "https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=600&auto=format&fit=crop&q=80",
      isSuggested: true,
      isPopular: false,
      categoryName: "Odontología",
      badge: "⭐ Cita Recomendada",
      restaurant: {
        id: "demo-c2",
        name: "Centro Dental Sonrisas",
        slug: "sonrisas-del-mar",
        city: "Manta",
        province: "Manabí",
        logoUrl: null,
        themeColor: "#8b5cf6",
        whatsapp: "593999999999",
        specialty: "Salud Dental",
      },
      targetUrl: "/citas/sonrisas-del-mar",
    },
  ],
  reservas: [
    {
      id: "demo-res-1",
      name: "Cabaña Panorámica con Jacuzzi Climatizado & Vista al Bosque",
      description: "Alojamiento exclusivo para parejas, cama king size, fogata exterior, desayuno artesanal incluido y check-in directo.",
      price: 85.0,
      imageUrl: "https://images.unsplash.com/photo-1587061949409-02df41d5e562?w=600&auto=format&fit=crop&q=80",
      isSuggested: true,
      isPopular: true,
      categoryName: "Cabañas de Montaña",
      badge: "🔥 Hospedaje Estrella",
      restaurant: {
        id: "demo-h1",
        name: "Glamping Bosque Nuboso",
        slug: "hostal-roses",
        city: "Baños de Agua Santa",
        province: "Tungurahua",
        logoUrl: null,
        themeColor: "#10b981",
        whatsapp: "593999999999",
        specialty: "Glamping & Hospedaje",
      },
      targetUrl: "/reservas/hostal-roses",
    },
    {
      id: "demo-res-2",
      name: "Suite Frente al Mar con Balcón Privado & Puesta de Sol",
      description: "Habitación frente al océano pacífico con aire acondicionado, Wi-Fi satelital de alta velocidad y acceso a piscina infinity.",
      price: 65.0,
      imageUrl: "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=600&auto=format&fit=crop&q=80",
      isSuggested: true,
      isPopular: false,
      categoryName: "Suites de Playa",
      badge: "⭐ Escapada Recomendada",
      restaurant: {
        id: "demo-h2",
        name: "Hostal Playa Serena",
        slug: "hostal-roses",
        city: "Santa Elena",
        province: "Santa Elena",
        logoUrl: null,
        themeColor: "#14b8a6",
        whatsapp: "593999999999",
        specialty: "Hostal & Descanso",
      },
      targetUrl: "/reservas/hostal-roses",
    },
  ],
};

const METADATA_CONFIG: Record<
  MarketplaceVertical,
  {
    title: string;
    subtitle: string;
    badgeText: string;
    accentColor: "red" | "amber" | "cyan" | "purple" | "emerald";
  }
> = {
  restaurante: {
    title: "Platos Populares & Recomendados del Chef",
    subtitle: "Explora las especialidades más ordenadas de restaurantes en Ecuador con entrega directa y cero comisiones.",
    badgeText: "Vitrina Gastronómica en Vivo",
    accentColor: "red",
  },
  retail: {
    title: "Productos Sugeridos & Tendencias de Nuestras Tiendas",
    subtitle: "Descubre prendas, calzado y accesorios destacados de boutiques locales con pedidos directos a WhatsApp.",
    badgeText: "Marketplace E-Commerce Local",
    accentColor: "amber",
  },
  servicios: {
    title: "Servicios Técnicos Más Solicitados en Ecuador",
    subtitle: "Encuentra técnicos calificados para averías urgentes con cotización express por fotos y GPS.",
    badgeText: "Directorio de Especialistas",
    accentColor: "cyan",
  },
  citas: {
    title: "Tratamientos & Especialistas Destacados",
    subtitle: "Reserva turnos para cortes de cabello, barbería, estética dental y bienestar sin llamadas telefónicas.",
    badgeText: "Agenda de Citas en Vivo",
    accentColor: "purple",
  },
  reservas: {
    title: "Cabañas, Glampings & Hospedajes Recomendados",
    subtitle: "Alojamientos directos para tus vacaciones o escapadas de fin de semana sin pagar el 20% de comisión de Airbnb.",
    badgeText: "Motor de Reservas Directas",
    accentColor: "emerald",
  },
};

export async function getVerticalMarketplaceData(
  vertical: MarketplaceVertical
): Promise<MarketplaceData> {
  const config = METADATA_CONFIG[vertical];

  try {
    // 1. Obtener los nombres de platos/productos más ordenados en el sistema para calcular popularidad real
    const popularOrders = await prisma.orderItem.groupBy({
      by: ["dishName"],
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 40,
    });

    const popularMap = new Map<string, number>();
    popularOrders.forEach((o) => {
      popularMap.set(o.dishName.toLowerCase().trim(), o._sum.quantity || 0);
    });

    // 2. Consultar negocios activos
    const restaurants = await prisma.restaurant.findMany({
      where: {
        isSuspended: false,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        city: true,
        province: true,
        businessType: true,
        logoUrl: true,
        themeColor: true,
        whatsapp: true,
        specialty: true,
        description: true,
        customLabels: true,
        categories: {
          select: {
            id: true,
            name: true,
            dishes: {
              where: {
                isAvailable: true,
              },
              select: {
                id: true,
                name: true,
                description: true,
                price: true,
                imageUrl: true,
                isSuggested: true,
                categoryId: true,
              },
            },
          },
        },
      },
    });

    // 3. Filtrar negocios que corresponden a la vertical solicitada
    const targetRestaurants = restaurants.filter((r) => {
      const resolved = resolveBusinessVertical(r as any);
      if (vertical === "restaurante") {
        return resolved === "restaurante" || r.businessType === "RESTAURANT";
      }
      if (vertical === "retail") {
        return resolved === "retail" || r.businessType === "RETAIL" || r.businessType === "GENERAL_CATALOG";
      }
      if (vertical === "servicios") {
        return resolved === "servicios";
      }
      if (vertical === "citas") {
        return resolved === "citas";
      }
      if (vertical === "reservas") {
        return resolved === "reservas";
      }
      return false;
    });

    // 4. Mapear los platos/servicios de esos negocios
    const items: MarketplaceItem[] = [];
    const citiesSet = new Set<string>();

    for (const r of targetRestaurants) {
      if (r.city && r.city.trim()) {
        citiesSet.add(r.city.trim());
      }

      // Determinar la URL destino según la vertical
      let targetUrl = `/${r.slug}`;
      if (vertical === "retail") targetUrl = `/ctalo/${r.slug}`;
      else if (vertical === "servicios") targetUrl = `/servicios/${r.slug}`;
      else if (vertical === "citas") targetUrl = `/citas/${r.slug}`;
      else if (vertical === "reservas") targetUrl = `/reservas/${r.slug}`;

      for (const cat of r.categories) {
        for (const dish of cat.dishes) {
          const cleanName = dish.name.toLowerCase().trim();
          const orderQty = popularMap.get(cleanName) || 0;
          const isPop = orderQty >= 2;

          let badge: string | undefined = undefined;
          if (dish.isSuggested && isPop) {
            badge = "🔥 Top Sugerido";
          } else if (dish.isSuggested) {
            badge = vertical === "restaurante" ? "⭐ Recomendado del Chef" : "⭐ Producto Sugerido";
          } else if (isPop) {
            badge = `🔥 Top Ventas (${orderQty} pedidos)`;
          }

          items.push({
            id: dish.id,
            name: dish.name,
            description: dish.description,
            price: Number(dish.price),
            imageUrl: dish.imageUrl,
            isSuggested: dish.isSuggested,
            isPopular: isPop,
            orderCount: orderQty,
            categoryName: cat.name,
            badge,
            restaurant: {
              id: r.id,
              name: r.name,
              slug: r.slug,
              city: r.city,
              province: r.province,
              logoUrl: r.logoUrl,
              themeColor: r.themeColor || "#ef4444",
              whatsapp: r.whatsapp,
              specialty: r.specialty,
            },
            targetUrl: `${targetUrl}?item=${encodeURIComponent(dish.id)}`,
          });
        }
      }
    }

    // Ordenar con prioridad:
    // 1. Sugeridos o Populares primero
    // 2. Con fotos primero
    // 3. Mayor cantidad de pedidos
    items.sort((a, b) => {
      const aScore = (a.isSuggested ? 10 : 0) + (a.isPopular ? 8 : 0) + (a.imageUrl ? 5 : 0) + (a.orderCount || 0);
      const bScore = (b.isSuggested ? 10 : 0) + (b.isPopular ? 8 : 0) + (b.imageUrl ? 5 : 0) + (b.orderCount || 0);
      return bScore - aScore;
    });

    // 5. Si la vertical tiene pocos items reales registrados, mezclar de forma armónica los templates destacados
    const curatedDefaults = CURATED_VERTICAL_DEFAULTS[vertical] || [];
    if (items.length < 6) {
      for (const def of curatedDefaults) {
        if (!items.some((i) => i.name.toLowerCase() === def.name.toLowerCase())) {
          items.push(def);
          if (def.restaurant.city) citiesSet.add(def.restaurant.city);
        }
      }
    }

    return {
      vertical,
      title: config.title,
      subtitle: config.subtitle,
      badgeText: config.badgeText,
      accentColor: config.accentColor,
      items,
      cities: Array.from(citiesSet).sort(),
    };
  } catch (error) {
    console.error(`Error en getVerticalMarketplaceData (${vertical}):`, error);
    return {
      vertical,
      title: config.title,
      subtitle: config.subtitle,
      badgeText: config.badgeText,
      accentColor: config.accentColor,
      items: CURATED_VERTICAL_DEFAULTS[vertical] || [],
      cities: ["Quito", "Guayaquil", "Cuenca", "Manta", "Santa Elena"],
    };
  }
}
