"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { fail, type ActionResult } from "@/lib/action-result";
import { messages } from "@/lib/messages/pt-BR";
import { addToWatchlist, removeFromWatchlist, setWatchlistPublic } from "../server/watchlist";

async function currentUserId(): Promise<string | null> {
  return (await auth())?.user?.id ?? null;
}

function refresh() {
  revalidatePath("/serie/[idslug]", "page");
  revalidatePath("/watchlist");
}

export async function addToWatchlistAction(seriesId: string): Promise<ActionResult> {
  const userId = await currentUserId();
  if (!userId) return fail("UNAUTHENTICATED", messages.errors.unauthorized);
  const result = await addToWatchlist(userId, seriesId);
  if (result.ok) refresh();
  return result;
}

export async function removeFromWatchlistAction(seriesId: string): Promise<ActionResult> {
  const userId = await currentUserId();
  if (!userId) return fail("UNAUTHENTICATED", messages.errors.unauthorized);
  const result = await removeFromWatchlist(userId, seriesId);
  if (result.ok) refresh();
  return result;
}

export async function setWatchlistPublicAction(value: boolean): Promise<ActionResult> {
  const userId = await currentUserId();
  if (!userId) return fail("UNAUTHENTICATED", messages.errors.unauthorized);
  const result = await setWatchlistPublic(userId, value);
  if (result.ok) revalidatePath("/configuracoes");
  return result;
}
