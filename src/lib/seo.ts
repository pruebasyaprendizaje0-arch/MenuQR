export function normalizeSlug(text: string): string {
  if (!text) return "";
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export function unslugify(slug: string): string {
  if (!slug) return "";
  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "https://menuqr.ubicame.cc";
}

/**
 * Validates and formats image URLs safely for Schema.org JSON-LD structured data.
 * Accepts:
 *  - Full HTTP / HTTPS URLs (e.g., https://example.com/image.jpg)
 *  - Valid relative paths (e.g., /uploads/image.jpg or uploads/image.jpg), converting them to absolute URLs using getBaseUrl()
 * Rejects:
 *  - data: URIs (e.g. data:image/jpeg;base64,...)
 *  - javascript: URIs
 *  - Empty / null / non-string values
 *  - Malformed protocols or invalid formats
 */
export function resolvePublicImageUrl(rawUrl?: string | null): string | undefined {
  if (!rawUrl || typeof rawUrl !== "string") return undefined;
  const trimmed = rawUrl.trim();
  if (!trimmed) return undefined;

  // Reject forbidden protocols / prefixes immediately
  const lower = trimmed.toLowerCase();
  if (lower.startsWith("data:") || lower.startsWith("javascript:") || lower.startsWith("vbscript:")) {
    return undefined;
  }

  // Handle absolute HTTP/HTTPS URLs
  if (lower.startsWith("http://") || lower.startsWith("https://")) {
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        return parsed.toString();
      }
      return undefined;
    } catch {
      return undefined;
    }
  }

  // Handle relative paths (must not contain scheme separators)
  if (trimmed.includes(":") && !trimmed.startsWith("/")) {
    return undefined;
  }

  const baseUrl = getBaseUrl();
  const cleanPath = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return `${baseUrl}${cleanPath}`;
}

const DAY_MAP: Record<string, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
  lunes: "Monday",
  martes: "Tuesday",
  miercoles: "Wednesday",
  jueves: "Thursday",
  viernes: "Friday",
  sabado: "Saturday",
  domingo: "Sunday",
};

interface ScheduleItem {
  dayOfWeek?: string;
  day?: string;
  open?: string;
  opens?: string;
  close?: string;
  closes?: string;
  closed?: boolean;
}

interface SchemaOpeningHoursSpec {
  "@type": "OpeningHoursSpecification";
  dayOfWeek: string;
  opens: string;
  closes: string;
}

export function parseOpeningHoursSpecification(structuredScheduleStr?: string | null): SchemaOpeningHoursSpec[] | undefined {
  if (!structuredScheduleStr) return undefined;
  try {
    const data = typeof structuredScheduleStr === "string" ? JSON.parse(structuredScheduleStr) : structuredScheduleStr;
    const specs: SchemaOpeningHoursSpec[] = [];

    if (Array.isArray(data)) {
      for (const item of data as ScheduleItem[]) {
        if (item.closed) continue;
        const dayKey = String(item.dayOfWeek || item.day || "").toLowerCase();
        const day = DAY_MAP[dayKey] || item.dayOfWeek;
        const opens = item.opens || item.open;
        const closes = item.closes || item.close;
        if (day && opens && closes) {
          specs.push({
            "@type": "OpeningHoursSpecification",
            dayOfWeek: day,
            opens,
            closes,
          });
        }
      }
    } else if (typeof data === "object" && data !== null) {
      for (const [key, val] of Object.entries(data as Record<string, ScheduleItem>)) {
        const day = DAY_MAP[key.toLowerCase()];
        const v = val;
        const opens = v?.open || v?.opens;
        const closes = v?.close || v?.closes;
        if (day && v && !v.closed && opens && closes) {
          specs.push({
            "@type": "OpeningHoursSpecification",
            dayOfWeek: day,
            opens,
            closes,
          });
        }
      }
    }
    return specs.length > 0 ? specs : undefined;
  } catch {
    return undefined;
  }
}

export interface BreadcrumbItem {
  name: string;
  url: string;
}

export function generateBreadcrumbJsonLd(items: BreadcrumbItem[]) {
  const baseUrl = getBaseUrl();
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url.startsWith("http") ? item.url : `${baseUrl}${item.url.startsWith("/") ? "" : "/"}${item.url}`,
    })),
  };
}

export interface RestaurantMinimalData {
  name: string;
  address?: string | null;
  city?: string | null;
  sector?: string | null;
  locality?: string | null;
  province?: string | null;
  country?: string | null;
  postalCode?: string | null;
  specialty?: string | null;
  description?: string | null;
  whatsapp?: string | null;
  schedule?: string | null;
  localSchedule?: string | null;
  deliveryEnabled?: boolean | null;
  deliveryCost?: number | string | null;
  customFaq?: string | unknown[] | null;
  mapEmbedUrl?: string | null;
  googleBusinessUrl?: string | null;
  instagram?: string | null;
  facebook?: string | null;
  tiktok?: string | null;
  ubicameUrl?: string | null;
  logoUrl?: string | null;
  coverUrl?: string | null;
  priceRange?: string | null;
  structuredSchedule?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  slug: string;
  categories?: Array<{
    name: string;
    dishes?: Array<{
      name: string;
      description?: string | null;
      imageUrl?: string | null;
      price?: number | string | null;
      isAvailable?: boolean | null;
    }>;
  }>;
}

