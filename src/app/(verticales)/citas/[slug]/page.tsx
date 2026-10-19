import React from "react";
import { prisma } from "@/lib/db";
import { findRestaurantBySlugOrHistory } from "@/lib/slugs";
import type { Metadata } from "next";
import { CitasClient } from "./components/CitasClient";

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
      title: "Agenda de Citas Demo | OdontoMed & Barber Pro",
      description: "Reserva turnos online eligiendo especialista, servicio y fecha.",
    };
  }

  try {
    const business = await prisma.restaurant.findUnique({
      where: { slug },
      select: {
        name: true,
        specialty: true,
        description: true,
        city: true,
      },
    });

    if (business) {
      return {
        title: `${business.name} | Agenda de Citas y Turnos Online`,
        description: business.description || `Agenda tu turno con el especialista de tu preferencia en ${business.name}.`,
      };
    }
  } catch {}

  return {
    title: "Agenda de Turnos | Citas Pro Ubícame",
  };
}

function getMockDemoClinic() {
  return {
    id: "demo-clinic-id",
    name: "Clínica Dental & Estética Santa Lucía",
    slug: "demo",
    whatsapp: "593999999999",
    logoUrl: "https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=200&auto=format&fit=crop&q=80",
    coverUrl: "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=1200&auto=format&fit=crop&q=80",
    address: "Torre Médica Metrópoli, Piso 4, Consultorio 402, Quito",
    specialty: "Odontología Integral, Limpiezas, Blanqueamientos y Estética Facial",
    description: "Atención odontológica avanzada con tecnología de última generación. Profesionales certificados y ambiente relajante.",
    rating: "4.9",
    galleryImages: [
      "https://images.unsplash.com/photo-1629909615184-74f495363b67?w=1000&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=1000&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?w=1000&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=1000&auto=format&fit=crop&q=80",
    ],
    openingHours: "Lunes a Sábado: 08:30 - 18:30",
    specialists: [
      {
        id: "spec-1",
        name: "Dra. Valeria Campoverde",
        title: "Odontóloga Especialista en Rehabilitación",
        rating: "5.0",
        imageUrl: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=200&auto=format&fit=crop&q=80",
      },
      {
        id: "spec-2",
        name: "Dr. Andrés Villacís",
        title: "Ortodoncista & Cirujano Dental",
        rating: "4.9",
        imageUrl: "https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=200&auto=format&fit=crop&q=80",
      },
      {
        id: "spec-3",
        name: "Cualquier especialista disponible",
        title: "Primer turno libre disponible",
        rating: "5.0",
        imageUrl: "https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?w=200&auto=format&fit=crop&q=80",
      },
    ],
    services: [
      {
        id: "srv-1",
        name: "Limpieza Dental con Ultrasonido y Profilaxis",
        durationMin: 45,
        price: 25.0,
        description: "Eliminación de sarro bacteriano, manchas superficiales y pulido con pasta fluorada.",
      },
      {
        id: "srv-2",
        name: "Valoración Diagnóstica Completa + Cámara Intraoral",
        durationMin: 30,
        price: 15.0,
        description: "Revisión integral de piezas dentales, encías y plan de tratamiento personalizado.",
      },
      {
        id: "srv-3",
        name: "Blanqueamiento Dental LED Instantáneo",
        durationMin: 60,
        price: 75.0,
        description: "Aclara hasta 4 tonos en una sola sesión con gel peroxídico de alta seguridad.",
      },
      {
        id: "srv-4",
        name: "Curación con Resina Estética Nanoparticulada",
        durationMin: 45,
        price: 35.0,
        description: "Restauración anatómica del mismo tono del diente para cavidades y caries.",
      },
    ],
  };
}

