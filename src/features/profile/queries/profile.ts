import { db } from "@/lib/db";
import { parseTmdbDate, todayInSaoPaulo } from "@/lib/domain/dates";
import { summarizeRatingCounts } from "@/lib/domain/rating";

export async function getProfileUser(username: string) {
  return db.user.findUnique({
    where: { username: username.toLowerCase() },
    select: { id: true, name: true, username: true, bio: true, image: true, createdAt: true },
  });
}

export interface ProfileCounters {
  /** Distinct series with at least one COMPLETED log (a rewatch does not count twice). */
  seriesWatched: number;
  /** COMPLETED logs finished in the current year (São Paulo); rewatches count. */
  thisYear: number;
  lists: number;
}

export async function getProfileCounters(
  userId: string,
  viewerId: string | null,
  now: Date = new Date(),
): Promise<ProfileCounters> {
  const year = Number(todayInSaoPaulo(now).slice(0, 4));
  const [watched, thisYear, lists] = await Promise.all([
    db.seriesLog.findMany({
      where: { userId, status: "COMPLETED" },
      distinct: ["seriesId"],
      select: { seriesId: true },
    }),
    db.seriesLog.count({
      where: {
        userId,
        status: "COMPLETED",
        finishedAt: {
          gte: parseTmdbDate(`${year}-01-01`)!,
          lt: parseTmdbDate(`${year + 1}-01-01`)!,
        },
      },
    }),
    db.seriesList.count({ where: { userId, ...(viewerId === userId ? {} : { isPublic: true }) } }),
  ]);
  return { seriesWatched: watched.length, thisYear, lists };
}

/** The user's own rating distribution across all their logs. */
export async function getRatingDistribution(userId: string) {
  const rows = await db.seriesLog.groupBy({
    by: ["rating"],
    where: { userId, rating: { not: null } },
    _count: { _all: true },
  });
  return summarizeRatingCounts(
    rows.flatMap((r) => (r.rating ? [{ rating: Number(r.rating), count: r._count._all }] : [])),
  );
}

/** Genres of completed series, by number of distinct series. */
export async function getTopGenres(userId: string, take = 5) {
  const rows = await db.$queryRaw<{ id: number; name: string; count: bigint }[]>`
    SELECT g."id", g."name", COUNT(DISTINCT l."seriesId") AS count
    FROM "SeriesLog" l
    JOIN "SeriesGenre" sg ON sg."seriesId" = l."seriesId"
    JOIN "Genre" g ON g."id" = sg."genreId"
    WHERE l."userId" = ${userId} AND l."status" = 'COMPLETED'
    GROUP BY g."id", g."name"
    ORDER BY count DESC, g."name" ASC
    LIMIT ${take}`;
  return rows.map((r) => ({ id: r.id, name: r.name, count: Number(r.count) }));
}

export function getFavorites(userId: string) {
  return db.favoriteSeries.findMany({
    where: { userId },
    orderBy: { position: "asc" },
    select: {
      position: true,
      series: {
        select: { id: true, tmdbId: true, name: true, posterPath: true, firstAirDate: true },
      },
    },
  });
}

export function getRecentReviewsByUser(userId: string, take = 5) {
  return db.seriesLog.findMany({
    where: { userId, reviewText: { not: null } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take,
    select: {
      id: true,
      rating: true,
      reviewText: true,
      containsSpoilers: true,
      series: { select: { tmdbId: true, name: true } },
    },
  });
}
