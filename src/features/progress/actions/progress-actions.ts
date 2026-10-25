"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { fail, type ActionResult } from "@/lib/action-result";
import { messages } from "@/lib/messages/pt-BR";
import {
  completeSeries,
  markSeason,
  markSeries,
  rateSeason,
  resumeWatching,
  toggleEpisode,
  type ProgressChange,
} from "../server/progress";

async function currentUserId(): Promise<string | null> {
  return (await auth())?.user?.id ?? null;
}

function refresh() {
  revalidatePath("/serie/[idslug]", "page");
  revalidatePath("/diario");
  revalidatePath("/watchlist");
  revalidatePath("/");
}

/** Runs `fn` for the signed-in user and revalidates on success. */
async function withUser<T>(
  fn: (userId: string) => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  const userId = await currentUserId();
  if (!userId) return fail("UNAUTHENTICATED", messages.errors.unauthorized);
  const result = await fn(userId);
  if (result.ok) refresh();
  return result;
}

export async function toggleEpisodeAction(
  episodeId: string,
  watched: boolean,
): Promise<ActionResult<ProgressChange>> {
  return withUser((userId) => toggleEpisode(userId, episodeId, watched));
}

export async function markSeasonAction(
  seasonId: string,
  watched: boolean,
): Promise<ActionResult<ProgressChange>> {
  return withUser((userId) => markSeason(userId, seasonId, watched));
}

export async function markSeriesAction(
  seriesId: string,
  watched: boolean,
): Promise<ActionResult<ProgressChange>> {
  return withUser((userId) => markSeries(userId, seriesId, watched));
}

export async function completeSeriesAction(seriesId: string): Promise<ActionResult> {
  return withUser((userId) => completeSeries(userId, seriesId));
}

export async function resumeWatchingAction(seriesId: string): Promise<ActionResult> {
  return withUser((userId) => resumeWatching(userId, seriesId));
}

export async function rateSeasonAction(
  seasonId: string,
  rating: number | null,
  reviewText?: string,
): Promise<ActionResult> {
  return withUser((userId) => rateSeason(userId, { seasonId, rating, reviewText }));
}
