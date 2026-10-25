import { beforeEach, describe, expect, it } from "vitest";
import { createLog, deleteLog } from "@/features/logs/server/logs";
import { getContinueWatching } from "@/features/series/queries/series";
import { addToWatchlist } from "@/features/watchlist/server/watchlist";
import { db } from "@/lib/db";
import { todayInSaoPaulo } from "@/lib/domain/dates";
import { createSeriesWithEpisodes, createUser, resetDb } from "@/test/db";
import { getProgress, getProgressForSeries } from "../queries/progress";
import {
  completeSeries,
  markSeason,
  markSeries,
  rateSeason,
  resumeWatching,
  toggleEpisode,
} from "./progress";

beforeEach(resetDb);

const PAST = "2020-01-01";
const FUTURE = "2999-01-01";

/** S0: 1 special · S1: 3 aired · S2: 2 aired + 1 future + 1 undated. */
async function setup() {
  const userId = await createUser();
  const s = await createSeriesWithEpisodes(1, [
    { seasonNumber: 0, airDates: [PAST] },
    { seasonNumber: 1, airDates: [PAST, PAST, PAST] },
    { seasonNumber: 2, airDates: [PAST, PAST, FUTURE, null] },
  ]);
  return { userId, ...s };
}

const watchCount = (userId: string) => db.episodeWatch.count({ where: { userId } });
const activeLogs = (userId: string) =>
  db.seriesLog.findMany({ where: { userId, status: "WATCHING" } });

const completedLog = (seriesId: string, extra: Record<string, unknown> = {}) => ({
  seriesId,
  status: "COMPLETED",
  finishedAt: PAST,
  reviewText: "",
  containsSpoilers: false,
  isRewatch: false,
  ...extra,
});

describe("toggleEpisode", () => {
  it("LOG-05 marking the first episode creates an active WATCHING log dated today", async () => {
    const { userId, seriesId, bySeason } = await setup();
    const r = await toggleEpisode(userId, bySeason[1].episodeIds[0], true);
    expect(r.ok).toBe(true);

    const logs = await activeLogs(userId);
    expect(logs).toHaveLength(1);
    expect(logs[0].startedAt?.toISOString().slice(0, 10)).toBe(todayInSaoPaulo());
    expect(logs[0]).toMatchObject({ seriesId, isRewatch: false, finishedAt: null });

    const row = await getContinueWatching(userId);
    expect(row.map((l) => l.series.tmdbId)).toEqual([1]);
  });

  it("does not create a second log for later episodes", async () => {
    const { userId, bySeason } = await setup();
    await toggleEpisode(userId, bySeason[1].episodeIds[0], true);
    await toggleEpisode(userId, bySeason[1].episodeIds[1], true);
    expect(await db.seriesLog.count({ where: { userId } })).toBe(1);
  });

  it("concurrent first marks create a single active log", async () => {
    const { userId, bySeason } = await setup();
    await Promise.all(bySeason[1].episodeIds.map((id) => toggleEpisode(userId, id, true)));
    expect(await activeLogs(userId)).toHaveLength(1);
    expect(await watchCount(userId)).toBe(3);
  });

  it("marking is idempotent, including concurrent double clicks", async () => {
    const { userId, bySeason } = await setup();
    const id = bySeason[1].episodeIds[0];
    await Promise.all([toggleEpisode(userId, id, true), toggleEpisode(userId, id, true)]);
    await toggleEpisode(userId, id, true);
    expect(await watchCount(userId)).toBe(1);
  });

  it("LOG-07 unaired episodes (future or undated) cannot be marked", async () => {
    const { userId, bySeason } = await setup();
    for (const id of bySeason[2].episodeIds.slice(2)) {
      expect(await toggleEpisode(userId, id, true)).toMatchObject({
        ok: false,
        error: { code: "VALIDATION", message: "Este episódio ainda não foi ao ar" },
      });
    }
    expect(await watchCount(userId)).toBe(0);
    expect(await db.seriesLog.count()).toBe(0);
  });

  it("unmarking is allowed and removes the watch but keeps the log", async () => {
    const { userId, bySeason } = await setup();
    const id = bySeason[1].episodeIds[0];
    await toggleEpisode(userId, id, true);
    expect((await toggleEpisode(userId, id, false)).ok).toBe(true);
    expect(await watchCount(userId)).toBe(0);
    expect(await activeLogs(userId)).toHaveLength(1);
  });

  it("LOG-11 marking an episode removes the series from the watchlist", async () => {
    const { userId, seriesId, bySeason } = await setup();
    await addToWatchlist(userId, seriesId);
    await toggleEpisode(userId, bySeason[1].episodeIds[0], true);
    expect(await db.watchlistItem.count()).toBe(0);
  });

  it("reports NOT_FOUND for an unknown episode", async () => {
    const { userId } = await setup();
    expect(await toggleEpisode(userId, "nope", true)).toMatchObject({
      ok: false,
      error: { code: "NOT_FOUND" },
    });
  });

  it("users' progress is independent", async () => {
    const { userId, bySeason } = await setup();
    const other = await createUser({ username: "outro", email: "o@x.com" });
    await toggleEpisode(userId, bySeason[1].episodeIds[0], true);
    await toggleEpisode(other, bySeason[1].episodeIds[0], true);
    await toggleEpisode(other, bySeason[1].episodeIds[0], false);
    expect(await watchCount(userId)).toBe(1);
  });

  it("a rewatch (previous log exists) starts a flagged WATCHING log", async () => {
    const { userId, seriesId, bySeason } = await setup();
    await createLog(userId, completedLog(seriesId));
    await toggleEpisode(userId, bySeason[1].episodeIds[0], true);
    const [active] = await activeLogs(userId);
    expect(active.isRewatch).toBe(true);
  });
});

