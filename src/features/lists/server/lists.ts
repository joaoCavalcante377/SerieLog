import { Prisma, type SeriesList } from "@prisma/client";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { db } from "@/lib/db";
import { slugify, uniqueSlug } from "@/lib/domain/slug";
import { messages } from "@/lib/messages/pt-BR";
import { fieldErrors } from "@/lib/zod";
import { MAX_LIST_ITEMS, listSchema, noteSchema } from "../schemas/list";

/** List mutations for an authenticated user id. Every write checks that the user owns the list. */

const m = messages.lists;

type Tx = Prisma.TransactionClient;

const isUnique = (e: unknown) =>
  e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";

async function findOwnedList(userId: string, listId: string): Promise<ActionResult<SeriesList>> {
  const list = await db.seriesList.findUnique({ where: { id: listId } });
  if (!list) return fail("NOT_FOUND", m.notFound);
  if (list.userId !== userId) return fail("FORBIDDEN", messages.errors.forbidden);
  return ok(list);
}

/** Serializes concurrent edits of the same list (item positions are computed from the current rows). */
async function lockList(tx: Tx, listId: string) {
  await tx.$queryRaw`SELECT "id" FROM "SeriesList" WHERE "id" = ${listId} FOR UPDATE`;
}

async function nextSlug(userId: string, title: string): Promise<string> {
  const base = slugify(title, "lista");
  const existing = await db.seriesList.findMany({
    where: { userId, slug: { startsWith: base } },
    select: { slug: true },
  });
  return uniqueSlug(base, new Set(existing.map((l) => l.slug)));
}

export async function createList(
  userId: string,
  raw: unknown,
): Promise<ActionResult<{ id: string; slug: string }>> {
  const parsed = listSchema.safeParse(raw);
  if (!parsed.success) {
    return fail("VALIDATION", messages.validation.invalidData, fieldErrors(parsed.error));
  }
  const { title, description, isPublic, isRanked } = parsed.data;

  // Two simultaneous creates with the same title can pick the same slug; the unique index decides.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const list = await db.seriesList.create({
        data: {
          userId,
          title,
          description: description || null,
          isPublic,
          isRanked,
          slug: await nextSlug(userId, title),
        },
        select: { id: true, slug: true },
      });
      return ok(list);
    } catch (e) {
      if (!isUnique(e)) throw e;
    }
  }
  return fail("CONFLICT", m.slugConflict);
}

/** The slug is not regenerated on edit, so shared links keep working. */
export async function updateList(
  userId: string,
  listId: string,
  raw: unknown,
): Promise<ActionResult> {
  const owned = await findOwnedList(userId, listId);
  if (!owned.ok) return owned;

  const parsed = listSchema.safeParse(raw);
  if (!parsed.success) {
    return fail("VALIDATION", messages.validation.invalidData, fieldErrors(parsed.error));
  }
  const { title, description, isPublic, isRanked } = parsed.data;
  await db.seriesList.update({
    where: { id: listId },
    data: { title, description: description || null, isPublic, isRanked },
  });
  return ok(undefined);
}

/** Items cascade with the list; logs and the series cache are untouched. */
export async function deleteList(userId: string, listId: string): Promise<ActionResult> {
  const owned = await findOwnedList(userId, listId);
  if (!owned.ok) return owned;
  await db.seriesList.deleteMany({ where: { id: listId, userId } });
  return ok(undefined);
}

export async function addItem(
  userId: string,
  listId: string,
  seriesId: string,
  note?: string,
): Promise<ActionResult> {
  const owned = await findOwnedList(userId, listId);
  if (!owned.ok) return owned;

  const parsedNote = noteSchema.safeParse(note ?? "");
  if (!parsedNote.success) {
    return fail("VALIDATION", messages.validation.invalidData, {
      note: parsedNote.error.issues[0].message,
    });
  }
  const series = await db.series.findUnique({ where: { id: seriesId }, select: { id: true } });
  if (!series) return fail("NOT_FOUND", messages.logs.seriesNotFound);

  return db.$transaction(async (tx) => {
    await lockList(tx, listId);
    const [count, existing, last] = await Promise.all([
      tx.seriesListItem.count({ where: { listId } }),
      tx.seriesListItem.findUnique({ where: { listId_seriesId: { listId, seriesId } } }),
      tx.seriesListItem.findFirst({
        where: { listId },
        orderBy: { position: "desc" },
        select: { position: true },
      }),
    ]);
    if (existing) return fail("CONFLICT", m.alreadyInList);
    if (count >= MAX_LIST_ITEMS) return fail("VALIDATION", m.limitReached);

    await tx.seriesListItem.create({
      data: {
        listId,
        seriesId,
        position: (last?.position ?? 0) + 1,
        note: parsedNote.data || null,
      },
    });
    return ok(undefined);
  });
}

async function repack(tx: Tx, listId: string) {
  const items = await tx.seriesListItem.findMany({
    where: { listId },
    orderBy: { position: "asc" },
    select: { id: true },
  });
  for (const [i, item] of items.entries()) {
    await tx.seriesListItem.update({ where: { id: item.id }, data: { position: i + 1 } });
  }
}

export async function removeItem(
  userId: string,
  listId: string,
  seriesId: string,
): Promise<ActionResult> {
  const owned = await findOwnedList(userId, listId);
  if (!owned.ok) return owned;
  await db.$transaction(async (tx) => {
    await lockList(tx, listId);
    await tx.seriesListItem.deleteMany({ where: { listId, seriesId } });
    await repack(tx, listId); // positions stay contiguous 1..n
  });
  return ok(undefined);
}

/** `orderedSeriesIds` must be exactly the current set of items, in the new order. */
export async function reorderItems(
  userId: string,
  listId: string,
  orderedSeriesIds: string[],
): Promise<ActionResult> {
  const owned = await findOwnedList(userId, listId);
  if (!owned.ok) return owned;

  return db.$transaction(async (tx) => {
    await lockList(tx, listId);
    const current = await tx.seriesListItem.findMany({
      where: { listId },
      select: { seriesId: true },
    });
    const same =
      current.length === orderedSeriesIds.length &&
      new Set(orderedSeriesIds).size === orderedSeriesIds.length &&
      current.every((c) => orderedSeriesIds.includes(c.seriesId));
    // A mismatch means the list changed elsewhere (stale UI): refuse instead of guessing.
    if (!same) return fail("CONFLICT", m.staleList);

    // The (listId, position) unique constraint is DEFERRABLE, so positions can be swapped freely here.
    for (const [i, seriesId] of orderedSeriesIds.entries()) {
      await tx.seriesListItem.updateMany({
        where: { listId, seriesId },
        data: { position: i + 1 },
      });
    }
    return ok(undefined);
  });
}

export async function updateItemNote(
  userId: string,
  listId: string,
  seriesId: string,
  note: string,
): Promise<ActionResult> {
  const owned = await findOwnedList(userId, listId);
  if (!owned.ok) return owned;
  const parsed = noteSchema.safeParse(note);
  if (!parsed.success) {
    return fail("VALIDATION", messages.validation.invalidData, {
      note: parsed.error.issues[0].message,
    });
  }
  const { count } = await db.seriesListItem.updateMany({
    where: { listId, seriesId },
    data: { note: parsed.data || null },
  });
  return count === 0 ? fail("NOT_FOUND", m.notFound) : ok(undefined);
}
