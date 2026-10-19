import React from "react";
import { prisma } from "@/lib/db";
import { findRestaurantBySlugOrHistory } from "@/lib/slugs";
import type { Metadata } from "next";
import { ReservasClient } from "./components/ReservasClient";

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
      title: "Motor de Reservas Demo | Cabañas & Glamping Los Andes",
      description: "Reserva cabañas y domos glamping con fechas de check-in y check-out.",
    };
  }

  try {
    const property = await prisma.restaurant.findUnique({
      where: { slug },
      select: {
        name: true,
        specialty: true,
        description: true,
        city: true,
      },
    });

    if (property) {
      return {
        title: `${property.name} | Motor de Reservas Directas`,
        description: property.description || `Reserva tu estadía en ${property.name} sin comisiones.`,
      };
    }
  } catch {}

  return {
    title: "Motor de Reservas | Reservas Pro Ubícame",
  };
}

function getMockDemoProperty() {
  return {
    id: "demo-lodge-id",
    name: "Cabañas & Glamping El Mirador de los Andes",
    slug: "demo",
    whatsapp: "593999999999",
    logoUrl: "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=200&auto=format&fit=crop&q=80",
    coverUrl: "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=1200&auto=format&fit=crop&q=80",
    address: "Vía a Baños de Agua Santa, Km 8, Sector Río Blanco, Tungurahua",
    specialty: "Hospedaje Rústico, Domos Geodésicos y Cabañas con Vista al Volcán",
    description: "Desconéctate en medio de la naturaleza con vistas panorámicas al cañón y las montañas. Chimenea a leña, jacuzzi con hidromasaje y senderos ecológicos privados.",
    rating: "4.95",
    galleryImages: [
      "https://images.unsplash.com/photo-1584132967334-10e028bd69f7?w=1000&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=1000&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1510312305653-8ed496efae75?w=1000&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1000&auto=format&fit=crop&q=80",
    ],
    amenities: [
      "📶 WiFi de Alta Velocidad",
      "🔥 Chimenea / Fogata a Leña",
      "🛁 Jacuzzi Privado",
      "🚗 Parqueadero Gratuito",
      "🐾 Pet Friendly",
      "☕ Cafetería Artesanal",
    ],
    accommodations: [
      {
        id: "room-1",
        name: "Domo Glamping Panorámico con Jacuzzi",
        description: "Domo geodésico con claraboya para ver las estrellas, cama King size, jacuzzi privado de hidromasaje y terraza privada.",
        pricePerNight: 95.0,
        maxGuests: 2,
        beds: "1 Cama King Size",
        imageUrl: "https://images.unsplash.com/photo-1587061949409-02df41d5e562?w=600&auto=format&fit=crop&q=80",
      },
      {
        id: "room-2",
        name: "Cabaña Rústica Familiar con Chimenea",
        description: "Cabaña de madera de dos pisos con sala, chimenea tradicional, balcón con hamaca y cocina equipada básica.",
        pricePerNight: 130.0,
        maxGuests: 5,
        beds: "1 Cama Queen + 3 Camas de 1.5 plazas",
        imageUrl: "https://images.unsplash.com/photo-1518780664697-55e3ad937233?w=600&auto=format&fit=crop&q=80",
      },
      {
        id: "room-3",
        name: "Suite Matrimonial del Bosque",
        description: "Habitación acogedora con grandes ventanales, baño privado con agua caliente a presión y desayuno incluido.",
        pricePerNight: 65.0,
        maxGuests: 2,
        beds: "1 Cama Matrimonial",
        imageUrl: "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=600&auto=format&fit=crop&q=80",
      },
    ],
    availableExtras: [
      { id: "ext-1", name: "Desayuno Campestre Tradicional", price: 6.5, perPerson: true },
      { id: "ext-2", name: "Cesta de Leña Seca para Fogata", price: 5.0, perPerson: false },
      { id: "ext-3", name: "Sesión Privada de Jacuzzi con Sales", price: 20.0, perPerson: false },
      { id: "ext-4", name: "Paseo a Caballo Guiado (1 hora)", price: 15.0, perPerson: true },
    ],
    themeColor: "#10b981",
    slogan: "¡Desconéctate y vive una experiencia inolvidable en medio de las montañas!",
    instagram: "miradordelosandes",
    facebook: "miradordelosandes",
    tiktok: "miradordelosandes",
    whatsappNumber: "593999999999",
    ubicameUrl: "https://ubicame.info",
    reservationUrl: "https://reservaciones.ubicame.cc",
    googleBusinessUrl: "https://maps.google.com/?q=Banos+Tungurahua+Glamping",
    locality: "Sector Río Blanco, Baños de Agua Santa",
    city: "Baños",
    province: "Tungurahua",
    priceRange: "$$",
    services: "WiFi Fibra Óptica, Jacuzzi Hidromasaje, Chimenea a Leña, Parqueadero Privado, Senderos Ecológicos, Cafetería Campestre",
    contactNumbers: "099 999 9999, 032 740 123",
    schedule: "Atención y Check-in: Lunes a Domingo de 08:00 a 22:00",
    localSchedule: null,
    structuredSchedule: null,
    blockedDates: null,
    mapEmbedUrl: null,
  };
}

