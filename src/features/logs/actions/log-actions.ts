"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { fail, type ActionResult } from "@/lib/action-result";
import { messages } from "@/lib/messages/pt-BR";
import { createLog, deleteLog, rateSeries, updateLog } from "../server/logs";
import { loadDiaryFor } from "../server/diary-access";
import type { CreateLogInput, LogFormInput } from "../schemas/log";
import type { DiaryFilters } from "../schemas/diary";

async function currentUserId(): Promise<string | null> {
  return (await auth())?.user?.id ?? null;
}

function refresh() {
  revalidatePath("/serie/[idslug]", "page");
  revalidatePath("/diario");
  revalidatePath("/");
}

export async function createLogAction(
  input: CreateLogInput,
): Promise<ActionResult<{ id: string }>> {
  const userId = await currentUserId();
  if (!userId) return fail("UNAUTHENTICATED", messages.errors.unauthorized);
  const result = await createLog(userId, input);
  if (result.ok) refresh();
  return result;
}

export async function updateLogAction(logId: string, input: LogFormInput): Promise<ActionResult> {
  const userId = await currentUserId();
  if (!userId) return fail("UNAUTHENTICATED", messages.errors.unauthorized);
  const result = await updateLog(userId, logId, input);
  if (result.ok) refresh();
  return result;
}

export async function deleteLogAction(logId: string): Promise<ActionResult> {
  const userId = await currentUserId();
  if (!userId) return fail("UNAUTHENTICATED", messages.errors.unauthorized);
  const result = await deleteLog(userId, logId);
  if (result.ok) refresh();
  return result;
}

export async function rateSeriesAction(
  seriesId: string,
  rating: number | null,
): Promise<ActionResult> {
  const userId = await currentUserId();
  if (!userId) return fail("UNAUTHENTICATED", messages.errors.unauthorized);
  const result = await rateSeries(userId, { seriesId, rating });
  if (result.ok) refresh();
  return result;
}

/** Read for "load more": runs as an action so the client can fetch further diary pages. */
export async function loadDiaryPageAction(input: {
  username?: string;
  filters: DiaryFilters;
  offset: number;
}) {
  return loadDiaryFor(input.username, (await currentUserId()) ?? null, input.filters, input.offset);
}
