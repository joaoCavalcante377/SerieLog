import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createSeries, createUser, resetDb } from "@/test/db";
import { parseWatchlistParams } from "../schemas/watchlist";
import { getWatchlistPage, resolveWatchlistAccess } from "../queries/watchlist";
import { addToWatchlist, removeFromWatchlist, setWatchlistPublic } from "./watchlist";

beforeEach(resetDb);

describe("watchlist", () => {
  it("WAT-01 adds and removes", async () => {
    const userId = await createUser();
    const s = await createSeries(1);
    expect((await addToWatchlist(userId, s.id)).ok).toBe(true);
    expect(await db.watchlistItem.count()).toBe(1);
    expect((await removeFromWatchlist(userId, s.id)).ok).toBe(true);
    expect(await db.watchlistItem.count()).toBe(0);
  });

  it("WAT-02 is idempotent, including concurrent adds", async () => {
    const userId = await createUser();
    const s = await createSeries(1);
    await addToWatchlist(userId, s.id);
    await addToWatchlist(userId, s.id);
    await Promise.all([addToWatchlist(userId, s.id), addToWatchlist(userId, s.id)]);
    expect(await db.watchlistItem.count()).toBe(1);
  });

  it("removing something not on the list is a no-op", async () => {
    const userId = await createUser();
    const s = await createSeries(1);
    expect((await removeFromWatchlist(userId, s.id)).ok).toBe(true);
  });

  it("rejects an unknown series", async () => {
    const userId = await createUser();
    expect(await addToWatchlist(userId, "nope")).toMatchObject({
      ok: false,
      error: { code: "NOT_FOUND" },
    });
  });

  it("only touches the acting user's list", async () => {
    const a = await createUser();
    const b = await createUser({ username: "outro", email: "o@x.com" });
    const s = await createSeries(1);
    await addToWatchlist(a, s.id);
    await addToWatchlist(b, s.id);
    await removeFromWatchlist(b, s.id);
    expect(await db.watchlistItem.count({ where: { userId: a } })).toBe(1);
  });
});

describe("getWatchlistPage", () => {
  async function seed() {
    const userId = await createUser();
    const drama = await db.genre.create({ data: { id: 18, name: "Drama" } });
    const comedia = await db.genre.create({ data: { id: 35, name: "Comédia" } });
    const specs = [
      { tmdbId: 1, name: "Zeta", year: "2010-01-01", genre: drama.id },
      { tmdbId: 2, name: "Alfa", year: "2020-01-01", genre: comedia.id },
      { tmdbId: 3, name: "Meio", year: "2015-01-01", genre: drama.id },
    ];
    for (const [i, spec] of specs.entries()) {
      const s = await createSeries(spec.tmdbId, spec.name, spec.year);
      await db.seriesGenre.create({ data: { seriesId: s.id, genreId: spec.genre } });
      await db.watchlistItem.create({
        data: { userId, seriesId: s.id, addedAt: new Date(Date.UTC(2026, 0, 1 + i)) },
      });
    }
    return userId;
  }

  const names = async (userId: string, raw: Record<string, string>) =>
    (await getWatchlistPage(userId, parseWatchlistParams(raw))).items.map((i) => i.series.name);

  it("WAT-03 sorts by date added (newest first), year and title", async () => {
    const userId = await seed();
    expect(await names(userId, {})).toEqual(["Meio", "Alfa", "Zeta"]);
    expect(await names(userId, { sort: "year" })).toEqual(["Alfa", "Meio", "Zeta"]);
    expect(await names(userId, { sort: "title" })).toEqual(["Alfa", "Meio", "Zeta"]);
  });

  it("WAT-03 filters by genre and lists available genres", async () => {
    const userId = await seed();
    expect(await names(userId, { genre: "18", sort: "title" })).toEqual(["Meio", "Zeta"]);
    const page = await getWatchlistPage(userId, parseWatchlistParams({}));
    expect(page.genres.map((g) => g.name)).toEqual(["Comédia", "Drama"]);
    expect(page.total).toBe(3);
  });
});

describe("watchlist privacy", () => {
  it("WAT-04 a private watchlist is hidden from others but not from its owner", async () => {
    const owner = await createUser();
    const visitor = await createUser({ username: "visita", email: "v@x.com" });
    expect((await setWatchlistPublic(owner, false)).ok).toBe(true);

    expect(await resolveWatchlistAccess("fulano", visitor)).toEqual({
      status: "private",
      name: "Fulano",
    });
    expect(await resolveWatchlistAccess("fulano", null)).toMatchObject({ status: "private" });
    expect(await resolveWatchlistAccess("FULANO", owner)).toMatchObject({
      status: "ok",
      isOwner: true,
    });
  });

  it("is public by default and unknown users are not found", async () => {
    const owner = await createUser();
    const visitor = await createUser({ username: "visita", email: "v@x.com" });
    expect(await resolveWatchlistAccess("fulano", visitor)).toMatchObject({
      status: "ok",
      isOwner: false,
      userId: owner,
    });
    expect(await resolveWatchlistAccess("naoexiste", null)).toEqual({ status: "not_found" });
  });
});
