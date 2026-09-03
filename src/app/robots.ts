import { MetadataRoute } from "next";
import { getBaseUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getBaseUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin/", "/super-admin/", "/api/"],
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
        ],
        allow: ["/", "/llms.txt", "/restaurantes", "/faq"],
        disallow: ["/admin/", "/super-admin/", "/api/"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
