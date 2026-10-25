import { z } from "zod";
import { isValidRating } from "@/lib/domain/rating";
import { LOG_STATUSES } from "./log";

export const DIARY_PAGE_SIZE = 20;

const schema = z.object({
  year: z.coerce.number().int().min(1900).max(2100).optional().catch(undefined),
  rating: z.coerce.number().refine(isValidRating).optional().catch(undefined),
  status: z.enum(LOG_STATUSES).optional().catch(undefined),
  sort: z.enum(["date", "rating"]).catch("date"),
});

export const diaryFiltersSchema = schema;
export type DiaryFilters = z.infer<typeof schema>;

type Raw = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export function parseDiaryFilters(raw: Raw): DiaryFilters {
  return schema.parse({
    year: first(raw.year) || undefined,
    rating: first(raw.rating) || undefined,
    status: first(raw.status) || undefined,
    sort: first(raw.sort),
  });
}

export function buildDiaryQuery(filters: Partial<DiaryFilters>): string {
  const q = new URLSearchParams();
  if (filters.year) q.set("year", String(filters.year));
  if (filters.rating) q.set("rating", String(filters.rating));
  if (filters.status) q.set("status", filters.status);
  if (filters.sort && filters.sort !== "date") q.set("sort", filters.sort);
  const s = q.toString();
  return s ? `?${s}` : "";
}
