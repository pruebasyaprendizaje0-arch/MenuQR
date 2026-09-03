export interface ProfileCompletenessReport {
  overallScore: number;
  identityScore: number;
  locationScore: number;
  contactScore: number;
  menuScore: number;
  seoScore: number;
  missingFields: string[];
}

export function calculateRestaurantCompleteness(restaurant: any): ProfileCompletenessReport {
  const missingFields: string[] = [];

  // 1. Identity (20%)
  let identityCount = 0;
  if (restaurant.name) identityCount++; else missingFields.push("Nombre del local");
  if (restaurant.slug) identityCount++; else missingFields.push("Slug / URL");
  if (restaurant.description) identityCount++; else missingFields.push("Descripción del negocio");
  if (restaurant.logoUrl) identityCount++; else missingFields.push("Logo");
  if (restaurant.coverUrl) identityCount++; else missingFields.push("Imagen de portada");
  const identityScore = Math.round((identityCount / 5) * 20);

  // 2. Location & GEO (25%)
  let locationCount = 0;
  if (restaurant.address) locationCount++; else missingFields.push("Dirección de calle");
  if (restaurant.locality || restaurant.city) locationCount++; else missingFields.push("Ciudad / Cantón");
  if (restaurant.province) locationCount++; else missingFields.push("Provincia");
  if (restaurant.latitude && restaurant.longitude) locationCount++; else missingFields.push("Coordenadas GPS (Latitud/Longitud)");
  const locationScore = Math.round((locationCount / 4) * 25);

  // 3. Contact & Schedule (20%)
  let contactCount = 0;
  if (restaurant.whatsapp) contactCount++; else missingFields.push("Número de WhatsApp");
  if (restaurant.schedule || restaurant.localSchedule) contactCount++; else missingFields.push("Horario de atención");
  if (restaurant.services) contactCount++; else missingFields.push("Servicios del establecimiento");
  const contactScore = Math.round((contactCount / 3) * 20);

  // 4. Menu & Dishes (20%)
  let menuCount = 0;
  const categories = restaurant.categories || [];
  const totalDishes = categories.reduce((acc: number, cat: any) => acc + (cat.dishes ? cat.dishes.length : 0), 0);
  if (categories.length > 0) menuCount++; else missingFields.push("Al menos 1 categoría de menú");
  if (totalDishes > 0) menuCount++; else missingFields.push("Al menos 1 plato registrado");
  if (totalDishes >= 5) menuCount++;
  const menuScore = Math.round((menuCount / 3) * 20);

  // 5. SEO Metadata (15%)
  let seoCount = 0;
  if (restaurant.seoTitle) seoCount++; else missingFields.push("Meta Título SEO personalizado");
  if (restaurant.seoDescription) seoCount++; else missingFields.push("Meta Descripción SEO personalizada");
  if (restaurant.seoKeywords) seoCount++; else missingFields.push("Palabras clave SEO");
  const seoScore = Math.round((seoCount / 3) * 15);

  const overallScore = identityScore + locationScore + contactScore + menuScore + seoScore;

  return {
    overallScore,
    identityScore,
    locationScore,
    contactScore,
    menuScore,
    seoScore,
    missingFields,
  };
}
