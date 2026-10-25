import { z } from "zod";
import { messages } from "@/lib/messages/pt-BR";

const v = messages.lists.validation;

export const MAX_LIST_ITEMS = 500;
export const TITLE_MAX = 100;
export const DESCRIPTION_MAX = 1000;
export const NOTE_MAX = 280;

// Empty strings are valid for description/note ("not set"); the server stores them as null.
export const listSchema = z.object({
  title: z.string().trim().min(1, v.titleRequired).max(TITLE_MAX, v.titleTooLong),
  description: z.string().trim().max(DESCRIPTION_MAX, v.descriptionTooLong),
  isPublic: z.boolean(),
  isRanked: z.boolean(),
});

export const noteSchema = z.string().trim().max(NOTE_MAX, v.noteTooLong);

export type ListInput = z.input<typeof listSchema>;

/** Pure helper used by the editor and tested on its own: move one item to a new index. */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) {
    return [...items];
  }
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}
