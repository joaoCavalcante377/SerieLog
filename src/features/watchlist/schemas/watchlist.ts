import { z } from "zod";

export const WATCHLIST_SORTS = ["added", "year", "title"] as const;
export const WATCHLIST_PAGE_SIZE = 24;

const schema = z.object({
  sort: z.enum(WATCHLIST_SORTS).catch("added"),
  genre: z.coerce.number().int().positive().optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(1000).catch(1),
});

export type WatchlistParams = z.infer<typeof schema>;

type Raw = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export function parseWatchlistParams(raw: Raw): WatchlistParams {
  return schema.parse({
    sort: first(raw.sort),
    genre: first(raw.genre) || undefined,
    page: first(raw.page),
  });
}

export function buildWatchlistQuery(params: Partial<WatchlistParams>): string {
  const q = new URLSearchParams();
  if (params.sort && params.sort !== "added") q.set("sort", params.sort);
  if (params.genre) q.set("genre", String(params.genre));
  if (params.page && params.page > 1) q.set("page", String(params.page));
  const s = q.toString();
  return s ? `?${s}` : "";
}