export function generateRestaurantFaqs(restaurant: RestaurantMinimalData) {
  const cityOrLocality = restaurant.city || restaurant.sector || restaurant.locality || "Ecuador";
  const faqs = [
    {
      question: `¿Dónde está ubicado ${restaurant.name}?`,
      answer: `${restaurant.name} se encuentra ubicado en ${restaurant.address ? `${restaurant.address}, ` : ""}${cityOrLocality}, Ecuador.${restaurant.mapEmbedUrl || restaurant.googleBusinessUrl ? " Puedes ver su ubicación en Google Maps a través de su menú digital." : ""}`,
    },
    {
      question: `¿Qué tipo de comida ofrece ${restaurant.name}?`,
      answer: `${restaurant.name} se especializa en ${restaurant.specialty || "gastronomía local e internacional"}. ${restaurant.description || "Consulta la carta completa con platillos, bebidas y precios actualizados."}`,
    },
    {
      question: `¿Cómo realizar un pedido en ${restaurant.name}?`,
      answer: `Puedes realizar tu pedido directamente escaneando su código QR o accediendo a su menú digital en MenuQR Pro. Elige tus platillos y envía el pedido formateado con recargos y número de mesa directamente a su WhatsApp ${restaurant.whatsapp ? `(${restaurant.whatsapp})` : ""}.`,
    },
    {
      question: `¿Cuál es el horario de atención de ${restaurant.name}?`,
      answer: restaurant.schedule || restaurant.localSchedule 
        ? `El horario registrado de atención es: ${restaurant.schedule || restaurant.localSchedule}.`
        : `Atiende en horarios habituales en ${cityOrLocality}. Te recomendamos verificar la disponibilidad en su WhatsApp.`,
    },
    {
      question: `¿${restaurant.name} ofrece servicio a domicilio o para llevar?`,
      answer: restaurant.deliveryEnabled 
        ? `Sí, ${restaurant.name} cuenta con servicio a domicilio y pedidos para llevar.${restaurant.deliveryCost ? ` El costo base de entrega es de $${Number(restaurant.deliveryCost).toFixed(2)}.` : ""}`
        : `${restaurant.name} atiende principalmente consumo en local y pedidos para llevar.`,
    },
  ];

  if (restaurant.customFaq) {
    try {
      const custom = typeof restaurant.customFaq === "string" ? JSON.parse(restaurant.customFaq) : restaurant.customFaq;
      if (Array.isArray(custom)) {
        faqs.push(...custom);
      }
    } catch {
      // Ignore JSON parse errors cleanly
    }
  }

  return faqs;
}

