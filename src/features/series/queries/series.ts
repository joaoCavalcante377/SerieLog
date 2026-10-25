import { db } from "@/lib/db";
import { summarizeRatingCounts } from "@/lib/domain/rating";
import { logger } from "@/lib/logger";
import { tmdb } from "@/lib/tmdb/client";
import type { TmdbCastMember } from "@/lib/tmdb/types";

export function getSeriesGenres(seriesId: string) {
  return db.seriesGenre
    .findMany({ where: { seriesId }, select: { genre: { select: { id: true, name: true } } } })
    .then((rows) => rows.map((r) => r.genre));
}

export function getSeasonsWithEpisodes(seriesId: string) {
  return db.season.findMany({
    where: { seriesId },
    orderBy: { seasonNumber: "asc" },
    include: {
      episodes: {
        orderBy: { episodeNumber: "asc" },
        select: {
          id: true,
          episodeNumber: true,
          name: true,
          airDate: true,
          runtime: true,
        },
      },
    },
  });
}

/** Community rating from SeriesLog ratings, aggregated in SQL (never loads every row). */
export async function getRatingSummary(seriesId: string) {
  const rows = await db.seriesLog.groupBy({
    by: ["rating"],
    where: { seriesId, rating: { not: null } },
    _count: { _all: true },
  });
  return summarizeRatingCounts(
    rows.flatMap((r) => (r.rating ? [{ rating: Number(r.rating), count: r._count._all }] : [])),
  );
}

export function getRecentReviews(seriesId: string, take = 5) {
  return db.seriesLog.findMany({
    where: { seriesId, reviewText: { not: null } },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      rating: true,
      reviewText: true,
      containsSpoilers: true,
      createdAt: true,
      user: { select: { name: true, username: true } },
    },
  });
}

/** Top 10 billed cast. Failure is non-fatal: the page simply omits the section. */
export async function getCast(tmdbId: number): Promise<TmdbCastMember[]> {
  try {
    const credits = await tmdb.getCredits(tmdbId);
    return credits.cast.slice(0, 10);
  } catch (e) {
    logger.warn("cast fetch failed", { tmdbId, error: String(e) });
    return [];
  }
}

export function getContinueWatching(userId: string, take = 12) {
  return db.seriesLog.findMany({
    where: { userId, status: "WATCHING" },
    orderBy: { updatedAt: "desc" },
    take,
    select: {
      id: true,
      series: { select: { tmdbId: true, name: true, posterPath: true, firstAirDate: true } },
    },
  });
}
