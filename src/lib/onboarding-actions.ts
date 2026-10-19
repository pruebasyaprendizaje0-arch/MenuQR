"use server";

import { getUserSession, setUserSession } from "@/lib/auth";
import { prismaTenant } from "@/lib/db";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export async function createGoogleBusinessAction(prevState: unknown, formData: FormData) {
  const session = await getUserSession();
  if (!session || !session.userId) {
    return { error: "Tu sesión ha expirado o no es válida. Por favor inicia sesión con Google nuevamente." };
  }

  const restaurantName = (formData.get("restaurantName") as string)?.trim();
  const businessTypeInput = ((formData.get("businessType") as string) || "RESTAURANT").toUpperCase();
  const province = (formData.get("province") as string)?.trim();
  const canton = (formData.get("canton") as string)?.trim();
  const parroquia = (formData.get("parroquia") as string)?.trim() || "";
  const sector = (formData.get("sector") as string)?.trim() || "";

  if (!restaurantName) {
    return { error: "Por favor ingresa el nombre de tu negocio o tienda." };
  }
  if (!province || !canton) {
    return { error: "Por favor selecciona la provincia y cantón de tu negocio." };
  }

  // Generar slug limpio y único
  let baseSlug = restaurantName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

  if (!baseSlug) baseSlug = "mi-negocio";

  let cleanSlug = baseSlug;
  let isSlugTaken = true;
  let attempt = 0;

  while (isSlugTaken) {
    const existingRestaurant = await prismaTenant.restaurant.findUnique({
      where: { slug: cleanSlug },
    });
    if (!existingRestaurant) {
      isSlugTaken = false;
    } else {
      attempt++;
      cleanSlug = `${baseSlug}-${attempt}`;
    }
  }

  const trialEndsAt = new Date();
  trialEndsAt.setMonth(trialEndsAt.getMonth() + 1);

  let businessType: "RESTAURANT" | "RETAIL" | "SERVICES" | "GENERAL_CATALOG" = "RESTAURANT";
  if (businessTypeInput === "RETAIL" || businessTypeInput === "GENERAL_CATALOG" || businessTypeInput === "CATALOG") {
    businessType = "RETAIL";
  } else if (["SERVICES", "CITAS", "RESERVAS"].includes(businessTypeInput)) {
    businessType = "SERVICES";
  }

  const catalogMode = businessType === "RESTAURANT" ? "MENU" : "CATALOG";
  const enableTableOrdering = businessType === "RESTAURANT";

  let customLabelsInitial: string | null = null;
  if (businessTypeInput === "RESERVAS") {
    customLabelsInitial = JSON.stringify({
      vertical: "reservas",
      businessSubType: "RESERVAS",
      items: "Cabañas / Habitaciones",
      itemSingle: "Cabaña",
      categories: "Tipos de Alojamiento",
      amenities: [
        "📶 WiFi de Alta Velocidad",
        "🔥 Chimenea / Fogata a Leña",
        "🛁 Jacuzzi Privado",
        "🚗 Parqueadero Gratuito",
        "🐾 Pet Friendly",
        "☕ Desayuno Artesanal",
      ],
      availableExtras: [
        { id: "ext-1", name: "Desayuno Campestre Tradicional", price: 6.5, perPerson: true },
        { id: "ext-2", name: "Cesta de Leña Seca para Fogata", price: 5.0, perPerson: false },
        { id: "ext-3", name: "Sesión Privada de Jacuzzi con Sales", price: 20.0, perPerson: false },
        { id: "ext-4", name: "Paseo a Caballo Guiado (1 hora)", price: 15.0, perPerson: true },
      ],
    });
  } else if (businessTypeInput === "CITAS") {
    customLabelsInitial = JSON.stringify({
      vertical: "citas",
      businessSubType: "CITAS",
      items: "Servicios",
      itemSingle: "Servicio",
      categories: "Especialidades",
    });
  } else if (businessTypeInput === "SERVICES") {
    customLabelsInitial = JSON.stringify({
      vertical: "servicios",
      businessSubType: "SERVICIOS",
      items: "Servicios Técnicos",
      itemSingle: "Servicio",
      categories: "Especialidades Técnicas",
    });
  } else if (businessTypeInput === "RETAIL" || businessTypeInput === "GENERAL_CATALOG" || businessTypeInput === "CATALOG") {
    customLabelsInitial = JSON.stringify({
      vertical: "ctalo",
      businessSubType: "RETAIL",
      items: "Productos",
      itemSingle: "Producto",
      categories: "Categorías",
    });
  } else {
    customLabelsInitial = JSON.stringify({
      vertical: "menuqr",
      businessSubType: "RESTAURANT",
      items: "Platos",
      itemSingle: "Plato",
      categories: "Categorías",
    });
  }

  const localityParts = [province, canton, parroquia, sector].filter(Boolean);
  const locality = localityParts.length > 0 ? localityParts.join(", ") : null;

  const defaultRates = JSON.stringify([
    { id: "km-1", label: "Hasta 2 KM", price: 1.5, minOrder: 0 },
    { id: "km-2", label: "De 2 a 5 KM", price: 2.5, minOrder: 0 },
    { id: "km-3", label: "De 5 a 10 KM", price: 4.0, minOrder: 0 },
    { id: "km-4", label: "Más de 10 KM", price: 6.0, minOrder: 0 },
  ]);

  const restaurant = await prismaTenant.restaurant.create({
    data: {
      userId: session.userId,
      name: restaurantName,
      slug: cleanSlug,
      whatsapp: "",
      locality,
      trialEndsAt,
      businessType,
      catalogMode,
      enableTableOrdering,
      deliveryRates: defaultRates,
      customLabels: customLabelsInitial,
    },
  });

  await setUserSession(session.userId, session.email, restaurant.id);
  revalidatePath("/admin");
  redirect("/admin");
}
