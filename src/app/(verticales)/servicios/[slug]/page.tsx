import React from "react";
import { prisma } from "@/lib/db";
import { findRestaurantBySlugOrHistory } from "@/lib/slugs";
import type { Metadata } from "next";
import { ServiciosClient } from "./components/ServiciosClient";

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
      title: "Cotizador Express Demo | Multiservicios Técnicos Pro",
      description: "Cotiza servicios de plomería y electricidad en 60 segundos con fotos y GPS.",
    };
  }

  try {
    const technician = await prisma.restaurant.findUnique({
      where: { slug },
      select: {
        name: true,
        specialty: true,
        description: true,
        city: true,
      },
    });

    if (technician) {
      return {
        title: `${technician.name} | Cotizador Express de Servicios`,
        description: technician.description || `Solicita una cotización rápida con fotos y ubicación GPS a ${technician.name}.`,
      };
    }
  } catch {}

  return {
    title: "Cotizador Express | Servicios Pro Ubícame",
  };
}

function getMockDemoTechnician() {
  return {
    id: "demo-technician-id",
    name: "MasterFix - Plomería & Electricidad 24/7",
    slug: "demo",
    whatsapp: "593999999999",
    logoUrl: "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=200&auto=format&fit=crop&q=80",
    coverUrl: "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=1200&auto=format&fit=crop&q=80",
    address: "Cobertura en todo Quito y Valles (Cumbayá, Tumbaco, Los Chillos)",
    specialty: "Plomería, Calefones, Redes Eléctricas y Bombas de Agua",
    description: "Técnico certificado con más de 12 años de experiencia. Reparaciones urgentes de fugas, cortocircuitos, instalación de tableros y mantenimiento preventivo.",
    rating: "4.9",
    jobsCount: 380,
    responseTime: "15 - 30 minutos",
    galleryImages: [
      "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=1000&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=1000&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=1000&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=1000&auto=format&fit=crop&q=80",
    ],
    commonServices: [
      { id: "s-1", name: "Detección y Reparación de Fugas de Agua", basePrice: 25.0, icon: "💧" },
      { id: "s-2", name: "Mantenimiento y Reparación de Calefones", basePrice: 35.0, icon: "🔥" },
      { id: "s-3", name: "Reparación de Cortocircuitos y Breakers", basePrice: 30.0, icon: "⚡" },
      { id: "s-4", name: "Instalación de Griferías e Inodoros", basePrice: 20.0, icon: "🚽" },
      { id: "s-5", name: "Mantenimiento de Bombas de Agua y Tanques", basePrice: 45.0, icon: "⚙️" },
    ],
  };
}

export default async function ServiciosSlugPage({ params: paramsPromise }: PageProps) {
  const params = await paramsPromise;
  const slug = params.slug.toLowerCase().trim();

  if (slug === "demo") {
    const demoTech = getMockDemoTechnician();
    return <ServiciosClient technician={demoTech} />;
  }

  try {
    const slugCheck = await findRestaurantBySlugOrHistory(slug);
    const tech = await prisma.restaurant.findUnique({
      where: { slug },
      include: {
        categories: {
          include: {
            dishes: true,
          },
        },
      },
    });

    if (!tech) {
      const demoTech = getMockDemoTechnician();
      demoTech.name = `Técnico Profesional (${slug})`;
      demoTech.slug = slug;
      return <ServiciosClient technician={demoTech} />;
    }

    // Adaptar servicios desde la base de datos
    const commonServices = tech.categories.flatMap((cat) =>
      cat.dishes.map((dish) => ({
        id: dish.id,
        name: dish.name,
        basePrice: dish.price,
        icon: "🔧",
      }))
    );

    let customMeta: any = {};
    if ((tech as any).customLabels) {
      try {
        customMeta = JSON.parse((tech as any).customLabels);
      } catch {}
    }

    const formattedTech = {
      id: tech.id,
      name: tech.name,
      slug: tech.slug,
      galleryImages: Array.isArray(customMeta.galleryImages) && customMeta.galleryImages.length > 0
        ? customMeta.galleryImages.filter((u: any) => typeof u === "string" && u.trim().length > 0).slice(0, 4)
        : (getMockDemoTechnician().galleryImages || []),
      whatsapp: tech.whatsapp || "",
      whatsappNumber: tech.whatsapp || "",
      logoUrl: tech.logoUrl || null,
      coverUrl: tech.coverUrl || null,
      qrCobroUrl: tech.qrCobroUrl || null,
      paymentQrUrl: tech.qrCobroUrl || null,
      bankName: tech.bankName || null,
      bankAccountType: tech.bankAccountType || null,
      bankAccountNumber: tech.bankAccountNumber || null,
      bankAccountName: tech.bankAccountName || null,
      bankAccountDocument: tech.bankAccountDocument || null,
      bankAccountEmail: tech.bankAccountEmail || null,
      address: tech.address || "Servicio a Domicilio y Cobertura Local",
      specialty: tech.specialty || "Servicios Técnicos Especializados",
      slogan: tech.slogan || "¡Solución rápida, garantizada y profesional en minutos!",
      description: tech.description || "Asistencia técnica garantizada y cotización inmediata por WhatsApp.",
      rating: "4.9",
      jobsCount: 150,
      responseTime: "Menos de 30 min",
      commonServices: commonServices.length > 0 ? commonServices : getMockDemoTechnician().commonServices,
      themeColor: tech.themeColor || "#f59e0b",
      instagram: tech.instagram,
      facebook: tech.facebook,
      tiktok: tech.tiktok,
      ubicameUrl: tech.ubicameUrl || "https://ubicame.info",
      reservationUrl: tech.reservationUrl,
      googleBusinessUrl: tech.googleBusinessUrl,
      locality: tech.locality,
      city: tech.city,
      province: tech.province,
      priceRange: tech.priceRange || "$$",
      services: tech.services,
      contactNumbers: tech.contactNumbers,
      schedule: tech.schedule,
      localSchedule: tech.localSchedule,
      structuredSchedule: tech.structuredSchedule,
      blockedDates: tech.blockedDates,
      mapEmbedUrl: tech.mapEmbedUrl,
    };

    return <ServiciosClient technician={formattedTech} />;
  } catch (err) {
    console.error("[ServiciosSlugPage Error]:", err);
    const demoTech = getMockDemoTechnician();
    return <ServiciosClient technician={demoTech} />;
  }
}
