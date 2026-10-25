import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createUser, resetDb } from "@/test/db";
import { getRatingSummary, getRecentReviews } from "./series";

beforeEach(resetDb);

async function seedSeries() {
  return db.series.create({
    data: {
      tmdbId: 1,
      name: "S",
      originalName: "S",
      status: "Ended",
      lastSyncedAt: new Date(),
    },
  });
}

async function logFor(seriesId: string, n: number, rating: number | null, extra = {}) {
  const userId = await createUser({ username: `user${n}`, email: `u${n}@x.com` });
  return db.seriesLog.create({
    data: { userId, seriesId, status: "COMPLETED", finishedAt: new Date(), rating, ...extra },
  });
}

describe("getRatingSummary", () => {
  it("SER-04 averages 5.0, 4.0 and 3.5 to 4.2 with a per-half-star histogram", async () => {
    const series = await seedSeries();
    await logFor(series.id, 1, 5);
    await logFor(series.id, 2, 4);
    await logFor(series.id, 3, 3.5);

    const summary = await getRatingSummary(series.id);
    expect(summary.average).toBe(4.2);
    expect(summary.total).toBe(3);
    const count = (r: number) => summary.histogram.find((b) => b.rating === r)?.count;
    expect([count(5), count(4), count(3.5), count(4.5)]).toEqual([1, 1, 1, 0]);
  });

  it("has no average when there are no ratings (unrated logs are ignored)", async () => {
    const series = await seedSeries();
    await logFor(series.id, 1, null);
    const summary = await getRatingSummary(series.id);
    expect(summary).toMatchObject({ average: null, total: 0 });
  });
});

describe("getRecentReviews", () => {
  it("returns only logs with review text, newest first, with spoiler flag", async () => {
    const series = await seedSeries();
    await logFor(series.id, 1, 4);
    await logFor(series.id, 2, 4, { reviewText: "Ótima", containsSpoilers: true });
    const reviews = await getRecentReviews(series.id);
    expect(reviews).toHaveLength(1);
    expect(reviews[0]).toMatchObject({ reviewText: "Ótima", containsSpoilers: true });
  });
});
