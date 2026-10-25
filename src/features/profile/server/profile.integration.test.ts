import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createSeries, createUser, resetDb } from "@/test/db";
import {
  getFavorites,
  getProfileCounters,
  getProfileUser,
  getRatingDistribution,
  getTopGenres,
} from "../queries/profile";
import { addFavorite, removeFavorite, reorderFavorites } from "./favorites";

beforeEach(resetDb);

const d = (s: string) => new Date(`${s}T00:00:00Z`);
const NOW = new Date("2026-06-15T12:00:00Z");

async function log(
  userId: string,
  seriesId: string,
  data: {
    finishedAt?: string;
    rating?: number;
    status?: "COMPLETED" | "WATCHING" | "DROPPED";
  } = {},
) {
  return db.seriesLog.create({
    data: {
      userId,
      seriesId,
      status: data.status ?? "COMPLETED",
      finishedAt: data.finishedAt ? d(data.finishedAt) : null,
      rating: data.rating ?? null,
    },
  });
}

async function seriesList(n: number) {
  const out = [];
  for (let i = 1; i <= n; i++) out.push(await createSeries(i, `Série ${i}`));
  return out;
}

describe("favorites", () => {
  it("PRO-03 keeps up to four favorites in the order they were picked", async () => {
    const userId = await createUser();
    const series = await seriesList(4);
    for (const s of series) expect((await addFavorite(userId, s.id)).ok).toBe(true);
    const favorites = await getFavorites(userId);
    expect(favorites.map((f) => [f.position, f.series.name])).toEqual([
      [1, "Série 1"],
      [2, "Série 2"],
      [3, "Série 3"],
      [4, "Série 4"],
    ]);
  });

  it("PRO-03 blocks a 5th favorite with 'Máximo de 4 favoritas'", async () => {
    const userId = await createUser();
    const series = await seriesList(5);
    for (const s of series.slice(0, 4)) await addFavorite(userId, s.id);
    expect(await addFavorite(userId, series[4].id)).toMatchObject({
      ok: false,
      error: { message: "Máximo de 4 favoritas" },
    });
    expect(await db.favoriteSeries.count()).toBe(4);
  });

  it("concurrent adds never exceed four or reuse a position", async () => {
    const userId = await createUser();
    const series = await seriesList(7);
    await Promise.all(series.map((s) => addFavorite(userId, s.id)));
    const rows = await db.favoriteSeries.findMany({
      where: { userId },
      orderBy: { position: "asc" },
    });
    expect(rows.map((r) => r.position)).toEqual([1, 2, 3, 4]);
  });

  it("rejects the same series twice", async () => {
    const userId = await createUser();
    const [s] = await seriesList(1);
    await addFavorite(userId, s.id);
    expect(await addFavorite(userId, s.id)).toMatchObject({
      ok: false,
      error: { code: "CONFLICT" },
    });
  });

  it("removing closes the gap, and a freed slot can be reused", async () => {
    const userId = await createUser();
    const series = await seriesList(5);
    for (const s of series.slice(0, 4)) await addFavorite(userId, s.id);
    await removeFavorite(userId, series[1].id);
    expect((await getFavorites(userId)).map((f) => [f.position, f.series.name])).toEqual([
      [1, "Série 1"],
      [2, "Série 3"],
      [3, "Série 4"],
    ]);
    expect((await addFavorite(userId, series[4].id)).ok).toBe(true);
    expect((await getFavorites(userId)).at(-1)?.position).toBe(4);
  });

  it("reorders, and refuses a stale set", async () => {
    const userId = await createUser();
    const series = await seriesList(3);
    for (const s of series) await addFavorite(userId, s.id);
    expect((await reorderFavorites(userId, [series[2].id, series[0].id, series[1].id])).ok).toBe(
      true,
    );
    expect((await getFavorites(userId)).map((f) => f.series.name)).toEqual([
      "Série 3",
      "Série 1",
      "Série 2",
    ]);

    expect(await reorderFavorites(userId, [series[0].id])).toMatchObject({
      ok: false,
      error: { code: "CONFLICT" },
    });
    expect((await getFavorites(userId)).map((f) => f.series.name)).toEqual([
      "Série 3",
      "Série 1",
      "Série 2",
    ]);
  });

  it("favorites are per user", async () => {
    const a = await createUser();
    const b = await createUser({ username: "outro", email: "o@x.com" });
    const [s] = await seriesList(1);
    await addFavorite(a, s.id);
    await addFavorite(b, s.id);
    await removeFavorite(a, s.id);
    expect(await getFavorites(b)).toHaveLength(1);
  });
});

