import { ecuadorData, parishData, communeData } from "./ecuador";

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
  return process.env.NEXT_PUBLIC_APP_URL || "https://menuqr.ubicame.cc";
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
    "itemListElement": items.map((item, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "name": item.name,
      "item": item.url.startsWith("http") ? item.url : `${baseUrl}${item.url.startsWith("/") ? "" : "/"}${item.url}`,
    })),
  };
}

export function generateRestaurantFaqs(restaurant: any) {
  const cityOrLocality = restaurant.city || restaurant.sector || restaurant.locality || "Ecuador";
  const faqs = [
    {
      question: `¿Dónde está ubicado ${restaurant.name}?`,
      answer: `${restaurant.name} se encuentra ubicado en ${restaurant.address ? `${restaurant.address}, ` : ""}${cityOrLocality}, Ecuador.${restaurant.mapEmbedUrl ? " Puedes ver su ubicación en Google Maps a través de su menú digital." : ""}`,
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

export function generateRestaurantJsonLd(restaurant: any) {
  const baseUrl = getBaseUrl();
  const slug = restaurant.slug;
  const siteUrl = `${baseUrl}/${slug}`;
  const cityOrLocality = restaurant.city || restaurant.sector || restaurant.locality || "Ecuador";
  const province = restaurant.province || "Ecuador";

  const categories = restaurant.categories || [];
  const menuSections = categories.map((cat: any) => ({
    "@type": "MenuSection",
    "name": cat.name,
    "hasMenuItem": (cat.dishes || []).map((dish: any) => ({
      "@type": "MenuItem",
      "name": dish.name,
      "description": dish.description || `${dish.name} disponible en ${restaurant.name}`,
      "image": dish.imageUrl?.startsWith("http") 
        ? dish.imageUrl 
        : dish.imageUrl 
          ? `${baseUrl}${dish.imageUrl}` 
          : undefined,
      "offers": {
        "@type": "Offer",
        "price": String(dish.price || 0),
        "priceCurrency": "USD",
        "availability": dish.isAvailable ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      },
    })),
  }));

  const sameAs: string[] = [];
  if (restaurant.instagram) sameAs.push(restaurant.instagram.startsWith("http") ? restaurant.instagram : `https://instagram.com/${restaurant.instagram.replace("@", "")}`);
  if (restaurant.facebook) sameAs.push(restaurant.facebook.startsWith("http") ? restaurant.facebook : `https://facebook.com/${restaurant.facebook}`);
  if (restaurant.tiktok) sameAs.push(restaurant.tiktok.startsWith("http") ? restaurant.tiktok : `https://tiktok.com/@${restaurant.tiktok.replace("@", "")}`);
  if (restaurant.ubicameUrl) sameAs.push(restaurant.ubicameUrl);

  const postalAddress: any = {
    "@type": "PostalAddress",
    "addressLocality": cityOrLocality,
    "addressRegion": province,
    "addressCountry": "EC",
  };
  if (restaurant.address) {
    postalAddress.streetAddress = restaurant.address;
  }

  const schema: any = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": ["Restaurant", "LocalBusiness"],
        "@id": `${siteUrl}#restaurant`,
        "name": restaurant.name,
        "description": restaurant.description || `Menú digital, carta, precios y pedidos por WhatsApp de ${restaurant.name} en ${cityOrLocality}, Ecuador.`,
        "url": siteUrl,
        "telephone": restaurant.whatsapp ? `+${restaurant.whatsapp.replace(/\D/g, "")}` : undefined,
        "image": restaurant.logoUrl ? (restaurant.logoUrl.startsWith("http") ? restaurant.logoUrl : `${baseUrl}${restaurant.logoUrl}`) : `${baseUrl}/icon.png`,
        "servesCuisine": restaurant.specialty || "Gastronomía",
        "priceRange": "$$",
        "address": postalAddress,
        "sameAs": sameAs.length > 0 ? sameAs : undefined,
        "hasMenu": {
          "@type": "Menu",
          "name": `Carta Digital de ${restaurant.name}`,
          "url": siteUrl,
          "hasMenuSection": menuSections,
        },
      },
    ],
  };

  const latNum = Number(restaurant.latitude);
  const lngNum = Number(restaurant.longitude);
  if (restaurant.latitude !== null && restaurant.latitude !== undefined && restaurant.longitude !== null && restaurant.longitude !== undefined && !isNaN(latNum) && !isNaN(lngNum) && (latNum !== 0 || lngNum !== 0)) {
    schema["@graph"][0].geo = {
      "@type": "GeoCoordinates",
      "latitude": latNum,
      "longitude": lngNum,
    };
  }

  // FAQs
  const faqs = generateRestaurantFaqs(restaurant);
  schema["@graph"].push({
    "@type": "FAQPage",
    "@id": `${siteUrl}#faq`,
    "mainEntity": faqs.map((faq) => ({
      "@type": "Question",
      "name": faq.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": faq.answer,
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

  schema["@graph"].push(generateBreadcrumbJsonLd(breadcrumbItems));

  return schema;
}

export function generateCityCategoryJsonLd(
  cityName: string,
  categoryName: string | null,
  restaurants: any[]
) {
  const baseUrl = getBaseUrl();
  const title = categoryName 
    ? `Restaurantes de ${categoryName} en ${cityName}` 
    : `Restaurantes y Menús Digitales en ${cityName}`;

  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": title,
    "itemListElement": restaurants.map((r, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "url": `${baseUrl}/${r.slug}`,
      "name": r.name,
      "description": r.description || `Menú digital de ${r.name} en ${cityName}`,
    })),
  };

  return itemList;
}