export default async function ReservasSlugPage({ params: paramsPromise }: PageProps) {
  const params = await paramsPromise;
  const slug = params.slug.toLowerCase().trim();

  if (slug === "demo") {
    const demoProperty = getMockDemoProperty();
    return <ReservasClient property={demoProperty} />;
  }

  try {
    const slugCheck = await findRestaurantBySlugOrHistory(slug);
    const property = await prisma.restaurant.findUnique({
      where: { slug },
      include: {
        categories: {
          include: {
            dishes: true,
          },
        },
      },
    });

    if (!property) {
      const demoProp = getMockDemoProperty();
      demoProp.name = `Hospedaje (${slug})`;
      demoProp.slug = slug;
      return <ReservasClient property={demoProp} />;
    }

    let customMeta: any = {};
    if (property.customLabels) {
      try {
        customMeta = typeof property.customLabels === "string" ? JSON.parse(property.customLabels) : property.customLabels;
      } catch {}
    }

    const showBedsBadge = customMeta.showBedsBadge !== false;
    const showGuestsBadge = customMeta.showGuestsBadge !== false;

    // Adaptar alojamientos desde base de datos
    const accommodations = property.categories.flatMap((cat) =>
      cat.dishes.map((dish) => {
        let roomBeds: string | null = null;
        let roomMaxGuests: number | null = null;

        if (dish.variants) {
          try {
            const parsed = typeof dish.variants === "string" ? JSON.parse(dish.variants) : dish.variants;
            if (parsed && typeof parsed === "object") {
              if (parsed.beds && String(parsed.beds).trim() !== "") {
                roomBeds = String(parsed.beds).trim();
              }
              if (parsed.maxGuests !== undefined && parsed.maxGuests !== null && Number(parsed.maxGuests) > 0) {
                roomMaxGuests = Number(parsed.maxGuests);
              }
            }
          } catch {}
        }

        return {
          id: dish.id,
          name: dish.name,
          description: dish.description || "",
          pricePerNight: dish.price,
          maxGuests: showGuestsBadge ? roomMaxGuests : null,
          beds: showBedsBadge ? roomBeds : null,
          imageUrl: dish.imageUrl || null,
        };
      })
    );

    const demo = getMockDemoProperty();
    const dynamicAmenities = Array.isArray(customMeta.amenities) && customMeta.amenities.length > 0
      ? customMeta.amenities
      : (property.services ? property.services.split(",").map(s => s.trim()) : demo.amenities);

    const dynamicExtras = Array.isArray(customMeta.availableExtras) && customMeta.availableExtras.length > 0
      ? customMeta.availableExtras
      : demo.availableExtras;

    const formattedProperty = {
      id: property.id,
      name: property.name,
      slug: property.slug,
      whatsapp: property.whatsapp || "",
      whatsappNumber: property.whatsapp || "",
      logoUrl: property.logoUrl || null,
      coverUrl: property.coverUrl || null,
      qrCobroUrl: property.qrCobroUrl || null,
      paymentQrUrl: property.qrCobroUrl || null,
      bankName: property.bankName || null,
      bankAccountType: property.bankAccountType || null,
      bankAccountNumber: property.bankAccountNumber || null,
      bankAccountName: property.bankAccountName || null,
      bankAccountDocument: property.bankAccountDocument || null,
      bankAccountEmail: property.bankAccountEmail || null,
      address: property.address || property.locality || property.parish || "Sector Turístico",
      specialty: property.specialty || "Hospedaje, Cabañas & Turismo",
      slogan: property.slogan || "¡Desconéctate y vive una experiencia inolvidable!",
      description: property.description || "Reserva tu estancia directa sin intermediarios con la mejor atención y comodidades.",
      rating: "4.9",
      amenities: dynamicAmenities,
      accommodations: accommodations.length > 0 ? accommodations : demo.accommodations,
      availableExtras: dynamicExtras,
      showBedsBadge,
      showGuestsBadge,
      themeColor: property.themeColor || "#10b981",
      galleryImages: Array.isArray(customMeta.galleryImages) && customMeta.galleryImages.length > 0
        ? customMeta.galleryImages.filter((u: any) => typeof u === "string" && u.trim().length > 0).slice(0, 4)
        : (demo.galleryImages || []),
      instagram: property.instagram,
      facebook: property.facebook,
      tiktok: property.tiktok,
      ubicameUrl: property.ubicameUrl || "https://ubicame.info",
      reservationUrl: property.reservationUrl,
      googleBusinessUrl: property.googleBusinessUrl,
      locality: property.locality,
      city: property.city,
      province: property.province,
      priceRange: property.priceRange || "$$",
      services: property.services,
      contactNumbers: property.contactNumbers,
      schedule: property.schedule,
      localSchedule: property.localSchedule,
      structuredSchedule: property.structuredSchedule,
      blockedDates: property.blockedDates,
      mapEmbedUrl: property.mapEmbedUrl,
    };

    return <ReservasClient property={formattedProperty} />;
  } catch (err) {
    console.error("[ReservasSlugPage Error]:", err);
    const demoProperty = getMockDemoProperty();
    return <ReservasClient property={demoProperty} />;
  }
}