describe("profile counters", () => {
  it("PRO-07 counts distinct series (4) and logs finished this year (2), rewatch included", async () => {
    const userId = await createUser();
    const s = await seriesList(4);
    await log(userId, s[0].id, { finishedAt: "2024-03-01" });
    await log(userId, s[0].id, { finishedAt: "2026-02-01" }); // rewatch of an earlier one
    await log(userId, s[1].id, { finishedAt: "2025-05-01" });
    await log(userId, s[2].id, { finishedAt: "2025-08-01" });
    await log(userId, s[3].id, { finishedAt: "2026-04-01" });

    const counters = await getProfileCounters(userId, null, NOW);
    expect(counters).toMatchObject({ seriesWatched: 4, thisYear: 2 });
  });

  it("ignores WATCHING and DROPPED logs", async () => {
    const userId = await createUser();
    const s = await seriesList(3);
    await log(userId, s[0].id, { status: "WATCHING" });
    await log(userId, s[1].id, { status: "DROPPED", finishedAt: "2026-01-01" });
    await log(userId, s[2].id, { finishedAt: "2026-01-01" });
    expect(await getProfileCounters(userId, null, NOW)).toMatchObject({
      seriesWatched: 1,
      thisYear: 1,
    });
  });

  it("the year boundary follows São Paulo time", async () => {
    const userId = await createUser();
    const [s] = await seriesList(1);
    await log(userId, s.id, { finishedAt: "2025-12-31" });
    // 02:00Z on 2026-01-01 is still 2025-12-31 in São Paulo.
    const nyeInBrazil = new Date("2026-01-01T02:00:00Z");
    expect((await getProfileCounters(userId, null, nyeInBrazil)).thisYear).toBe(1);
    expect((await getProfileCounters(userId, null, NOW)).thisYear).toBe(0);
  });

  it("counts only public lists for visitors, all for the owner", async () => {
    const userId = await createUser();
    const visitor = await createUser({ username: "visita", email: "v@x.com" });
    await db.seriesList.createMany({
      data: [
        { userId, title: "Pública", slug: "publica", isPublic: true },
        { userId, title: "Privada", slug: "privada", isPublic: false },
      ],
    });
    expect((await getProfileCounters(userId, visitor)).lists).toBe(1);
    expect((await getProfileCounters(userId, null)).lists).toBe(1);
    expect((await getProfileCounters(userId, userId)).lists).toBe(2);
  });
});

describe("profile stats", () => {
  it("builds the rating distribution from the user's own logs", async () => {
    const userId = await createUser();
    const other = await createUser({ username: "outro", email: "o@x.com" });
    const s = await seriesList(4);
    await log(userId, s[0].id, { finishedAt: "2026-01-01", rating: 5 });
    await log(userId, s[1].id, { finishedAt: "2026-01-01", rating: 4 });
    await log(userId, s[2].id, { finishedAt: "2026-01-01", rating: 4 });
    await log(userId, s[3].id, { finishedAt: "2026-01-01" });
    await log(other, s[0].id, { finishedAt: "2026-01-01", rating: 1 });

    const dist = await getRatingDistribution(userId);
    expect(dist).toMatchObject({ total: 3, average: 4.3 });
    expect(dist.histogram.find((b) => b.rating === 4)?.count).toBe(2);
    expect(
      await getRatingDistribution(await createUser({ username: "novo", email: "n@x.com" })),
    ).toMatchObject({
      total: 0,
      average: null,
    });
  });

  it("lists top genres of completed series by distinct series", async () => {
    const userId = await createUser();
    const s = await seriesList(4);
    await db.genre.createMany({
      data: [
        { id: 18, name: "Drama" },
        { id: 35, name: "Comédia" },
        { id: 80, name: "Crime" },
      ],
    });
    await db.seriesGenre.createMany({
      data: [
        { seriesId: s[0].id, genreId: 18 },
        { seriesId: s[1].id, genreId: 18 },
        { seriesId: s[2].id, genreId: 35 },
        { seriesId: s[0].id, genreId: 80 },
        { seriesId: s[3].id, genreId: 80 }, // not completed: ignored
      ],
    });
    await log(userId, s[0].id, { finishedAt: "2026-01-01" });
    await log(userId, s[0].id, { finishedAt: "2026-02-01" }); // rewatch must not double-count
    await log(userId, s[1].id, { finishedAt: "2026-01-01" });
    await log(userId, s[2].id, { finishedAt: "2026-01-01" });
    await log(userId, s[3].id, { status: "WATCHING" });

    expect(await getTopGenres(userId)).toEqual([
      { id: 18, name: "Drama", count: 2 },
      // ties are broken by name
      { id: 35, name: "Comédia", count: 1 },
      { id: 80, name: "Crime", count: 1 },
    ]);
  });

  it("finds users case-insensitively and returns null for unknown usernames", async () => {
    await createUser();
    expect((await getProfileUser("FULANO"))?.username).toBe("fulano");
    expect(await getProfileUser("naoexiste")).toBeNull();
  });
});
