import type { Series } from "@prisma/client";
import { db } from "@/lib/db";
import { isSyncStale, parseTmdbDate } from "@/lib/domain/dates";
import { logger } from "@/lib/logger";
import { TmdbError, tmdb, type TmdbClient } from "@/lib/tmdb/client";
import type { TmdbSeason } from "@/lib/tmdb/types";

const SEASON_FETCH_CONCURRENCY = 4;

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}

/** Fetches a series (details, genres, seasons, episodes) from TMDB and upserts it into our DB. */
export async function syncSeries(tmdbId: number, client: TmdbClient = tmdb): Promise<Series> {
  const details = await client.getTv(tmdbId, "pt-BR");

  // pt-BR first; fall back to the English overview when there is no translation.
  let overview = details.overview?.trim() || null;
  let overviewIsFallback = false;
  if (!overview) {
    const en = await client.getTv(tmdbId, "en-US").catch(() => null);
    overview = en?.overview?.trim() || null;
    overviewIsFallback = overview !== null;
  }

  const seasons: TmdbSeason[] = await mapLimit(
    details.seasons ?? [],
    SEASON_FETCH_CONCURRENCY,
    (s) => client.getSeason(tmdbId, s.season_number, "pt-BR"),
  );

  const now = new Date();
  const seriesData = {
    name: details.name,
    originalName: details.original_name,
    overview,
    overviewIsFallback,
    firstAirDate: parseTmdbDate(details.first_air_date),
    lastAirDate: parseTmdbDate(details.last_air_date),
    status: details.status,
    posterPath: details.poster_path,
    backdropPath: details.backdrop_path,
    numberOfSeasons: details.number_of_seasons ?? 0,
    numberOfEpisodes: details.number_of_episodes ?? 0,
    episodeRunTime: details.episode_run_time?.[0] ?? null,
    lastSyncedAt: now,
  };

  return db.$transaction(
    async (tx) => {
      const series = await tx.series.upsert({
        where: { tmdbId },
        create: { tmdbId, ...seriesData },
        update: seriesData,
      });

      for (const g of details.genres ?? []) {
        await tx.genre.upsert({
          where: { id: g.id },
          create: { id: g.id, name: g.name },
          update: { name: g.name },
        });
      }
      await tx.seriesGenre.deleteMany({ where: { seriesId: series.id } });
      await tx.seriesGenre.createMany({
        data: (details.genres ?? []).map((g) => ({ seriesId: series.id, genreId: g.id })),
        skipDuplicates: true,
      });

      for (const s of seasons) {
        const season = await tx.season.upsert({
          where: { seriesId_seasonNumber: { seriesId: series.id, seasonNumber: s.season_number } },
          create: {
            seriesId: series.id,
            tmdbSeasonId: s.id,
            seasonNumber: s.season_number,
            name: s.name,
            overview: s.overview || null,
            posterPath: s.poster_path,
            airDate: parseTmdbDate(s.air_date),
            episodeCount: s.episodes.length,
          },
          update: {
            tmdbSeasonId: s.id,
            name: s.name,
            overview: s.overview || null,
            posterPath: s.poster_path,
            airDate: parseTmdbDate(s.air_date),
            episodeCount: s.episodes.length,
          },
        });

        // Episodes are never deleted: users' watch records point at them.
        for (const e of s.episodes) {
          const data = {
            tmdbEpisodeId: e.id,
            seriesId: series.id,
            seasonNumber: e.season_number,
            name: e.name,
            overview: e.overview || null,
            airDate: parseTmdbDate(e.air_date),
            runtime: e.runtime,
            stillPath: e.still_path,
          };
          await tx.episode.upsert({
            where: {
              seasonId_episodeNumber: { seasonId: season.id, episodeNumber: e.episode_number },
            },
            create: { seasonId: season.id, episodeNumber: e.episode_number, ...data },
            update: data,
          });
        }
      }
      return series;
    },
    { timeout: 60_000, maxWait: 10_000 },
  );
}

export interface GetSeriesOptions {
  client?: TmdbClient;
  now?: Date;
  /** Runs work after the response (Next's `after`). Used for stale-cache refreshes. */
  schedule?: (task: () => Promise<void>) => void;
}

/**
 * Cache-first lookup. Missing → sync now (blocking). Older than 7 days → serve cached and refresh in background.
 * Returns null when TMDB says the series does not exist.
 */
export async function getOrSyncSeries(
  tmdbId: number,
  { client = tmdb, now = new Date(), schedule }: GetSeriesOptions = {},
): Promise<Series | null> {
  const cached = await db.series.findUnique({ where: { tmdbId } });

  if (cached) {
    if (isSyncStale(cached.lastSyncedAt, now) && schedule) {
      schedule(async () => {
        try {
          await syncSeries(tmdbId, client);
        } catch (e) {
          logger.warn("background series refresh failed", { tmdbId, error: String(e) });
        }
      });
    }
    return cached;
  }

  try {
    return await syncSeries(tmdbId, client);
  } catch (e) {
    if (e instanceof TmdbError && e.kind === "not_found") return null;
    throw e;
  }
}
