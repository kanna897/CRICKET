import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  const origin = siteUrl().origin;
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/*/admin/", "/*/auth/", "/_next/"],
    },
    sitemap: `${origin}/sitemap.xml`,
    host: origin,
  };
}
