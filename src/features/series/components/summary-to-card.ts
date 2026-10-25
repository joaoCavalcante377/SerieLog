import type { SeriesCardData } from "@/components/media/series-card";
import { toSearchItem } from "../server/search";
import type { TmdbTvSummary } from "@/lib/tmdb/types";

export function summaryToCard(s: TmdbTvSummary): SeriesCardData {
  const item = toSearchItem(s);
  return { href: item.href, name: item.name, year: item.year, posterPath: item.posterPath };
}
