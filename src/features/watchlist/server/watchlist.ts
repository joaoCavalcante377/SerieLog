import { Prisma } from "@prisma/client";
import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { db } from "@/lib/db";
import { messages } from "@/lib/messages/pt-BR";

const seriesIdSchema = z.string().min(1);

/** Idempotent: adding twice (double click, retry) leaves exactly one row. */
export async function addToWatchlist(userId: string, rawSeriesId: unknown): Promise<ActionResult> {
  const seriesId = seriesIdSchema.safeParse(rawSeriesId);
  if (!seriesId.success) return fail("VALIDATION", messages.validation.invalidData);

  const series = await db.series.findUnique({ where: { id: seriesId.data }, select: { id: true } });
  if (!series) return fail("NOT_FOUND", messages.logs.seriesNotFound);

  try {
    await db.watchlistItem.upsert({
      where: { userId_seriesId: { userId, seriesId: series.id } },
      create: { userId, seriesId: series.id },
      update: {},
    });
  } catch (e) {
    // Two concurrent upserts can both try to insert; the unique constraint keeps one, which is the goal.
    if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
  }
  return ok(undefined);
}

export async function removeFromWatchlist(
  userId: string,
  rawSeriesId: unknown,
): Promise<ActionResult> {
  const seriesId = seriesIdSchema.safeParse(rawSeriesId);
  if (!seriesId.success) return fail("VALIDATION", messages.validation.invalidData);
  await db.watchlistItem.deleteMany({ where: { userId, seriesId: seriesId.data } });
  return ok(undefined);
}

export async function setWatchlistPublic(userId: string, value: unknown): Promise<ActionResult> {
  const parsed = z.boolean().safeParse(value);
  if (!parsed.success) return fail("VALIDATION", messages.validation.invalidData);
  await db.user.update({ where: { id: userId }, data: { watchlistPublic: parsed.data } });
  return ok(undefined);
}
