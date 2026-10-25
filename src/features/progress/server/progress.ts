import { Prisma } from "@prisma/client";
import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { db } from "@/lib/db";
import { hasAired, parseTmdbDate, todayInSaoPaulo } from "@/lib/domain/dates";
import { summarizeProgress, type ProgressSummary } from "@/lib/domain/progress";
import { isValidRating } from "@/lib/domain/rating";
import { messages } from "@/lib/messages/pt-BR";
import { fieldErrors } from "@/lib/zod";

/** Episode/season/series progress rules (Section 5.4). All functions take an authenticated user id. */

const p = messages.progress;

type Tx = Prisma.TransactionClient;

export interface ProgressChange {
  progress: ProgressSummary;
  /** True when the series just reached 100% of aired episodes and has an active log: ask, never auto-complete. */
  promptCompletion: boolean;
}

const todayDate = (now: Date) => parseTmdbDate(todayInSaoPaulo(now))!;

async function countProgress(
  tx: Tx,
  userId: string,
  seriesId: string,
  now: Date,
): Promise<ProgressSummary> {
  const today = todayDate(now);
  // Specials (season 0) are listed but never counted; missing air dates never match `lte`.
  const aired = { seasonNumber: { gt: 0 }, airDate: { lte: today } };
  const [totalAired, watchedAired] = await Promise.all([
    tx.episode.count({ where: { seriesId, ...aired } }),
    tx.episodeWatch.count({ where: { userId, seriesId, episode: aired } }),
  ]);
  return summarizeProgress(watchedAired, totalAired);
}

/**
 * Rule 1: watching something with no active log starts one (WATCHING, startedAt = today).
 * `createMany … skipDuplicates` is ON CONFLICT DO NOTHING, so a concurrent request hitting the
 * partial unique index cannot abort the transaction.
 */
async function ensureActiveLog(tx: Tx, userId: string, seriesId: string, now: Date) {
  const active = await tx.seriesLog.findFirst({
    where: { userId, seriesId, status: "WATCHING" },
    select: { id: true },
  });
  if (active) return;
  const hadBefore = (await tx.seriesLog.count({ where: { userId, seriesId } })) > 0;
  await tx.seriesLog.createMany({
    data: [
      {
        userId,
        seriesId,
        status: "WATCHING",
        startedAt: todayDate(now),
        isRewatch: hadBefore,
      },
    ],
    skipDuplicates: true,
  });
}

async function afterMark(tx: Tx, userId: string, seriesId: string, now: Date) {
  await ensureActiveLog(tx, userId, seriesId, now);
  // Rule 5: a series being watched is no longer "to watch".
  await tx.watchlistItem.deleteMany({ where: { userId, seriesId } });
}

async function buildChange(
  tx: Tx,
  userId: string,
  seriesId: string,
  now: Date,
  marked: boolean,
): Promise<ProgressChange> {
  const progress = await countProgress(tx, userId, seriesId, now);
  const active = marked
    ? await tx.seriesLog.findFirst({
        where: { userId, seriesId, status: "WATCHING" },
        select: { id: true },
      })
    : null;
  return { progress, promptCompletion: Boolean(active) && progress.complete };
}

export async function toggleEpisode(
  userId: string,
  episodeId: string,
  watched: boolean,
  now: Date = new Date(),
): Promise<ActionResult<ProgressChange>> {
  const episode = await db.episode.findUnique({
    where: { id: episodeId },
    select: { id: true, seriesId: true, airDate: true },
  });
  if (!episode) return fail("NOT_FOUND", p.notFound);
  // Rule 4: unaired episodes cannot be marked (unmarking is always allowed).
  if (watched && !hasAired(episode.airDate, now)) {
    return fail("VALIDATION", p.episodeNotAired);
  }

  const change = await db.$transaction(async (tx) => {
    if (watched) {
      await tx.episodeWatch.createMany({
        data: [{ userId, episodeId, seriesId: episode.seriesId, watchedAt: now }],
        skipDuplicates: true,
      });
      await afterMark(tx, userId, episode.seriesId, now);
    } else {
      await tx.episodeWatch.deleteMany({ where: { userId, episodeId } });
    }
    return buildChange(tx, userId, episode.seriesId, now, watched);
  });
  return ok(change);
}

