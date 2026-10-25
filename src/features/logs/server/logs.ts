import { Prisma, type SeriesLog } from "@prisma/client";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { db } from "@/lib/db";
import { parseTmdbDate, todayInSaoPaulo } from "@/lib/domain/dates";
import { messages } from "@/lib/messages/pt-BR";
import { fieldErrors } from "@/lib/zod";
import { markSeries } from "@/features/progress/server/progress";
import { createLogSchema, logSchema, rateSeriesSchema, type LogFormOutput } from "../schemas/log";

/** Log mutations for an already-authenticated user id (authentication happens in the action layer). */

const alreadyWatching = () => fail("CONFLICT", messages.logs.alreadyWatching);

function isUniqueViolation(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

function toColumns(data: LogFormOutput) {
  return {
    status: data.status,
    startedAt: parseTmdbDate(data.startedAt),
    // An in-progress series has no finish date.
    finishedAt: data.status === "WATCHING" ? null : parseTmdbDate(data.finishedAt),
    rating: data.rating,
    reviewText: data.reviewText.trim() === "" ? null : data.reviewText.trim(),
    containsSpoilers: data.containsSpoilers,
    isRewatch: data.isRewatch,
  };
}

export async function createLog(
  userId: string,
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = createLogSchema.safeParse(raw);
  if (!parsed.success) {
    return fail("VALIDATION", messages.validation.invalidData, fieldErrors(parsed.error));
  }
  const { seriesId, ...form } = parsed.data;

  const series = await db.series.findUnique({ where: { id: seriesId }, select: { id: true } });
  if (!series) return fail("NOT_FOUND", messages.logs.seriesNotFound);

  try {
    const log = await db.$transaction(async (tx) => {
      const active =
        form.status === "WATCHING" &&
        (await tx.seriesLog.findFirst({ where: { userId, seriesId, status: "WATCHING" } }));
      if (active) return null;

      const created = await tx.seriesLog.create({
        data: { userId, seriesId, ...toColumns(form) },
        select: { id: true },
      });
      // A series being watched/logged is no longer "to watch".
      await tx.watchlistItem.deleteMany({ where: { userId, seriesId } });
      return created;
    });
    if (!log) return alreadyWatching();
    if (form.status === "COMPLETED" && form.markAllWatched) {
      await markSeries(userId, seriesId, true, { ensureLog: false });
    }
    return ok(log);
  } catch (e) {
    // The partial unique index catches concurrent double submits.
    if (isUniqueViolation(e)) return alreadyWatching();
    throw e;
  }
}

async function findOwnedLog(userId: string, logId: string): Promise<ActionResult<SeriesLog>> {
  const log = await db.seriesLog.findUnique({ where: { id: logId } });
  if (!log) return fail("NOT_FOUND", messages.logs.notFound);
  if (log.userId !== userId) return fail("FORBIDDEN", messages.errors.forbidden);
  return ok(log);
}

export async function updateLog(
  userId: string,
  logId: string,
  raw: unknown,
): Promise<ActionResult> {
  const owned = await findOwnedLog(userId, logId);
  if (!owned.ok) return owned;

  const parsed = logSchema.safeParse(raw);
  if (!parsed.success) {
    return fail("VALIDATION", messages.validation.invalidData, fieldErrors(parsed.error));
  }
  try {
    await db.seriesLog.update({ where: { id: logId }, data: toColumns(parsed.data) });
    if (parsed.data.status === "COMPLETED" && parsed.data.markAllWatched) {
      await markSeries(userId, owned.data.seriesId, true, { ensureLog: false });
    }
    return ok(undefined);
  } catch (e) {
    if (isUniqueViolation(e)) return alreadyWatching();
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return fail("NOT_FOUND", messages.logs.notFound);
    }
    throw e;
  }
}

/** Deletes only the log: episode watches are independent and stay. */
export async function deleteLog(userId: string, logId: string): Promise<ActionResult> {
  const owned = await findOwnedLog(userId, logId);
  if (!owned.ok) return owned;
  await db.seriesLog.deleteMany({ where: { id: logId, userId } });
  return ok(undefined);
}

/**
 * Quick rating from the series page. Updates the active (or latest) log; when the user has no log yet,
 * rating a series counts as having watched it, so a COMPLETED log dated today is created.
 * `rating: null` clears the rating.
 */
export async function rateSeries(userId: string, raw: unknown): Promise<ActionResult> {
  const parsed = rateSeriesSchema.safeParse(raw);
  if (!parsed.success) {
    return fail("VALIDATION", messages.validation.invalidData, fieldErrors(parsed.error));
  }
  const { seriesId, rating } = parsed.data;

  const series = await db.series.findUnique({ where: { id: seriesId }, select: { id: true } });
  if (!series) return fail("NOT_FOUND", messages.logs.seriesNotFound);

  await db.$transaction(async (tx) => {
    const target =
      (await tx.seriesLog.findFirst({ where: { userId, seriesId, status: "WATCHING" } })) ??
      (await tx.seriesLog.findFirst({
        where: { userId, seriesId },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      }));

    if (target) {
      await tx.seriesLog.update({ where: { id: target.id }, data: { rating } });
    } else if (rating !== null) {
      await tx.seriesLog.create({
        data: {
          userId,
          seriesId,
          status: "COMPLETED",
          finishedAt: parseTmdbDate(todayInSaoPaulo()),
          rating,
        },
      });
      await tx.watchlistItem.deleteMany({ where: { userId, seriesId } });
    }
  });
  return ok(undefined);
}
