import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createSeries, createUser, resetDb } from "@/test/db";
import { parseDiaryFilters } from "../schemas/diary";
import { getDiaryPage } from "./diary";

beforeEach(resetDb);

const d = (s: string) => new Date(`${s}T00:00:00Z`);
const filters = (raw: Record<string, string> = {}) => parseDiaryFilters(raw);

async function addLog(
  userId: string,
  seriesId: string,
  data: {
    finishedAt?: string;
    startedAt?: string;
    rating?: number;
    status?: "WATCHING" | "COMPLETED" | "DROPPED";
  },
) {
  return db.seriesLog.create({
    data: {
      userId,
      seriesId,
      status: data.status ?? "COMPLETED",
      finishedAt: data.finishedAt ? d(data.finishedAt) : null,
      startedAt: data.startedAt ? d(data.startedAt) : null,
      rating: data.rating ?? null,
    },
  });
}

describe("getDiaryPage", () => {
  it("DIA-01 returns logs newest first across months", async () => {
    const userId = await createUser();
    const a = await createSeries(1, "A");
    const b = await createSeries(2, "B");
    const c = await createSeries(3, "C");
    await addLog(userId, a.id, { finishedAt: "2026-01-10" });
    await addLog(userId, b.id, { finishedAt: "2026-03-05" });
    await addLog(userId, c.id, { finishedAt: "2026-02-20" });

    const { entries } = await getDiaryPage(userId, filters());
    expect(entries.map((e) => [e.seriesName, e.diaryDate])).toEqual([
      ["B", "2026-03-05"],
      ["C", "2026-02-20"],
      ["A", "2026-01-10"],
    ]);
  });

  it("files in-progress logs under their start date", async () => {
    const userId = await createUser();
    const a = await createSeries(1, "A");
    await addLog(userId, a.id, { status: "WATCHING", startedAt: "2026-04-01" });
    const { entries } = await getDiaryPage(userId, filters());
    expect(entries[0]).toMatchObject({ diaryDate: "2026-04-01", status: "WATCHING" });
  });

  it("DIA-02 is empty for a user with no logs", async () => {
    const userId = await createUser();
    expect(await getDiaryPage(userId, filters())).toEqual({ entries: [], hasMore: false });
  });

  it("DIA-03 filters by finish year", async () => {
    const userId = await createUser();
    const a = await createSeries(1, "A");
    const b = await createSeries(2, "B");
    await addLog(userId, a.id, { finishedAt: "2025-06-01" });
    await addLog(userId, b.id, { finishedAt: "2024-06-01" });
    const { entries } = await getDiaryPage(userId, filters({ year: "2025" }));
    expect(entries.map((e) => e.seriesName)).toEqual(["A"]);
  });

  it("filters by rating and status, and sorts by rating", async () => {
    const userId = await createUser();
    const a = await createSeries(1, "A");
    const b = await createSeries(2, "B");
    const c = await createSeries(3, "C");
    await addLog(userId, a.id, { finishedAt: "2026-01-01", rating: 3.5 });
    await addLog(userId, b.id, { finishedAt: "2026-02-01", rating: 5 });
    await addLog(userId, c.id, { status: "DROPPED", finishedAt: "2026-03-01" });

    expect(
      (await getDiaryPage(userId, filters({ rating: "3.5" }))).entries.map((e) => e.seriesName),
    ).toEqual(["A"]);
    expect(
      (await getDiaryPage(userId, filters({ status: "DROPPED" }))).entries.map((e) => e.seriesName),
    ).toEqual(["C"]);
    expect(
      (await getDiaryPage(userId, filters({ sort: "rating" }))).entries.map((e) => e.seriesName),
    ).toEqual(["B", "A", "C"]);
  });

  it("only returns the requested user's logs", async () => {
    const me = await createUser();
    const other = await createUser({ username: "outro", email: "o@x.com" });
    const s = await createSeries(1);
    await addLog(other, s.id, { finishedAt: "2026-01-01" });
    expect((await getDiaryPage(me, filters())).entries).toHaveLength(0);
  });

  it("DIA-05 pages 45 logs as 20 + 20 + 5 without duplicates", async () => {
    const userId = await createUser();
    const s = await createSeries(1);
    // Same finish date for many rows exercises the tie-breakers.
    for (let i = 0; i < 45; i++) {
      await addLog(userId, s.id, {
        finishedAt: i % 3 === 0 ? "2026-01-01" : `2026-01-${String((i % 28) + 1).padStart(2, "0")}`,
      });
    }
    const p1 = await getDiaryPage(userId, filters(), 0);
    const p2 = await getDiaryPage(userId, filters(), 20);
    const p3 = await getDiaryPage(userId, filters(), 40);

    expect([p1.entries.length, p2.entries.length, p3.entries.length]).toEqual([20, 20, 5]);
    expect([p1.hasMore, p2.hasMore, p3.hasMore]).toEqual([true, true, false]);
    const ids = [...p1.entries, ...p2.entries, ...p3.entries].map((e) => e.id);
    expect(new Set(ids).size).toBe(45);
  });
});
