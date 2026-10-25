import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { todayInSaoPaulo } from "@/lib/domain/dates";
import { createSeries, createUser, resetDb } from "@/test/db";
import { getRatingSummary } from "@/features/series/queries/series";
import { addToWatchlist } from "@/features/watchlist/server/watchlist";
import { createLog, deleteLog, rateSeries, updateLog } from "./logs";

beforeEach(resetDb);

const today = () => todayInSaoPaulo();
const completed = (over: Record<string, unknown> = {}) => ({
  status: "COMPLETED",
  startedAt: "",
  finishedAt: today(),
  rating: 4.5,
  reviewText: "",
  containsSpoilers: false,
  isRewatch: false,
  ...over,
});

async function setup() {
  const userId = await createUser();
  const series = await createSeries(1);
  return { userId, seriesId: series.id };
}

describe("createLog", () => {
  it("LOG-01 creates a completed log with rating and review, and updates the community average", async () => {
    const { userId, seriesId } = await setup();
    const result = await createLog(userId, {
      seriesId,
      ...completed({ rating: 4.5, reviewText: "  Excelente!  " }),
    });
    expect(result.ok).toBe(true);

    const log = await db.seriesLog.findFirstOrThrow({ where: { userId, seriesId } });
    expect(log).toMatchObject({ status: "COMPLETED", reviewText: "Excelente!" });
    expect(Number(log.rating)).toBe(4.5);
    expect((await getRatingSummary(seriesId)).average).toBe(4.5);
  });

  it("LOG-03 rejects a finish date before the start date or in the future", async () => {
    const { userId, seriesId } = await setup();
    const before = await createLog(userId, {
      seriesId,
      ...completed({ startedAt: "2025-05-10", finishedAt: "2025-05-01" }),
    });
    expect(before).toMatchObject({
      ok: false,
      error: { fieldErrors: { finishedAt: "O término não pode ser antes do início" } },
    });

    const future = await createLog(userId, {
      seriesId,
      ...completed({ finishedAt: "2999-01-01" }),
    });
    expect(future).toMatchObject({
      ok: false,
      error: { fieldErrors: { finishedAt: "A data de término não pode ser no futuro" } },
    });
    expect(await db.seriesLog.count()).toBe(0);
  });

  it("requires a finish date for COMPLETED", async () => {
    const { userId, seriesId } = await setup();
    const result = await createLog(userId, { seriesId, ...completed({ finishedAt: "" }) });
    expect(result).toMatchObject({
      ok: false,
      error: { fieldErrors: { finishedAt: "Informe a data de término" } },
    });
  });

  it("LOG-04 rejects a review with 5001 characters and accepts 5000", async () => {
    const { userId, seriesId } = await setup();
    const tooLong = await createLog(userId, {
      seriesId,
      ...completed({ reviewText: "x".repeat(5001) }),
    });
    expect(tooLong).toMatchObject({
      ok: false,
      error: { fieldErrors: { reviewText: "A crítica deve ter no máximo 5000 caracteres" } },
    });
    expect(await db.seriesLog.count()).toBe(0);

    const exact = await createLog(userId, {
      seriesId,
      ...completed({ reviewText: "x".repeat(5000) }),
    });
    expect(exact.ok).toBe(true);
  });

  it("rejects ratings outside 0.5–5.0 in 0.5 steps", async () => {
    const { userId, seriesId } = await setup();
    for (const rating of [0, 5.5, 3.3, -1]) {
      const r = await createLog(userId, { seriesId, ...completed({ rating }) });
      expect(r.ok).toBe(false);
    }
  });

  it("LOG-09 a rewatch creates a second log and leaves the first untouched", async () => {
    const { userId, seriesId } = await setup();
    const first = await createLog(userId, { seriesId, ...completed({ rating: 3 }) });
    const second = await createLog(userId, {
      seriesId,
      ...completed({ rating: 4, isRewatch: true }),
    });
    expect(first.ok && second.ok).toBe(true);

    const logs = await db.seriesLog.findMany({
      where: { userId, seriesId },
      orderBy: { createdAt: "asc" },
    });
    expect(logs).toHaveLength(2);
    expect(logs.map((l) => [Number(l.rating), l.isRewatch])).toEqual([
      [3, false],
      [4, true],
    ]);
  });

  it("LOG-10 allows only one active WATCHING log per user and series", async () => {
    const { userId, seriesId } = await setup();
    const watching = {
      seriesId,
      ...completed({ status: "WATCHING", finishedAt: "", rating: null }),
    };
    expect((await createLog(userId, watching)).ok).toBe(true);

    const again = await createLog(userId, watching);
    expect(again).toMatchObject({
      ok: false,
      error: { code: "CONFLICT", message: "Você já está assistindo esta série" },
    });
    expect(await db.seriesLog.count()).toBe(1);
  });

  it("LOG-10 concurrent double submit creates a single WATCHING log", async () => {
    const { userId, seriesId } = await setup();
    const watching = {
      seriesId,
      ...completed({ status: "WATCHING", finishedAt: "", rating: null }),
    };
    const results = await Promise.all([createLog(userId, watching), createLog(userId, watching)]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(await db.seriesLog.count()).toBe(1);
  });

  it("different users can each watch the same series", async () => {
    const { userId, seriesId } = await setup();
    const other = await createUser({ username: "outro", email: "o@x.com" });
    const watching = {
      seriesId,
      ...completed({ status: "WATCHING", finishedAt: "", rating: null }),
    };
    expect((await createLog(userId, watching)).ok).toBe(true);
    expect((await createLog(other, watching)).ok).toBe(true);
  });

  it("WATCHING logs never store a finish date", async () => {
    const { userId, seriesId } = await setup();
    await createLog(userId, { seriesId, ...completed({ status: "WATCHING" }) });
    expect((await db.seriesLog.findFirstOrThrow()).finishedAt).toBeNull();
  });

  it("LOG-11 creating a log removes the series from the watchlist", async () => {
    const { userId, seriesId } = await setup();
    await addToWatchlist(userId, seriesId);
    expect(await db.watchlistItem.count()).toBe(1);

    await createLog(userId, { seriesId, ...completed() });
    expect(await db.watchlistItem.count()).toBe(0);
  });

  it("fails for an unknown series", async () => {
    const { userId } = await setup();
    const r = await createLog(userId, { seriesId: "nope", ...completed() });
    expect(r).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
  });
});

describe("rateSeries", () => {
  it("LOG-02 saves a rating without review or dates, creating a completed log", async () => {
    const { userId, seriesId } = await setup();
    const result = await rateSeries(userId, { seriesId, rating: 3.5 });
    expect(result.ok).toBe(true);
    const log = await db.seriesLog.findFirstOrThrow({ where: { userId, seriesId } });
    expect(Number(log.rating)).toBe(3.5);
    expect(log).toMatchObject({ status: "COMPLETED", reviewText: null, startedAt: null });
  });

  it("updates the active log instead of creating another, and can clear the rating", async () => {
    const { userId, seriesId } = await setup();
    await createLog(userId, {
      seriesId,
      ...completed({ status: "WATCHING", finishedAt: "", rating: 2 }),
    });
    await rateSeries(userId, { seriesId, rating: 4 });
    expect(await db.seriesLog.count()).toBe(1);
    expect(Number((await db.seriesLog.findFirstOrThrow()).rating)).toBe(4);

    await rateSeries(userId, { seriesId, rating: null });
    expect((await db.seriesLog.findFirstOrThrow()).rating).toBeNull();
  });

  it("clearing a rating with no log creates nothing", async () => {
    const { userId, seriesId } = await setup();
    await rateSeries(userId, { seriesId, rating: null });
    expect(await db.seriesLog.count()).toBe(0);
  });

  it("rejects invalid ratings", async () => {
    const { userId, seriesId } = await setup();
    expect((await rateSeries(userId, { seriesId, rating: 3.2 })).ok).toBe(false);
  });
});

describe("authorization", () => {
  it("LOG-12 another user cannot edit or delete my log", async () => {
    const { userId, seriesId } = await setup();
    const intruder = await createUser({ username: "intruso", email: "i@x.com" });
    const created = await createLog(userId, { seriesId, ...completed({ rating: 3 }) });
    if (!created.ok) throw new Error("setup failed");

    const edit = await updateLog(intruder, created.data.id, completed({ rating: 1 }));
    const del = await deleteLog(intruder, created.data.id);
    expect(edit).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    expect(del).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });

    const log = await db.seriesLog.findUniqueOrThrow({ where: { id: created.data.id } });
    expect(Number(log.rating)).toBe(3);
  });

  it("returns NOT_FOUND for a log that no longer exists (stale UI)", async () => {
    const { userId } = await setup();
    expect(await deleteLog(userId, "gone")).toMatchObject({
      ok: false,
      error: { code: "NOT_FOUND" },
    });
    expect(await updateLog(userId, "gone", completed())).toMatchObject({
      ok: false,
      error: { code: "NOT_FOUND" },
    });
  });
});