export function generateRestaurantJsonLd(restaurant: RestaurantMinimalData) {
  const baseUrl = getBaseUrl();
  const slug = restaurant.slug;
  const siteUrl = `${baseUrl}/${slug}`;
  const cityOrLocality = restaurant.city || restaurant.sector || restaurant.locality || "Ecuador";
  const province = restaurant.province || "Ecuador";

  const categories = restaurant.categories || [];
  const menuSections = categories.map((cat) => ({
    "@type": "MenuSection",
    name: cat.name,
    hasMenuItem: (cat.dishes || []).map((dish) => {
      const dishImage = resolvePublicImageUrl(dish.imageUrl);
      const menuItemObj: Record<string, unknown> = {
        "@type": "MenuItem",
        name: dish.name,
        description: dish.description || `${dish.name} disponible en ${restaurant.name}`,
        offers: {
          "@type": "Offer",
          price: String(dish.price || 0),
          priceCurrency: "USD",
          availability: dish.isAvailable ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
        },
      };

      if (dishImage) {
        menuItemObj.image = dishImage;
      }

      return menuItemObj;
    }),
  }));

  const sameAs: string[] = [];
  if (restaurant.instagram) sameAs.push(restaurant.instagram.startsWith("http") ? restaurant.instagram : `https://instagram.com/${restaurant.instagram.replace("@", "")}`);
  if (restaurant.facebook) sameAs.push(restaurant.facebook.startsWith("http") ? restaurant.facebook : `https://facebook.com/${restaurant.facebook}`);
  if (restaurant.tiktok) sameAs.push(restaurant.tiktok.startsWith("http") ? restaurant.tiktok : `https://tiktok.com/@${restaurant.tiktok.replace("@", "")}`);
  if (restaurant.ubicameUrl) sameAs.push(restaurant.ubicameUrl);
  if (restaurant.googleBusinessUrl && restaurant.googleBusinessUrl.startsWith("http")) {
    sameAs.push(restaurant.googleBusinessUrl);
  }

  interface PostalAddressSchema {
    "@type": "PostalAddress";
    addressLocality: string;
    addressRegion: string;
    addressCountry: string;
    streetAddress?: string;
    postalCode?: string;
  }

  const postalAddress: PostalAddressSchema = {
    "@type": "PostalAddress",
    addressLocality: cityOrLocality,
    addressRegion: province,
    addressCountry: restaurant.country || "EC",
  };
  if (restaurant.address) {
    postalAddress.streetAddress = restaurant.address;
  }
  if (restaurant.postalCode) {
    postalAddress.postalCode = restaurant.postalCode;
  }

  const openingHoursSpec = parseOpeningHoursSpecification(restaurant.structuredSchedule);

  interface GeoCoordinatesSchema {
    "@type": "GeoCoordinates";
    latitude: number;
    longitude: number;
  }

  interface RestaurantGraphItem {
    "@type": string[];
    "@id": string;
    name: string;
    description: string;
    url: string;
    telephone?: string;
    image?: string;
    servesCuisine: string;
    priceRange: string;
    address: PostalAddressSchema;
    openingHoursSpecification?: SchemaOpeningHoursSpec[];
    sameAs?: string[];
    hasMenu: {
      "@type": "Menu";
      name: string;
      url: string;
      hasMenuSection: typeof menuSections;
    };
    geo?: GeoCoordinatesSchema;
  }

  const resolvedMainImage = resolvePublicImageUrl(restaurant.logoUrl) || resolvePublicImageUrl(restaurant.coverUrl);

  const restaurantEntity: RestaurantGraphItem = {
    "@type": ["Restaurant", "LocalBusiness"],
    "@id": `${siteUrl}#restaurant`,
    name: restaurant.name,
    description: restaurant.description || `Menú digital, carta, precios y pedidos por WhatsApp de ${restaurant.name} en ${cityOrLocality}, Ecuador.`,
    url: siteUrl,
    telephone: restaurant.whatsapp ? `+${restaurant.whatsapp.replace(/\D/g, "")}` : undefined,
    servesCuisine: restaurant.specialty || "Gastronomía",
    priceRange: restaurant.priceRange || "$$",
    address: postalAddress,
    openingHoursSpecification: openingHoursSpec,
    sameAs: sameAs.length > 0 ? sameAs : undefined,
    hasMenu: {
      "@type": "Menu",
      name: `Carta Digital de ${restaurant.name}`,
      url: siteUrl,
      hasMenuSection: menuSections,
    },
  };

  if (resolvedMainImage) {
    restaurantEntity.image = resolvedMainImage;
  }

  const latNum = Number(restaurant.latitude);
  const lngNum = Number(restaurant.longitude);
  if (restaurant.latitude !== null && restaurant.latitude !== undefined && restaurant.longitude !== null && restaurant.longitude !== undefined && !isNaN(latNum) && !isNaN(lngNum) && (latNum !== 0 || lngNum !== 0)) {
    restaurantEntity.geo = {
      "@type": "GeoCoordinates",
      latitude: latNum,
      longitude: lngNum,
    };
  }

  const graphList: unknown[] = [restaurantEntity];

  // FAQs
  const faqs = generateRestaurantFaqs(restaurant);
  graphList.push({
    "@type": "FAQPage",
    "@id": `${siteUrl}#faq`,
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  });

  // Breadcrumbs
  const breadcrumbItems: BreadcrumbItem[] = [
    { name: "Inicio", url: "/" },
    { name: "Restaurantes", url: "/restaurantes" },
  ];
  if (restaurant.province) {
    breadcrumbItems.push({
      name: restaurant.province,
      url: `/restaurantes/${normalizeSlug(restaurant.province)}`,
    });
  }
  if (cityOrLocality) {
    const provSlug = restaurant.province ? normalizeSlug(restaurant.province) : "ecuador";
    breadcrumbItems.push({
      name: cityOrLocality,
      url: `/restaurantes/${provSlug}/${normalizeSlug(cityOrLocality)}`,
    });
  }
  breadcrumbItems.push({ name: restaurant.name, url: `/${slug}` });

  graphList.push(generateBreadcrumbJsonLd(breadcrumbItems));

  return {
    "@context": "https://schema.org",
    "@graph": graphList,
  };
}

export function generateCityCategoryJsonLd(
  cityName: string,
  categoryName: string | null,
  restaurants: Array<{ slug: string; name: string; description?: string | null }>
) {
  const baseUrl = getBaseUrl();
  const title = categoryName 
    ? `Restaurantes de ${categoryName} en ${cityName}` 
    : `Restaurantes y Menús Digitales en ${cityName}`;

  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: title,
    itemListElement: restaurants.map((r, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: `${baseUrl}/${r.slug}`,
      name: r.name,
      description: r.description || `Menú digital de ${r.name} en ${cityName}`,
    })),
  };

  return itemList;
}
