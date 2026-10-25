import { logger } from "@/lib/logger";
import type {
  TmdbCredits,
  TmdbGenre,
  TmdbLanguage,
  TmdbPage,
  TmdbSeason,
  TmdbTvDetails,
  TmdbTvSummary,
} from "./types";

const BASE_URL = "https://api.themoviedb.org/3";
const TIMEOUT_MS = 8000;

export type TmdbErrorKind = "not_found" | "http" | "timeout" | "network" | "config";

export class TmdbError extends Error {
  constructor(
    message: string,
    readonly kind: TmdbErrorKind,
    readonly status?: number,
  ) {
    super(message);
    this.name = "TmdbError";
  }
}

export interface TmdbClientOptions {
  token?: () => string | undefined;
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

type Params = Record<string, string | number | undefined>;

export interface DiscoverOptions {
  genre?: number;
  year?: number;
  sort: "popularity" | "rating" | "date";
  page?: number;
}

const SORT_PARAM = {
  popularity: "popularity.desc",
  rating: "vote_average.desc",
  date: "first_air_date.desc",
} as const;

export function createTmdbClient(options: TmdbClientOptions = {}) {
  const getToken = options.token ?? (() => process.env.TMDB_API_READ_TOKEN);
  const doFetch = options.fetch ?? fetch;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));

  async function request<T>(
    path: string,
    params: Params = {},
    revalidate = 3600,
    attempt = 0,
  ): Promise<T> {
    const token = getToken();
    if (!token) throw new TmdbError("TMDB token is not configured", "config");

    const url = new URL(`${BASE_URL}${path}`);
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }

    let response: Response;
    try {
      response = await doFetch(url, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        signal: AbortSignal.timeout(TIMEOUT_MS),
        next: { revalidate },
      });
    } catch (e) {
      const timedOut = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
      if (attempt === 0) {
        await sleep(300);
        return request<T>(path, params, revalidate, 1);
      }
      logger.warn("tmdb request failed", { path, kind: timedOut ? "timeout" : "network" });
      throw new TmdbError(
        timedOut ? "TMDB request timed out" : "TMDB is unreachable",
        timedOut ? "timeout" : "network",
      );
    }

    if (response.ok) return (await response.json()) as T;
    if (response.status === 404) throw new TmdbError("TMDB resource not found", "not_found", 404);

    const retryable = response.status === 429 || response.status >= 500;
    if (retryable && attempt === 0) {
      const retryAfter = Number(response.headers.get("retry-after"));
      await sleep(
        Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter, 2) * 1000 : 500,
      );
      return request<T>(path, params, revalidate, 1);
    }
    logger.warn("tmdb request failed", { path, status: response.status });
    throw new TmdbError(`TMDB responded with ${response.status}`, "http", response.status);
  }

  return {
    searchTv: (query: string, page = 1, language: TmdbLanguage = "pt-BR") =>
      request<TmdbPage<TmdbTvSummary>>("/search/tv", { query, page, language }, 300),

    getTv: (id: number, language: TmdbLanguage = "pt-BR") =>
      request<TmdbTvDetails>(`/tv/${id}`, { language }, 60),

    getSeason: (id: number, seasonNumber: number, language: TmdbLanguage = "pt-BR") =>
      request<TmdbSeason>(`/tv/${id}/season/${seasonNumber}`, { language }, 60),

    getCredits: (id: number) =>
      request<TmdbCredits>(`/tv/${id}/credits`, { language: "pt-BR" }, 86400),

    trending: (page = 1) =>
      request<TmdbPage<TmdbTvSummary>>("/trending/tv/week", { page, language: "pt-BR" }, 3600),

    topRated: (page = 1) =>
      request<TmdbPage<TmdbTvSummary>>("/tv/top_rated", { page, language: "pt-BR" }, 3600),

    discover: ({ genre, year, sort, page = 1 }: DiscoverOptions) =>
      request<TmdbPage<TmdbTvSummary>>(
        "/discover/tv",
        {
          language: "pt-BR",
          page,
          with_genres: genre,
          first_air_date_year: year,
          sort_by: SORT_PARAM[sort],
          // Avoid obscure titles with one 10/10 vote topping the "best rated" list.
          "vote_count.gte": sort === "rating" ? 200 : undefined,
        },
        3600,
      ),

    genres: () =>
      request<{ genres: TmdbGenre[] }>("/genre/tv/list", { language: "pt-BR" }, 86400).then(
        (r) => r.genres,
      ),
  };
}

export type TmdbClient = ReturnType<typeof createTmdbClient>;

export const tmdb: TmdbClient = createTmdbClient();