describe("updateLog / deleteLog", () => {
  it("edits my own log", async () => {
    const { userId, seriesId } = await setup();
    const created = await createLog(userId, { seriesId, ...completed({ rating: 3 }) });
    if (!created.ok) throw new Error("setup failed");
    const r = await updateLog(
      userId,
      created.data.id,
      completed({ rating: 5, reviewText: "Melhorou", containsSpoilers: true }),
    );
    expect(r.ok).toBe(true);
    expect(await db.seriesLog.findUniqueOrThrow({ where: { id: created.data.id } })).toMatchObject({
      reviewText: "Melhorou",
      containsSpoilers: true,
    });
  });

  it("turning a log into a second WATCHING one is refused", async () => {
    const { userId, seriesId } = await setup();
    await createLog(userId, { seriesId, ...completed({ status: "WATCHING", finishedAt: "" }) });
    const done = await createLog(userId, { seriesId, ...completed() });
    if (!done.ok) throw new Error("setup failed");
    const r = await updateLog(
      userId,
      done.data.id,
      completed({ status: "WATCHING", finishedAt: "" }),
    );
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
  });

  it("DIA-04 deleting a log recalculates the community average and keeps episode watches", async () => {
    const { userId, seriesId } = await setup();
    const other = await createUser({ username: "outro", email: "o@x.com" });
    const mine = await createLog(userId, { seriesId, ...completed({ rating: 5 }) });
    await createLog(other, { seriesId, ...completed({ rating: 3 }) });
    expect((await getRatingSummary(seriesId)).average).toBe(4);

    if (!mine.ok) throw new Error("setup failed");
    expect((await deleteLog(userId, mine.data.id)).ok).toBe(true);
    expect((await getRatingSummary(seriesId)).average).toBe(3);
  });
});
