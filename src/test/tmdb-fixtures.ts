import { vi } from "vitest";
import type { TmdbClient } from "@/lib/tmdb/client";
import type { TmdbSeason, TmdbTvDetails } from "@/lib/tmdb/types";

export function makeDetails(over: Partial<TmdbTvDetails> = {}): TmdbTvDetails {
  return {
    id: 1396,
    name: "Breaking Bad",
    original_name: "Breaking Bad",
    overview: "Um professor de química vira traficante.",
    first_air_date: "2008-01-20",
    last_air_date: "2013-09-29",
    status: "Ended",
    poster_path: "/poster.jpg",
    backdrop_path: "/backdrop.jpg",
    genres: [
      { id: 18, name: "Drama" },
      { id: 80, name: "Crime" },
    ],
    number_of_seasons: 2,
    number_of_episodes: 3,
    episode_run_time: [47],
    seasons: [
      {
        id: 10,
        season_number: 0,
        name: "Especiais",
        overview: "",
        poster_path: null,
        air_date: null,
        episode_count: 1,
      },
      {
        id: 11,
        season_number: 1,
        name: "Temporada 1",
        overview: "",
        poster_path: null,
        air_date: "2008-01-20",
        episode_count: 2,
      },
    ],
    ...over,
  };
}

export function makeSeason(
  number: number,
  episodes: number,
  over: Partial<TmdbSeason> = {},
): TmdbSeason {
  return {
    id: 100 + number,
    season_number: number,
    name: number === 0 ? "Especiais" : `Temporada ${number}`,
    overview: "",
    poster_path: null,
    air_date: "2008-01-20",
    episodes: Array.from({ length: episodes }, (_, i) => ({
      id: number * 1000 + i + 1,
      episode_number: i + 1,
      season_number: number,
      name: `Episódio ${i + 1}`,
      overview: "",
      air_date: "2008-01-20",
      runtime: 47,
      still_path: null,
    })),
    ...over,
  };
}

export interface FakeTmdbOptions {
  details?: Partial<TmdbTvDetails>;
  englishOverview?: string;
  notFound?: boolean;
}

/** An in-memory TMDB client with call counters, so tests can assert when TMDB is (not) hit. */
export function makeFakeTmdb(options: FakeTmdbOptions = {}) {
  const getTv = vi.fn(async (_id: number, language: "pt-BR" | "en-US" = "pt-BR") => {
    if (options.notFound) {
      const { TmdbError } = await import("@/lib/tmdb/client");
      throw new TmdbError("not found", "not_found", 404);
    }
    const base = makeDetails(options.details);
    return language === "en-US" ? { ...base, overview: options.englishOverview ?? "" } : base;
  });
  const getSeason = vi.fn(async (_id: number, n: number) => makeSeason(n, n === 0 ? 1 : 2));
  const client = { getTv, getSeason } as unknown as TmdbClient;
  return { client, getTv, getSeason };
}
