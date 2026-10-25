import { z } from "zod";

export const SORT_OPTIONS = ["popularity", "rating", "date"] as const;
export type SortOption = (typeof SORT_OPTIONS)[number];

const MIN_YEAR = 1900;

const browseSchema = z.object({
  genre: z.coerce.number().int().positive().optional().catch(undefined),
  year: z.coerce.number().int().min(MIN_YEAR).max(2100).optional().catch(undefined),
  sort: z.enum(SORT_OPTIONS).catch("popularity"),
  page: z.coerce.number().int().min(1).max(500).catch(1),
});

export type BrowseParams = z.infer<typeof browseSchema>;

type RawParams = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Reads filters from the URL query string; invalid values fall back to defaults. */
export function parseBrowseParams(raw: RawParams): BrowseParams {
  return browseSchema.parse({
    genre: first(raw.genre) || undefined,
    year: first(raw.year) || undefined,
    sort: first(raw.sort),
    page: first(raw.page),
  });
}

/** Builds the shareable query string; defaults are omitted to keep URLs clean. */
export function buildBrowseQuery(params: Partial<BrowseParams>): string {
  const q = new URLSearchParams();
  if (params.genre) q.set("genre", String(params.genre));
  if (params.year) q.set("year", String(params.year));
  if (params.sort && params.sort !== "popularity") q.set("sort", params.sort);
  if (params.page && params.page > 1) q.set("page", String(params.page));
  const s = q.toString();
  return s ? `?${s}` : "";
}
