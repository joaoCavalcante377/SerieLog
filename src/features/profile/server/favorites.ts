import { fail, ok, type ActionResult } from "@/lib/action-result";
import { db } from "@/lib/db";
import { messages } from "@/lib/messages/pt-BR";

export const MAX_FAVORITES = 4;

const m = messages.profile;

/** Serializes concurrent favorite edits for one user. */
async function lockUser(tx: Parameters<Parameters<typeof db.$transaction>[0]>[0], userId: string) {
  await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
}

/** Adds to the first free slot. The 5th favorite is refused with "Máximo de 4 favoritas". */
export async function addFavorite(userId: string, seriesId: string): Promise<ActionResult> {
  const series = await db.series.findUnique({ where: { id: seriesId }, select: { id: true } });
  if (!series) return fail("NOT_FOUND", messages.logs.seriesNotFound);

  return db.$transaction(async (tx) => {
    await lockUser(tx, userId);
    const current = await tx.favoriteSeries.findMany({
      where: { userId },
      select: { seriesId: true },
    });
    if (current.some((f) => f.seriesId === seriesId)) return fail("CONFLICT", m.alreadyFavorite);
    if (current.length >= MAX_FAVORITES) return fail("VALIDATION", m.maxFavorites);

    await tx.favoriteSeries.create({ data: { userId, seriesId, position: current.length + 1 } });
    return ok(undefined);
  });
}

export async function removeFavorite(userId: string, seriesId: string): Promise<ActionResult> {
  await db.$transaction(async (tx) => {
    await lockUser(tx, userId);
    await tx.favoriteSeries.deleteMany({ where: { userId, seriesId } });
    // Close the gap in ascending order so (userId, position) never collides.
    const rest = await tx.favoriteSeries.findMany({
      where: { userId },
      orderBy: { position: "asc" },
      select: { id: true },
    });
    for (const [i, f] of rest.entries()) {
      await tx.favoriteSeries.update({ where: { id: f.id }, data: { position: i + 1 } });
    }
  });
  return ok(undefined);
}

/** `orderedSeriesIds` must be exactly the current favorites in the new order. */
export async function reorderFavorites(
  userId: string,
  orderedSeriesIds: string[],
): Promise<ActionResult> {
  return db.$transaction(async (tx) => {
    await lockUser(tx, userId);
    const current = await tx.favoriteSeries.findMany({
      where: { userId },
      select: { seriesId: true },
    });
    const same =
      current.length === orderedSeriesIds.length &&
      new Set(orderedSeriesIds).size === orderedSeriesIds.length &&
      current.every((c) => orderedSeriesIds.includes(c.seriesId));
    if (!same) return fail("CONFLICT", m.staleFavorites);

    // Positions are CHECKed to 1..4, so a temporary offset is impossible: rewrite the rows instead.
    await tx.favoriteSeries.deleteMany({ where: { userId } });
    await tx.favoriteSeries.createMany({
      data: orderedSeriesIds.map((seriesId, i) => ({ userId, seriesId, position: i + 1 })),
    });
    return ok(undefined);
  });
}
