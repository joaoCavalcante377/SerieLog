import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Account, auth and personal pages have nothing to index.
      disallow: [
        "/api/",
        "/configuracoes",
        "/entrar",
        "/cadastro",
        "/diario",
        "/watchlist",
        "/listas/nova",
      ],
    },
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