describe("markSeason / markSeries", () => {
  it("LOG-06 marks only the aired episodes of a season with one shared timestamp", async () => {
    const { userId, bySeason } = await setup();
    const r = await markSeason(userId, bySeason[2].seasonId, true);
    expect(r.ok).toBe(true);

    const watches = await db.episodeWatch.findMany({ where: { userId } });
    expect(watches).toHaveLength(2); // the future and undated episodes are skipped
    expect(new Set(watches.map((w) => w.watchedAt.getTime())).size).toBe(1);
    expect(r.ok && r.data.progress).toMatchObject({ watchedAired: 2, totalAired: 5, percent: 40 });
    expect(await activeLogs(userId)).toHaveLength(1);
  });

  it("marking an already partly watched season keeps earlier timestamps", async () => {
    const { userId, bySeason } = await setup();
    const early = new Date("2024-01-01T12:00:00Z");
    await toggleEpisode(userId, bySeason[1].episodeIds[0], true, early);
    await markSeason(userId, bySeason[1].seasonId, true, new Date("2025-01-01T12:00:00Z"));
    const first = await db.episodeWatch.findFirstOrThrow({
      where: { userId, episodeId: bySeason[1].episodeIds[0] },
    });
    expect(first.watchedAt.toISOString()).toBe(early.toISOString());
    expect(await watchCount(userId)).toBe(3);
  });

  it("unmarks a whole season", async () => {
    const { userId, bySeason } = await setup();
    await markSeason(userId, bySeason[1].seasonId, true);
    await markSeason(userId, bySeason[1].seasonId, false);
    expect(await watchCount(userId)).toBe(0);
  });

  it("a season with nothing aired creates no log", async () => {
    const userId = await createUser();
    const { bySeason } = await createSeriesWithEpisodes(2, [
      { seasonNumber: 1, airDates: [FUTURE, FUTURE] },
    ]);
    await markSeason(userId, bySeason[1].seasonId, true);
    expect(await db.seriesLog.count()).toBe(0);
  });

  it("marks the whole series (all aired episodes, specials included)", async () => {
    const { userId, seriesId } = await setup();
    const r = await markSeries(userId, seriesId, true);
    expect(r.ok && r.data.promptCompletion).toBe(true);
    expect(await watchCount(userId)).toBe(6); // 1 special + 3 + 2 aired
  });

  it("handles season numbering gaps", async () => {
    const userId = await createUser();
    const { seriesId } = await createSeriesWithEpisodes(3, [
      { seasonNumber: 1, airDates: [PAST] },
      { seasonNumber: 2, airDates: [PAST] },
      { seasonNumber: 4, airDates: [PAST] },
    ]);
    await markSeries(userId, seriesId, true);
    expect((await getProgress(userId, seriesId)).percent).toBe(100);
  });
});

