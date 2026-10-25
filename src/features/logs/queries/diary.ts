import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { parseTmdbDate, todayInSaoPaulo } from "@/lib/domain/dates";
import { DIARY_PAGE_SIZE, type DiaryFilters } from "../schemas/diary";

/** Plain, serializable diary row (safe to pass to client components). */
export interface DiaryEntry {
  id: string;
  seriesTmdbId: number;
  seriesName: string;
  posterPath: string | null;
  seriesYear: number | null;
  /** ISO date (YYYY-MM-DD) the entry is filed under: finished, else started, else logged. */
  diaryDate: string;
  status: "WATCHING" | "COMPLETED" | "DROPPED";
  startedAt: string | null;
  finishedAt: string | null;
  rating: number | null;
  reviewText: string | null;
  containsSpoilers: boolean;
  isRewatch: boolean;
}

const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

const DIARY_DATE = Prisma.sql`COALESCE("finishedAt", "startedAt", ("createdAt" AT TIME ZONE 'America/Sao_Paulo')::date)`;

function buildWhere(userId: string, f: DiaryFilters) {
  const parts = [Prisma.sql`"userId" = ${userId}`];
  if (f.year) {
    parts.push(
      Prisma.sql`"finishedAt" >= ${`${f.year}-01-01`}::date AND "finishedAt" < ${`${f.year + 1}-01-01`}::date`,
    );
  }
  if (f.rating) parts.push(Prisma.sql`"rating" = ${f.rating}::numeric`);
  if (f.status) parts.push(Prisma.sql`"status" = ${f.status}::"LogStatus"`);
  return Prisma.join(parts, " AND ");
}

/**
 * One page of a user's diary. Ordering is total (…, createdAt, id) so offset pages never overlap
 * or skip rows while the data is unchanged.
 */
export async function getDiaryPage(
  userId: string,
  filters: DiaryFilters,
  offset = 0,
  limit = DIARY_PAGE_SIZE,
): Promise<{ entries: DiaryEntry[]; hasMore: boolean }> {
  const order =
    filters.sort === "rating"
      ? Prisma.sql`"rating" DESC NULLS LAST, ${DIARY_DATE} DESC, "createdAt" DESC, "id" DESC`
      : Prisma.sql`${DIARY_DATE} DESC, "createdAt" DESC, "id" DESC`;

  const rows = await db.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "SeriesLog"
    WHERE ${buildWhere(userId, filters)}
    ORDER BY ${order}
    OFFSET ${offset} LIMIT ${limit + 1}`;

  const hasMore = rows.length > limit;
  const ids = rows.slice(0, limit).map((r) => r.id);
  if (ids.length === 0) return { entries: [], hasMore: false };

  const logs = await db.seriesLog.findMany({
    where: { id: { in: ids } },
    include: {
      series: { select: { tmdbId: true, name: true, posterPath: true, firstAirDate: true } },
    },
  });
  const byId = new Map(logs.map((l) => [l.id, l]));

  const entries = ids.flatMap((id) => {
    const l = byId.get(id);
    if (!l) return [];
    const diaryDate =
      iso(l.finishedAt) ?? iso(l.startedAt) ?? iso(parseTmdbDate(todayInSaoPaulo(l.createdAt)))!;
    return [
      {
        id: l.id,
        seriesTmdbId: l.series.tmdbId,
        seriesName: l.series.name,
        posterPath: l.series.posterPath,
        seriesYear: l.series.firstAirDate?.getUTCFullYear() ?? null,
        diaryDate,
        status: l.status,
        startedAt: iso(l.startedAt),
        finishedAt: iso(l.finishedAt),
        rating: l.rating ? Number(l.rating) : null,
        reviewText: l.reviewText,
        containsSpoilers: l.containsSpoilers,
        isRewatch: l.isRewatch,
      } satisfies DiaryEntry,
    ];
  });
  return { entries, hasMore };
}

/** What the series page needs to render the action panel for one user. */
export async function getUserSeriesState(userId: string, seriesId: string) {
  const [watchlisted, active, latest] = await Promise.all([
    db.watchlistItem.count({ where: { userId, seriesId } }),
    db.seriesLog.findFirst({ where: { userId, seriesId, status: "WATCHING" } }),
    db.seriesLog.findFirst({
      where: { userId, seriesId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    }),
  ]);
  const current = active ?? latest;
  return {
    onWatchlist: watchlisted > 0,
    status: current?.status ?? null,
    rating: current?.rating ? Number(current.rating) : null,
  };
}