async function markEpisodes(
  userId: string,
  seriesId: string,
  where: Prisma.EpisodeWhereInput,
  watched: boolean,
  now: Date,
  ensureLog: boolean,
): Promise<ProgressChange> {
  return db.$transaction(async (tx) => {
    if (watched) {
      const aired = await tx.episode.findMany({
        where: { ...where, airDate: { lte: todayDate(now) } },
        select: { id: true },
      });
      if (aired.length > 0) {
        // One shared timestamp for the whole batch; already-watched episodes keep theirs.
        await tx.episodeWatch.createMany({
          data: aired.map((e) => ({ userId, episodeId: e.id, seriesId, watchedAt: now })),
          skipDuplicates: true,
        });
        if (ensureLog) await afterMark(tx, userId, seriesId, now);
      }
    } else {
      await tx.episodeWatch.deleteMany({ where: { userId, episode: where } });
    }
    return buildChange(tx, userId, seriesId, now, watched && ensureLog);
  });
}

export async function markSeason(
  userId: string,
  seasonId: string,
  watched: boolean,
  now: Date = new Date(),
): Promise<ActionResult<ProgressChange>> {
  const season = await db.season.findUnique({
    where: { id: seasonId },
    select: { id: true, seriesId: true },
  });
  if (!season) return fail("NOT_FOUND", p.notFound);
  return ok(await markEpisodes(userId, season.seriesId, { seasonId }, watched, now, true));
}

export async function markSeries(
  userId: string,
  seriesId: string,
  watched: boolean,
  { now = new Date(), ensureLog = true }: { now?: Date; ensureLog?: boolean } = {},
): Promise<ActionResult<ProgressChange>> {
  const series = await db.series.findUnique({ where: { id: seriesId }, select: { id: true } });
  if (!series) return fail("NOT_FOUND", messages.logs.seriesNotFound);
  return ok(await markEpisodes(userId, seriesId, { seriesId }, watched, now, ensureLog));
}

/** Rule 2: only runs when the user confirms the prompt. */
export async function completeSeries(
  userId: string,
  seriesId: string,
  now: Date = new Date(),
): Promise<ActionResult> {
  const active = await db.seriesLog.findFirst({
    where: { userId, seriesId, status: "WATCHING" },
    select: { id: true },
  });
  if (!active) return fail("NOT_FOUND", messages.logs.notFound);
  await db.seriesLog.update({
    where: { id: active.id },
    data: { status: "COMPLETED", finishedAt: todayDate(now) },
  });
  return ok(undefined);
}

/** "Novos episódios" prompt: moves the latest COMPLETED log back to WATCHING (never done silently). */
export async function resumeWatching(userId: string, seriesId: string): Promise<ActionResult> {
  const active = await db.seriesLog.findFirst({
    where: { userId, seriesId, status: "WATCHING" },
    select: { id: true },
  });
  if (active) return ok(undefined);

  const latest = await db.seriesLog.findFirst({
    where: { userId, seriesId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { id: true, status: true },
  });
  if (!latest || latest.status !== "COMPLETED") return fail("NOT_FOUND", messages.logs.notFound);
  try {
    await db.seriesLog.update({
      where: { id: latest.id },
      data: { status: "WATCHING", finishedAt: null },
    });
  } catch (e) {
    // A concurrent request already created/resumed an active log: the goal is met.
    if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
  }
  return ok(undefined);
}

const seasonRatingSchema = z.object({
  seasonId: z.string().min(1),
  rating: z.number().refine(isValidRating, messages.logs.validation.ratingInvalid).nullable(),
  reviewText: z
    .string()
    .max(1000, p.seasonReviewTooLong)
    .optional()
    .transform((s) => (s?.trim() ? s.trim() : null)),
});

/** Rate, change or clear (rating = null) a season. */
export async function rateSeason(userId: string, raw: unknown): Promise<ActionResult> {
  const parsed = seasonRatingSchema.safeParse(raw);
  if (!parsed.success) {
    return fail("VALIDATION", messages.validation.invalidData, fieldErrors(parsed.error));
  }
  const { seasonId, rating, reviewText } = parsed.data;

  const season = await db.season.findUnique({ where: { id: seasonId }, select: { id: true } });
  if (!season) return fail("NOT_FOUND", p.notFound);

  if (rating === null) {
    await db.seasonRating.deleteMany({ where: { userId, seasonId } });
    return ok(undefined);
  }
  try {
    await db.seasonRating.upsert({
      where: { userId_seasonId: { userId, seasonId } },
      create: { userId, seasonId, rating, reviewText },
      update: { rating, reviewText },
    });
  } catch (e) {
    // Concurrent first-time ratings: the other request won, so apply ours as an update.
    if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
    await db.seasonRating.update({
      where: { userId_seasonId: { userId, seasonId } },
      data: { rating, reviewText },
    });
  }
  return ok(undefined);
}
