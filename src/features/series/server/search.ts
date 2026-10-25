import { tmdb, type TmdbClient } from "@/lib/tmdb/client";
import { logger } from "@/lib/logger";
import type { TmdbTvSummary } from "@/lib/tmdb/types";
import { seriesPath } from "@/lib/domain/slug";

export const MIN_QUERY_LENGTH = 2;

export interface SearchResultItem {
  tmdbId: number;
  name: string;
  year: number | null;
  posterPath: string | null;
  href: string;
}

export type SearchOutcome =
  | { status: "ok"; results: SearchResultItem[]; page: number; totalPages: number }
  | { status: "too_short" }
  | { status: "error" };

export function toSearchItem(s: TmdbTvSummary): SearchResultItem {
  const year = s.first_air_date ? Number(s.first_air_date.slice(0, 4)) : NaN;
  // pt-BR results can come back with an empty name; fall back to the original title.
  const name = s.name?.trim() || s.original_name;
  return {
    tmdbId: s.id,
    name,
    year: Number.isFinite(year) && year > 0 ? year : null,
    posterPath: s.poster_path,
    href: seriesPath(s.id, name),
  };
}

export async function searchSeries(
  rawQuery: string,
  page = 1,
  client: TmdbClient = tmdb,
): Promise<SearchOutcome> {
  const query = rawQuery.trim();
  if (query.length < MIN_QUERY_LENGTH) return { status: "too_short" };
  try {
    const res = await client.searchTv(query, page);
    return {
      status: "ok",
      results: res.results.map(toSearchItem),
      page: res.page,
      totalPages: res.total_pages,
    };
  } catch (e) {
    logger.warn("series search failed", { error: String(e) });
    return { status: "error" };
  }
}
