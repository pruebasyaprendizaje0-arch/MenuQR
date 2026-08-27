import { MetadataRoute } from "next";
import { prisma } from "@/lib/db";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://menuqrpro.com";

  // Static routes
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/registro`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/login`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${baseUrl}/terminos`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.4,
    },
    {
      url: `${baseUrl}/privacidad`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.4,
    },
  ];

  // Dynamic restaurant menu routes
  try {
    const restaurants = await prisma.restaurant.findMany({
      select: {
        slug: true,
        updatedAt: true,
      },
    });

    const restaurantRoutes: MetadataRoute.Sitemap = restaurants.map((r) => ({
      url: `${baseUrl}/${r.slug}`,
      lastModified: r.updatedAt,
      changeFrequency: "weekly",
      priority: 0.9,
    }));

    return [...staticRoutes, ...restaurantRoutes];
  } catch (error) {
    if (process.env.NODE_ENV === "development" || process.env.DATABASE_URL) {
      console.warn("[Sitemap Warning] No se pudieron cargar restaurantes para sitemap:", error);
    }
    return staticRoutes;
  }
}
