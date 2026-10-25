import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { resetDb } from "@/test/db";
import { makeFakeTmdb } from "@/test/tmdb-fixtures";
import { getOrSyncSeries } from "./sync";

beforeEach(resetDb);

const DAY = 24 * 60 * 60 * 1000;

describe("getOrSyncSeries", () => {
  it("SER-01 first visit fetches from TMDB and stores series, genres, seasons and episodes", async () => {
    const { client, getTv } = makeFakeTmdb();
    const series = await getOrSyncSeries(1396, { client });

    expect(series?.name).toBe("Breaking Bad");
    expect(getTv).toHaveBeenCalled();
    const stored = await db.series.findUniqueOrThrow({
      where: { tmdbId: 1396 },
      include: { genres: true, seasons: { include: { episodes: true } } },
    });
    expect(stored.genres).toHaveLength(2);
    expect(stored.seasons.map((s) => s.seasonNumber).sort()).toEqual([0, 1]);
    expect(stored.seasons.find((s) => s.seasonNumber === 0)?.episodes).toHaveLength(1);
    expect(stored.seasons.find((s) => s.seasonNumber === 1)?.episodes).toHaveLength(2);
    expect(stored.episodeRunTime).toBe(47);
    expect(stored.firstAirDate?.toISOString().slice(0, 10)).toBe("2008-01-20");
  });

  it("SER-02 a series synced 2 days ago does not call TMDB", async () => {
    const first = makeFakeTmdb();
    await getOrSyncSeries(1396, { client: first.client });
    await db.series.update({
      where: { tmdbId: 1396 },
      data: { lastSyncedAt: new Date(Date.now() - 2 * DAY) },
    });

    const second = makeFakeTmdb();
    const schedule = vi.fn();
    const series = await getOrSyncSeries(1396, { client: second.client, schedule });

    expect(series?.name).toBe("Breaking Bad");
    expect(second.getTv).not.toHaveBeenCalled();
    expect(second.getSeason).not.toHaveBeenCalled();
    expect(schedule).not.toHaveBeenCalled();
  });

  it("SER-03 a series synced 10 days ago is served from cache and refreshed in the background", async () => {
    await getOrSyncSeries(1396, { client: makeFakeTmdb().client });
    const old = new Date(Date.now() - 10 * DAY);
    await db.series.update({ where: { tmdbId: 1396 }, data: { lastSyncedAt: old } });

    const fake = makeFakeTmdb({ details: { name: "Breaking Bad (atualizado)" } });
    let task: (() => Promise<void>) | undefined;
    const series = await getOrSyncSeries(1396, {
      client: fake.client,
      schedule: (t) => {
        task = t;
      },
    });

    // Cached content returned immediately, no TMDB call yet.
    expect(series?.name).toBe("Breaking Bad");
    expect(fake.getTv).not.toHaveBeenCalled();

    await task?.();
    const refreshed = await db.series.findUniqueOrThrow({ where: { tmdbId: 1396 } });
    expect(refreshed.name).toBe("Breaking Bad (atualizado)");
    expect(refreshed.lastSyncedAt.getTime()).toBeGreaterThan(old.getTime());
  });

  it("a failing background refresh never breaks the cached response", async () => {
    await getOrSyncSeries(1396, { client: makeFakeTmdb().client });
    await db.series.update({
      where: { tmdbId: 1396 },
      data: { lastSyncedAt: new Date(Date.now() - 10 * DAY) },
    });
    const broken = { getTv: vi.fn().mockRejectedValue(new Error("down")) };
    let task: (() => Promise<void>) | undefined;
    const series = await getOrSyncSeries(1396, {
      client: broken as never,
      schedule: (t) => {
        task = t;
      },
    });
    expect(series).not.toBeNull();
    await expect(task?.()).resolves.toBeUndefined();
  });

  it("SER-06 returns null for an unknown TMDB id and stores nothing", async () => {
    const { client } = makeFakeTmdb({ notFound: true });
    expect(await getOrSyncSeries(99999999, { client })).toBeNull();
    expect(await db.series.count()).toBe(0);
  });

  it("DISC-06 falls back to the English overview and flags it", async () => {
    const { client } = makeFakeTmdb({
      details: { overview: "" },
      englishOverview: "A chemistry teacher turns to crime.",
    });
    const series = await getOrSyncSeries(1396, { client });
    expect(series).toMatchObject({
      overview: "A chemistry teacher turns to crime.",
      overviewIsFallback: true,
    });
  });

  it("keeps pt-BR overview unflagged when available", async () => {
    const series = await getOrSyncSeries(1396, { client: makeFakeTmdb().client });
    expect(series?.overviewIsFallback).toBe(false);
  });

  it("re-syncing is idempotent (no duplicate seasons, episodes or genres)", async () => {
    const { client } = makeFakeTmdb();
    await getOrSyncSeries(1396, { client });
    await db.series.update({
      where: { tmdbId: 1396 },
      data: { lastSyncedAt: new Date(Date.now() - 10 * DAY) },
    });
    let task: (() => Promise<void>) | undefined;
    await getOrSyncSeries(1396, { client, schedule: (t) => (task = t) });
    await task?.();

    expect(await db.series.count()).toBe(1);
    expect(await db.season.count()).toBe(2);
    expect(await db.episode.count()).toBe(3);
    expect(await db.seriesGenre.count()).toBe(2);
  });
});
