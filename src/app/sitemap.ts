import { MetadataRoute } from "next";
import { prismaTenant } from "@/lib/db";
import { getBaseUrl, normalizeSlug } from "@/lib/seo";
import { ecuadorData } from "@/lib/ecuador";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getBaseUrl();

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/restaurantes`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.95,
    },
    {
      url: `${baseUrl}/faq`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/registro`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/login`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${baseUrl}/terminos`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${baseUrl}/privacidad`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];

  // Geographic directory routes (provinces & cities)
  const geoRoutes: MetadataRoute.Sitemap = [];
  Object.entries(ecuadorData).forEach(([prov, cities]) => {
    const provSlug = normalizeSlug(prov);
    geoRoutes.push({
      url: `${baseUrl}/restaurantes/${provSlug}`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.85,
    });

    cities.forEach((city) => {
      const citySlug = normalizeSlug(city);
      geoRoutes.push({
        url: `${baseUrl}/restaurantes/${provSlug}/${citySlug}`,
        lastModified: new Date(),
        changeFrequency: "weekly",
        priority: 0.8,
      });
    });
  });

  // Dynamic restaurant menu routes & dish routes
  try {
    const restaurants = await prismaTenant.restaurant.findMany({
      select: {
        slug: true,
        logoUrl: true,
        coverUrl: true,
        updatedAt: true,
        dishes: {
          select: {
            id: true,
            name: true,
            imageUrl: true,
            updatedAt: true,
          },
        },
      },
    });

    const restaurantRoutes: MetadataRoute.Sitemap = [];

    restaurants.forEach((r) => {
      const images: string[] = [];
      if (r.logoUrl) images.push(r.logoUrl.startsWith("http") ? r.logoUrl : `${baseUrl}${r.logoUrl}`);
      if (r.coverUrl) images.push(r.coverUrl.startsWith("http") ? r.coverUrl : `${baseUrl}${r.coverUrl}`);

      restaurantRoutes.push({
        url: `${baseUrl}/${r.slug}`,
        lastModified: r.updatedAt,
        changeFrequency: "daily",
        priority: 0.9,
        images: images.length > 0 ? images : undefined,
      });

      restaurantRoutes.push({
        url: `${baseUrl}/${r.slug}/menu`,
        lastModified: r.updatedAt,
        changeFrequency: "daily",
        priority: 0.85,
      });

      // Include dishes that have images
      (r.dishes || []).forEach((dish: any) => {
        if (dish.imageUrl) {
          const dishSlug = normalizeSlug(dish.name);
          const dishImage = dish.imageUrl.startsWith("http") ? dish.imageUrl : `${baseUrl}${dish.imageUrl}`;
          restaurantRoutes.push({
            url: `${baseUrl}/${r.slug}/${dishSlug}`,
            lastModified: dish.updatedAt,
            changeFrequency: "weekly",
            priority: 0.7,
            images: [dishImage],
          });
        }
      });
    });

    return [...staticRoutes, ...geoRoutes, ...restaurantRoutes];
  } catch (error) {
    console.warn("[Sitemap Warning] Error loading restaurants for sitemap:", error);
    return [...staticRoutes, ...geoRoutes];
  }
}
