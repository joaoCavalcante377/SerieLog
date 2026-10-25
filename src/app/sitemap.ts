import type { MetadataRoute } from "next";
import { buildSitemapEntries } from "@/lib/seo/sitemap";

// Built from the database on each request (cached by the CDN), so it never goes stale at build time.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return buildSitemapEntries(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000");
}
