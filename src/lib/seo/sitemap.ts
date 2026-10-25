import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { seriesPath } from "@/lib/domain/slug";

const MAX_SERIES = 5000;
const MAX_LISTS = 5000;
const MAX_PROFILES = 5000;

const STATIC_PATHS = ["/", "/series", "/listas", "/sobre"] as const;

/**
 * Public, indexable URLs only: static pages, cached series, public lists and profiles.
 * Private lists, watchlists, diaries and settings are intentionally absent.
 */
export async function buildSitemapEntries(baseUrl: string): Promise<MetadataRoute.Sitemap> {
  const base = baseUrl.replace(/\/$/, "");
  const [series, lists, users] = await Promise.all([
    db.series.findMany({
      orderBy: { id: "asc" },
      take: MAX_SERIES,
      select: { tmdbId: true, name: true, lastSyncedAt: true },
    }),
    db.seriesList.findMany({
      where: { isPublic: true, user: { username: { not: null } } },
      orderBy: { id: "asc" },
      take: MAX_LISTS,
      select: { slug: true, updatedAt: true, user: { select: { username: true } } },
    }),
    db.user.findMany({
      where: { username: { not: null } },
      orderBy: { id: "asc" },
      take: MAX_PROFILES,
      select: { username: true, updatedAt: true },
    }),
  ]);

  return [
    ...STATIC_PATHS.map((path) => ({ url: `${base}${path === "/" ? "" : path}` || base })),
    ...series.map((s) => ({
      url: `${base}${seriesPath(s.tmdbId, s.name)}`,
      lastModified: s.lastSyncedAt,
    })),
    ...lists.flatMap((l) =>
      l.user.username
        ? [{ url: `${base}/${l.user.username}/lista/${l.slug}`, lastModified: l.updatedAt }]
        : [],
    ),
    ...users.flatMap((u) =>
      u.username ? [{ url: `${base}/${u.username}`, lastModified: u.updatedAt }] : [],
    ),
  ];
}