describe("completion", () => {
  it("LOG-08 asks to complete when the last aired episode is marked, never completing silently", async () => {
    const { userId, seriesId, bySeason } = await setup();
    const aired = [...bySeason[1].episodeIds, ...bySeason[2].episodeIds.slice(0, 2)];
    for (const id of aired.slice(0, -1)) {
      const r = await toggleEpisode(userId, id, true);
      expect(r.ok && r.data.promptCompletion).toBe(false);
    }
    const last = await toggleEpisode(userId, aired[aired.length - 1], true);
    expect(last.ok && last.data.promptCompletion).toBe(true);

    // "Agora não": nothing changed.
    expect((await activeLogs(userId))[0].status).toBe("WATCHING");

    // "Sim"
    expect((await completeSeries(userId, seriesId)).ok).toBe(true);
    const log = await db.seriesLog.findFirstOrThrow({ where: { userId, seriesId } });
    expect(log.status).toBe("COMPLETED");
    expect(log.finishedAt?.toISOString().slice(0, 10)).toBe(todayInSaoPaulo());
  });

  it("completeSeries fails without an active log", async () => {
    const { userId, seriesId } = await setup();
    expect(await completeSeries(userId, seriesId)).toMatchObject({
      ok: false,
      error: { code: "NOT_FOUND" },
    });
  });

  it("completing via the log form can also mark every aired episode (when asked)", async () => {
    const { userId, seriesId } = await setup();
    const r = await createLog(userId, completedLog(seriesId, { markAllWatched: true }));
    expect(r.ok).toBe(true);
    expect(await watchCount(userId)).toBe(6);
    // The bulk mark must not leave a stray WATCHING log behind.
    expect(await activeLogs(userId)).toHaveLength(0);
  });

  it("completing via the log form does not mark episodes unless asked", async () => {
    const { userId, seriesId } = await setup();
    await createLog(userId, completedLog(seriesId));
    expect(await watchCount(userId)).toBe(0);
  });
});

describe("new episodes", () => {
  it("resumeWatching moves the latest COMPLETED log back to WATCHING", async () => {
    const { userId, seriesId } = await setup();
    await markSeries(userId, seriesId, true);
    await completeSeries(userId, seriesId);

    expect((await resumeWatching(userId, seriesId)).ok).toBe(true);
    const log = await db.seriesLog.findFirstOrThrow({ where: { userId, seriesId } });
    expect(log).toMatchObject({ status: "WATCHING", finishedAt: null });
    // Idempotent
    expect((await resumeWatching(userId, seriesId)).ok).toBe(true);
    expect(await db.seriesLog.count({ where: { userId } })).toBe(1);
  });

  it("resumeWatching fails when there is nothing completed", async () => {
    const { userId, seriesId } = await setup();
    expect(await resumeWatching(userId, seriesId)).toMatchObject({ ok: false });
  });
});

describe("independence of logs and watches (rule 6)", () => {
  it("deleting a log keeps episode watches; unmarking all keeps the log", async () => {
    const { userId, seriesId, bySeason } = await setup();
    await markSeason(userId, bySeason[1].seasonId, true);
    const [log] = await activeLogs(userId);

    await deleteLog(userId, log.id);
    expect(await watchCount(userId)).toBe(3);

    await toggleEpisode(userId, bySeason[1].episodeIds[0], true); // starts a new active log
    await markSeries(userId, seriesId, false);
    expect(await watchCount(userId)).toBe(0);
    expect(await activeLogs(userId)).toHaveLength(1);
  });
});

