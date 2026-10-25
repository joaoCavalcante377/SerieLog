import { db } from "@/lib/db";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { messages } from "@/lib/messages/pt-BR";
import { getDiaryPage, type DiaryEntry } from "../queries/diary";
import { diaryFiltersSchema, type DiaryFilters } from "../schemas/diary";

export interface DiaryPageResult {
  entries: DiaryEntry[];
  hasMore: boolean;
  canEdit: boolean;
}

/**
 * Resolves whose diary is being read. No username = the viewer's own; a username = that user's public diary.
 * Only the owner may edit, which the client uses to show edit/delete controls (writes re-check ownership).
 */
export async function loadDiaryFor(
  username: string | undefined,
  viewerId: string | null,
  rawFilters: DiaryFilters,
  offset: number,
): Promise<ActionResult<DiaryPageResult>> {
  const filters = diaryFiltersSchema.parse(rawFilters);
  const safeOffset = Math.max(0, Math.floor(offset) || 0);

  let ownerId = viewerId;
  if (username) {
    const user = await db.user.findUnique({
      where: { username: username.toLowerCase() },
      select: { id: true },
    });
    if (!user) return fail("NOT_FOUND", messages.errors.notFoundTitle);
    ownerId = user.id;
  }
  if (!ownerId) return fail("UNAUTHENTICATED", messages.errors.unauthorized);

  const page = await getDiaryPage(ownerId, filters, safeOffset);
  return ok({ ...page, canEdit: ownerId === viewerId });
}
