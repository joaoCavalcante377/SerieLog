"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getOrSyncSeries } from "@/features/series/server/sync";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { messages } from "@/lib/messages/pt-BR";
import type { ListInput } from "../schemas/list";
import {
  addItem,
  createList,
  deleteList,
  removeItem,
  reorderItems,
  updateItemNote,
  updateList,
} from "../server/lists";

async function currentUserId(): Promise<string | null> {
  return (await auth())?.user?.id ?? null;
}

function refresh() {
  revalidatePath("/listas");
  revalidatePath("/[username]/listas", "page");
  revalidatePath("/[username]/lista/[slug]", "page");
  revalidatePath("/serie/[idslug]", "page");
}

async function withUser<T>(
  fn: (userId: string) => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  const userId = await currentUserId();
  if (!userId) return fail("UNAUTHENTICATED", messages.errors.unauthorized);
  const result = await fn(userId);
  if (result.ok) refresh();
  return result;
}

export async function createListAction(
  input: ListInput,
): Promise<ActionResult<{ username: string; slug: string }>> {
  return withUser(async (userId) => {
    const created = await createList(userId, input);
    if (!created.ok) return created;
    const user = await db.user.findUnique({ where: { id: userId }, select: { username: true } });
    return ok({ username: user?.username ?? "", slug: created.data.slug });
  });
}

export async function updateListAction(listId: string, input: ListInput): Promise<ActionResult> {
  return withUser((userId) => updateList(userId, listId, input));
}

export async function deleteListAction(listId: string): Promise<ActionResult> {
  return withUser((userId) => deleteList(userId, listId));
}

/** From the editor's search: the series may not be cached locally yet, so sync it first. */
export async function addSeriesToListAction(listId: string, tmdbId: number): Promise<ActionResult> {
  return withUser(async (userId) => {
    let series;
    try {
      series = await getOrSyncSeries(tmdbId);
    } catch (e) {
      logger.warn("series sync failed while adding to list", { tmdbId, error: String(e) });
      return fail("INTERNAL", messages.common.saveFailed);
    }
    if (!series) return fail("NOT_FOUND", messages.logs.seriesNotFound);
    return addItem(userId, listId, series.id);
  });
}

/** From the series page menu: the series is already cached (the page just rendered it). */
export async function setSeriesInListAction(
  listId: string,
  seriesId: string,
  present: boolean,
): Promise<ActionResult> {
  return withUser((userId) =>
    present ? addItem(userId, listId, seriesId) : removeItem(userId, listId, seriesId),
  );
}

export async function removeListItemAction(
  listId: string,
  seriesId: string,
): Promise<ActionResult> {
  return withUser((userId) => removeItem(userId, listId, seriesId));
}

export async function reorderListAction(
  listId: string,
  orderedSeriesIds: string[],
): Promise<ActionResult> {
  return withUser((userId) => reorderItems(userId, listId, orderedSeriesIds));
}

export async function updateListItemNoteAction(
  listId: string,
  seriesId: string,
  note: string,
): Promise<ActionResult> {
  return withUser((userId) => updateItemNote(userId, listId, seriesId, note));
}
