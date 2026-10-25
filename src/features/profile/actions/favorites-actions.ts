"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getOrSyncSeries } from "@/features/series/server/sync";
import { fail, type ActionResult } from "@/lib/action-result";
import { logger } from "@/lib/logger";
import { messages } from "@/lib/messages/pt-BR";
import { addFavorite, removeFavorite, reorderFavorites } from "../server/favorites";

async function withUser(fn: (userId: string) => Promise<ActionResult>): Promise<ActionResult> {
  const userId = (await auth())?.user?.id;
  if (!userId) return fail("UNAUTHENTICATED", messages.errors.unauthorized);
  const result = await fn(userId);
  if (result.ok) revalidatePath("/[username]", "page");
  return result;
}

/** The picked series may not be cached locally yet, so sync it first. */
export async function addFavoriteAction(tmdbId: number): Promise<ActionResult> {
  return withUser(async (userId) => {
    let series;
    try {
      series = await getOrSyncSeries(tmdbId);
    } catch (e) {
      logger.warn("series sync failed while adding a favorite", { tmdbId, error: String(e) });
      return fail("INTERNAL", messages.common.saveFailed);
    }
    if (!series) return fail("NOT_FOUND", messages.logs.seriesNotFound);
    return addFavorite(userId, series.id);
  });
}

export async function removeFavoriteAction(seriesId: string): Promise<ActionResult> {
  return withUser((userId) => removeFavorite(userId, seriesId));
}

export async function reorderFavoritesAction(orderedSeriesIds: string[]): Promise<ActionResult> {
  return withUser((userId) => reorderFavorites(userId, orderedSeriesIds));
}
