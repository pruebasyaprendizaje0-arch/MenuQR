import { Metadata } from "next";
import { prismaTenant } from "@/lib/db";
import { UbicamePassClient } from "./components/UbicamePassClient";
import {
  PassFavoritePlace,
  PassFavoriteItem,
  UbicameVertical,
  sanitizeImageUrl,
} from "@/lib/ubicame-pass";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Ubícame Pass | Tu Pase y Favoritos Multi-Comercio",
  description:
    "Accede a tus restaurantes, tiendas, citas, reservas y servicios favoritos en la red Ubícame. Repite pedidos en 1 clic y recibe alertas de cercanía sin contraseñas.",
  openGraph: {
    title: "Ubícame Pass | Pase de Cliente y Fidelización",
    description: "Tus lugares favoritos, historial y pedidos express en toda la red comercial de Ubícame.",
  },
};

function mapBusinessTypeToVertical(bType: string): UbicameVertical {
  const t = (bType || "").toUpperCase();
  if (t === "RETAIL" || t === "CATALOG") return "ctalo";
  if (t === "SERVICES") return "servicios";
  if (t === "RESERVAS" || t === "HOTEL") return "reservas";
  if (t === "CITAS") return "citas";
  return "menuqr";
}

export default async function UbicamePassPage() {
  const restaurants = await prismaTenant.restaurant.findMany({
    take: 18,
    select: {
      id: true,
      name: true,
      slug: true,
      logoUrl: true,
      coverUrl: true,
      specialty: true,
      city: true,
      locality: true,
      businessType: true,
      latitude: true,
      longitude: true,
      dishes: {
        where: { isAvailable: true },
        take: 2,
        select: {
          id: true,
          name: true,
          price: true,
          imageUrl: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const initialNetworkPlaces: PassFavoritePlace[] = restaurants.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    logoUrl: sanitizeImageUrl(r.logoUrl),
    coverUrl: sanitizeImageUrl(r.coverUrl),
    vertical: mapBusinessTypeToVertical(r.businessType),
    category: r.specialty || "Comercio asociado",
    city: r.city || r.locality || "Ecuador",
    latitude: r.latitude,
    longitude: r.longitude,
  }));

  const initialPopularItems: PassFavoriteItem[] = [];
  const seenDishIds = new Set<string>();

  restaurants.forEach((r) => {
    if (r.dishes && r.dishes.length > 0) {
      r.dishes.forEach((d) => {
        if (!seenDishIds.has(d.id)) {
          seenDishIds.add(d.id);
          initialPopularItems.push({
            id: d.id,
            name: d.name,
            price: d.price,
            imageUrl: sanitizeImageUrl(
              d.imageUrl,
              "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&q=80"
            ),
            businessName: r.name,
            businessSlug: r.slug,
            vertical: mapBusinessTypeToVertical(r.businessType),
            orderCount: 1,
          });
        }
      });
    }
  });

  return (
    <UbicamePassClient
      initialNetworkPlaces={initialNetworkPlaces}
      initialPopularItems={initialPopularItems}
    />
  );
}