export default async function CitasSlugPage({ params: paramsPromise }: PageProps) {
  const params = await paramsPromise;
  const slug = params.slug.toLowerCase().trim();

  if (slug === "demo") {
    const demoClinic = getMockDemoClinic();
    return <CitasClient business={demoClinic} />;
  }

  try {
    const slugCheck = await findRestaurantBySlugOrHistory(slug);
    const business = await prisma.restaurant.findUnique({
      where: { slug },
      include: {
        categories: {
          include: {
            dishes: true,
          },
        },
      },
    });

    if (!business) {
      const demoClinic = getMockDemoClinic();
      demoClinic.name = `Consultorio / Barbería (${slug})`;
      demoClinic.slug = slug;
      return <CitasClient business={demoClinic} />;
    }

    // Adaptar servicios desde categorías y platos
    const services = business.categories.flatMap((cat) =>
      cat.dishes.map((dish) => ({
        id: dish.id,
        name: dish.name,
        durationMin: 45,
        price: dish.price,
        description: dish.description || "Servicio profesional programado.",
      }))
    );

    let customMeta: any = {};
    if ((business as any).customLabels) {
      try {
        customMeta = JSON.parse((business as any).customLabels);
      } catch {}
    }

    const specialists = Array.isArray(customMeta.specialists) && customMeta.specialists.length > 0
      ? customMeta.specialists
      : [
          {
            id: "spec-any",
            name: "Primer Turno Disponible",
            title: `Atención en ${business.name}`,
            rating: "5.0",
            imageUrl: business.logoUrl || "https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?w=200&auto=format&fit=crop&q=80",
          },
          {
            id: "spec-personal",
            name: "Especialista Titular",
            title: "Atención personalizada de cabecera",
            rating: "4.9",
            imageUrl: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=200&auto=format&fit=crop&q=80",
          },
        ];

    const demoClinic = getMockDemoClinic();

    const formattedBusiness = {
      id: business.id,
      name: business.name,
      slug: business.slug,
      whatsapp: business.whatsapp || "",
      whatsappNumber: business.whatsapp || "",
      logoUrl: business.logoUrl || null,
      coverUrl: business.coverUrl || null,
      qrCobroUrl: business.qrCobroUrl || null,
      paymentQrUrl: business.qrCobroUrl || null,
      bankName: business.bankName || null,
      bankAccountType: business.bankAccountType || null,
      bankAccountNumber: business.bankAccountNumber || null,
      bankAccountName: business.bankAccountName || null,
      bankAccountDocument: business.bankAccountDocument || null,
      bankAccountEmail: business.bankAccountEmail || null,
      address: business.address || "Consultorio / Establecimiento",
      specialty: business.specialty || "Atención Profesional con Cita Previa",
      slogan: business.slogan || "¡Agenda tu turno de forma rápida y personalizada!",
      description: business.description || "Agenda tu turno en línea de forma rápida y sencilla sin filas ni esperas.",
      rating: "4.9",
      openingHours: business.schedule || "Lunes a Sábado: 09:00 - 18:00",
      specialists: specialists,
      morningSlots: customMeta.morningSlots || undefined,
      afternoonSlots: customMeta.afternoonSlots || undefined,
      services: services.length > 0 ? services : [
        {
          id: "srv-gen",
          name: "Consulta / Servicio Estándar",
          durationMin: 45,
          price: 25.0,
          description: "Atención completa y personalizada con el profesional de turno.",
        }
      ],
      themeColor: business.themeColor || "#9333ea",
      galleryImages: Array.isArray(customMeta.galleryImages) && customMeta.galleryImages.length > 0
        ? customMeta.galleryImages.filter((u: any) => typeof u === "string" && u.trim().length > 0).slice(0, 4)
        : (demoClinic.galleryImages || []),
      instagram: business.instagram,
      facebook: business.facebook,
      tiktok: business.tiktok,
      ubicameUrl: business.ubicameUrl || "https://ubicame.info",
      reservationUrl: business.reservationUrl,
      googleBusinessUrl: business.googleBusinessUrl,
      locality: business.locality,
      city: business.city,
      province: business.province,
      priceRange: business.priceRange || "$$",
      contactNumbers: business.contactNumbers,
      schedule: business.schedule,
      localSchedule: business.localSchedule,
      structuredSchedule: business.structuredSchedule,
      blockedDates: business.blockedDates,
      mapEmbedUrl: business.mapEmbedUrl,
    };

    return <CitasClient business={formattedBusiness} />;
  } catch (err) {
    console.error("[CitasSlugPage Error]:", err);
    const demoClinic = getMockDemoClinic();
    return <CitasClient business={demoClinic} />;
  }
}
