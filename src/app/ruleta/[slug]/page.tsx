import React from "react";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import RuletaNegocio from "@/components/Ruleta/RuletaNegocio";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }> | { slug: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const resolvedParams = await Promise.resolve(params);
  const slug = resolvedParams?.slug || "";
  const restaurant = await prisma.restaurant.findUnique({
    where: { slug },
    select: { name: true },
  });

  return {
    title: `Ruleta de Premios | ${restaurant?.name || "MenuQR Pro"}`,
    description: "Gira la ruleta y gana premios exclusivos para tu consumo.",
  };
}

export default async function RuletaLandingPage({ params }: Props) {
  const resolvedParams = await Promise.resolve(params);
  const slug = resolvedParams?.slug || "";

  const restaurant = await prisma.restaurant.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      logoUrl: true,
      whatsapp: true,
      themeColor: true,
    },
  });

  if (!restaurant) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-slate-950 flex flex-col justify-center items-center">
      <RuletaNegocio
        slug={restaurant.slug}
        restaurantInfo={{
          name: restaurant.name,
          logoUrl: restaurant.logoUrl,
          whatsapp: restaurant.whatsapp,
        }}
      />
    </main>
  );
}
