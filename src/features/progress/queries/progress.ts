import { db } from "@/lib/db";
import { parseTmdbDate, todayInSaoPaulo } from "@/lib/domain/dates";
import { summarizeProgress } from "@/lib/domain/progress";

const airedFilter = (now: Date) => ({
  seasonNumber: { gt: 0 },
  airDate: { lte: parseTmdbDate(todayInSaoPaulo(now))! },
});

export async function getProgress(userId: string, seriesId: string, now: Date = new Date()) {
  const aired = airedFilter(now);
  const [totalAired, watchedAired] = await Promise.all([
    db.episode.count({ where: { seriesId, ...aired } }),
    db.episodeWatch.count({ where: { userId, seriesId, episode: aired } }),
  ]);
  return summarizeProgress(watchedAired, totalAired);
}

export async function getWatchedEpisodeIds(userId: string, seriesId: string): Promise<string[]> {
  const rows = await db.episodeWatch.findMany({
    where: { userId, seriesId },
    select: { episodeId: true },
  });
  return rows.map((r) => r.episodeId);
}

export async function getSeasonRatings(userId: string, seriesId: string) {
  const rows = await db.seasonRating.findMany({
    where: { userId, season: { seriesId } },
    select: { seasonId: true, rating: true, reviewText: true },
  });
  return Object.fromEntries(
    rows.map((r) => [r.seasonId, { rating: Number(r.rating), reviewText: r.reviewText }]),
  );
}

/** Progress per series for the home "continue watching" row (two grouped queries, not N+1). */
export async function getProgressForSeries(
  userId: string,
  seriesIds: string[],
  now: Date = new Date(),
): Promise<Record<string, number>> {
  if (seriesIds.length === 0) return {};
  const aired = airedFilter(now);
  const [totals, watched] = await Promise.all([
    db.episode.groupBy({
      by: ["seriesId"],
      where: { seriesId: { in: seriesIds }, ...aired },
      _count: { _all: true },
    }),
    db.episodeWatch.groupBy({
      by: ["seriesId"],
      where: { userId, seriesId: { in: seriesIds }, episode: aired },
      _count: { _all: true },
    }),
  ]);
  const totalBy = new Map(totals.map((t) => [t.seriesId, t._count._all]));
  const watchedBy = new Map(watched.map((w) => [w.seriesId, w._count._all]));
  return Object.fromEntries(
    seriesIds.map((id) => [
      id,
      summarizeProgress(watchedBy.get(id) ?? 0, totalBy.get(id) ?? 0).percent,
    ]),
  );
}