describe("progress", () => {
  it("LOG-15 specials are listed but excluded from the percentage", async () => {
    const { userId, seriesId, bySeason } = await setup();
    // Watching only the special doesn't move progress.
    await toggleEpisode(userId, bySeason[0].episodeIds[0], true);
    expect(await getProgress(userId, seriesId)).toMatchObject({
      watchedAired: 0,
      totalAired: 5,
      percent: 0,
    });

    // All regular aired episodes watched → 100% even if specials were never watched.
    await db.episodeWatch.deleteMany({ where: { userId } });
    await markSeason(userId, bySeason[1].seasonId, true);
    await markSeason(userId, bySeason[2].seasonId, true);
    expect(await getProgress(userId, seriesId)).toMatchObject({
      watchedAired: 5,
      totalAired: 5,
      percent: 100,
      complete: true,
    });
  });

  it("computes per-series percentages for several series in one go", async () => {
    const { userId, seriesId, bySeason } = await setup();
    const other = await createSeriesWithEpisodes(9, [{ seasonNumber: 1, airDates: [PAST, PAST] }]);
    await toggleEpisode(userId, bySeason[1].episodeIds[0], true);
    await toggleEpisode(userId, other.bySeason[1].episodeIds[0], true);
    expect(await getProgressForSeries(userId, [seriesId, other.seriesId])).toEqual({
      [seriesId]: 20,
      [other.seriesId]: 50,
    });
  });

  it("a series with no aired episodes has 0%", async () => {
    const userId = await createUser();
    const { seriesId } = await createSeriesWithEpisodes(4, [
      { seasonNumber: 1, airDates: [FUTURE] },
    ]);
    expect(await getProgress(userId, seriesId)).toMatchObject({ percent: 0, complete: false });
  });
});

describe("rateSeason", () => {
  it("LOG-14 rates a season, changes it and clears it", async () => {
    const { userId, bySeason } = await setup();
    const seasonId = bySeason[1].seasonId;

    expect((await rateSeason(userId, { seasonId, rating: 4 })).ok).toBe(true);
    expect(Number((await db.seasonRating.findFirstOrThrow()).rating)).toBe(4);

    await rateSeason(userId, { seasonId, rating: 2.5, reviewText: "  Fraca  " });
    const row = await db.seasonRating.findFirstOrThrow();
    expect([Number(row.rating), row.reviewText]).toEqual([2.5, "Fraca"]);
    expect(await db.seasonRating.count()).toBe(1);

    await rateSeason(userId, { seasonId, rating: null });
    expect(await db.seasonRating.count()).toBe(0);
  });

  it("validates rating step and review length", async () => {
    const { userId, bySeason } = await setup();
    const seasonId = bySeason[1].seasonId;
    expect((await rateSeason(userId, { seasonId, rating: 3.2 })).ok).toBe(false);
    expect(
      await rateSeason(userId, { seasonId, rating: 3, reviewText: "x".repeat(1001) }),
    ).toMatchObject({
      ok: false,
      error: { fieldErrors: { reviewText: "O comentário deve ter no máximo 1000 caracteres" } },
    });
    expect(
      await rateSeason(userId, { seasonId, rating: 3, reviewText: "x".repeat(1000) }),
    ).toMatchObject({
      ok: true,
    });
  });

  it("each user has their own rating for a season", async () => {
    const { userId, bySeason } = await setup();
    const other = await createUser({ username: "outro", email: "o@x.com" });
    await rateSeason(userId, { seasonId: bySeason[1].seasonId, rating: 5 });
    await rateSeason(other, { seasonId: bySeason[1].seasonId, rating: 1 });
    expect(await db.seasonRating.count()).toBe(2);
  });

  it("rejects an unknown season", async () => {
    const { userId } = await setup();
    expect(await rateSeason(userId, { seasonId: "nope", rating: 3 })).toMatchObject({
      ok: false,
      error: { code: "NOT_FOUND" },
    });
  });
});
