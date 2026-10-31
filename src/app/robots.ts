import { MetadataRoute } from "next";
import { getBaseUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getBaseUrl();

  const operationalDisallows = [
    "/admin/",
    "/super-admin/",
    "/api/",
    "/caja",
    "/cocina",
    "/*/cocina",
    "/*/mesas",
    "/*/repartidor",
    "/*/rastreo",
  ];

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: operationalDisallows,
      },
      {
        userAgent: [
          "GPTBot",
          "ChatGPT-User",
          "PerplexityBot",
          "ClaudeBot",
          "Claude-Web",
          "Google-Extended",
          "Amazonbot",
          "Applebot-Extended",
          "Meta-ExternalAgent",
          "CCBot",
        ],
        allow: ["/", "/llms.txt", "/llms-full.txt", "/restaurantes", "/marketplace", "/catalogos", "/faq"],
        disallow: operationalDisallows,
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
