import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createSeries, createUser, resetDb } from "@/test/db";
import { getListView, getListsForSeries, getPopularLists, getUserLists } from "../queries/lists";
import {
  addItem,
  createList,
  deleteList,
  removeItem,
  reorderItems,
  updateItemNote,
  updateList,
} from "./lists";

beforeEach(resetDb);

const input = (title = "Melhores dramas", over: Record<string, unknown> = {}) => ({
  title,
  description: "",
  isPublic: true,
  isRanked: false,
  ...over,
});

async function setup(seriesCount = 3) {
  const userId = await createUser();
  const series = [];
  for (let i = 1; i <= seriesCount; i++) series.push(await createSeries(i, `Série ${i}`));
  const created = await createList(userId, input());
  if (!created.ok) throw new Error("setup failed");
  return { userId, listId: created.data.id, series };
}

const positions = async (listId: string) =>
  (
    await db.seriesListItem.findMany({
      where: { listId },
      orderBy: { position: "asc" },
      include: { series: { select: { name: true } } },
    })
  ).map((i) => [i.position, i.series.name]);

describe("createList", () => {
  it("LST-01 creates a list with slug and positions 1..3", async () => {
    const { userId, listId, series } = await setup();
    for (const s of series) await addItem(userId, listId, s.id);
    const list = await db.seriesList.findUniqueOrThrow({ where: { id: listId } });
    expect(list.slug).toBe("melhores-dramas");
    expect(await positions(listId)).toEqual([
      [1, "Série 1"],
      [2, "Série 2"],
      [3, "Série 3"],
    ]);
  });

  it("LST-02 appends -2, -3 on slug collisions (per user)", async () => {
    const userId = await createUser();
    const other = await createUser({ username: "outro", email: "o@x.com" });
    const slugs = [];
    for (let i = 0; i < 3; i++) {
      const r = await createList(userId, input());
      slugs.push(r.ok && r.data.slug);
    }
    expect(slugs).toEqual(["melhores-dramas", "melhores-dramas-2", "melhores-dramas-3"]);

    const theirs = await createList(other, input());
    expect(theirs.ok && theirs.data.slug).toBe("melhores-dramas"); // slugs are unique per user only
  });

  it("concurrent creates with the same title end up with distinct slugs", async () => {
    const userId = await createUser();
    const results = await Promise.all([
      createList(userId, input()),
      createList(userId, input()),
      createList(userId, input()),
    ]);
    const slugs = results.map((r) => r.ok && r.data.slug);
    expect(new Set(slugs).size).toBe(3);
  });

  it("slugifies accents and punctuation", async () => {
    const userId = await createUser();
    const r = await createList(userId, input("Ação & Aventura!"));
    expect(r.ok && r.data.slug).toBe("acao-aventura");
  });

  it("validates title and description", async () => {
    const userId = await createUser();
    expect(await createList(userId, input(""))).toMatchObject({
      ok: false,
      error: { fieldErrors: { title: "Informe um título" } },
    });
    expect((await createList(userId, input("x".repeat(101)))).ok).toBe(false);
    expect((await createList(userId, input("ok", { description: "x".repeat(1001) }))).ok).toBe(
      false,
    );
    expect((await createList(userId, input("x".repeat(100)))).ok).toBe(true);
    expect(await db.seriesList.count()).toBe(1);
  });
});

describe("addItem", () => {
  it("LST-03 rejects a series already in the list and changes nothing", async () => {
    const { userId, listId, series } = await setup();
    await addItem(userId, listId, series[0].id);
    const again = await addItem(userId, listId, series[0].id);
    expect(again).toMatchObject({
      ok: false,
      error: { code: "CONFLICT", message: "Esta série já está na lista" },
    });
    expect(await db.seriesListItem.count()).toBe(1);
  });

  it("concurrent adds of different series get distinct, contiguous positions", async () => {
    const { userId, listId, series } = await setup(5);
    await Promise.all(series.map((s) => addItem(userId, listId, s.id)));
    const rows = await db.seriesListItem.findMany({
      where: { listId },
      orderBy: { position: "asc" },
    });
    expect(rows.map((r) => r.position)).toEqual([1, 2, 3, 4, 5]);
  });

  it("concurrent duplicate adds keep a single row", async () => {
    const { userId, listId, series } = await setup(1);
    await Promise.all([
      addItem(userId, listId, series[0].id),
      addItem(userId, listId, series[0].id),
    ]);
    expect(await db.seriesListItem.count()).toBe(1);
  });

  it("LST-06 refuses the 501st series", async () => {
    const { userId, listId, series } = await setup(1);
    const extra = await createSeries(9999, "Extra");
    const bulk = Array.from({ length: 500 }, (_, i) => ({
      listId,
      seriesId: series[0].id,
      position: i + 1,
    }));
    // 500 rows need 500 distinct series: create them in bulk.
    await db.series.createMany({
      data: Array.from({ length: 499 }, (_, i) => ({
        tmdbId: 100_000 + i,
        name: `S${i}`,
        originalName: `S${i}`,
        status: "Ended",
        lastSyncedAt: new Date(),
      })),
    });
    const all = await db.series.findMany({
      where: { tmdbId: { gte: 100_000 } },
      select: { id: true },
    });
    await db.seriesListItem.createMany({
      data: [...all.map((s) => s.id), series[0].id].map((seriesId, i) => ({
        listId,
        seriesId,
        position: i + 1,
      })),
    });
    expect(bulk).toHaveLength(500);
    expect(await db.seriesListItem.count({ where: { listId } })).toBe(500);

    const result = await addItem(userId, listId, extra.id);
    expect(result).toMatchObject({
      ok: false,
      error: { message: "Limite de 500 séries por lista" },
    });
    expect(await db.seriesListItem.count({ where: { listId } })).toBe(500);
  });

  it("limits notes to 280 characters", async () => {
    const { userId, listId, series } = await setup();
    expect((await addItem(userId, listId, series[0].id, "x".repeat(281))).ok).toBe(false);
    expect((await addItem(userId, listId, series[0].id, "x".repeat(280))).ok).toBe(true);
  });

  it("fails for an unknown series", async () => {
    const { userId, listId } = await setup();
    expect(await addItem(userId, listId, "nope")).toMatchObject({
      ok: false,
      error: { code: "NOT_FOUND" },
    });
  });
});

describe("reorderItems / removeItem", () => {
  it("LST-04 reordering persists with contiguous positions (item 3 → position 1)", async () => {
    const { userId, listId, series } = await setup();
    for (const s of series) await addItem(userId, listId, s.id);

    const r = await reorderItems(userId, listId, [series[2].id, series[0].id, series[1].id]);
    expect(r.ok).toBe(true);
    expect(await positions(listId)).toEqual([
      [1, "Série 3"],
      [2, "Série 1"],
      [3, "Série 2"],
    ]);
  });

  it("can swap two items (needs the deferrable unique constraint)", async () => {
    const { userId, listId, series } = await setup(2);
    for (const s of series) await addItem(userId, listId, s.id);
    expect((await reorderItems(userId, listId, [series[1].id, series[0].id])).ok).toBe(true);
    expect(await positions(listId)).toEqual([
      [1, "Série 2"],
      [2, "Série 1"],
    ]);
  });

  it("refuses a stale or invalid order and leaves the list unchanged", async () => {
    const { userId, listId, series } = await setup();
    for (const s of series) await addItem(userId, listId, s.id);
    const before = await positions(listId);

    for (const bad of [
      [series[0].id, series[1].id], // missing one
      [series[0].id, series[1].id, series[1].id], // duplicate
      [series[0].id, series[1].id, "other"], // unknown
    ]) {
      expect(await reorderItems(userId, listId, bad)).toMatchObject({
        ok: false,
        error: { code: "CONFLICT" },
      });
    }
    expect(await positions(listId)).toEqual(before);
  });

  it("removing an item keeps positions contiguous", async () => {
    const { userId, listId, series } = await setup();
    for (const s of series) await addItem(userId, listId, s.id);
    await removeItem(userId, listId, series[0].id);
    expect(await positions(listId)).toEqual([
      [1, "Série 2"],
      [2, "Série 3"],
    ]);
    // Re-adding goes to the end.
    await addItem(userId, listId, series[0].id);
    expect((await positions(listId)).at(-1)).toEqual([3, "Série 1"]);
  });

  it("updates an item note", async () => {
    const { userId, listId, series } = await setup();
    await addItem(userId, listId, series[0].id);
    expect((await updateItemNote(userId, listId, series[0].id, "  Clássico ")).ok).toBe(true);
    expect((await db.seriesListItem.findFirstOrThrow()).note).toBe("Clássico");
    expect((await updateItemNote(userId, listId, series[1].id, "x")).ok).toBe(false);
  });
});

describe("authorization", () => {
  it("LST-07 another user cannot edit, delete or change items of my list", async () => {
    const { userId, listId, series } = await setup();
    const intruder = await createUser({ username: "intruso", email: "i@x.com" });
    await addItem(userId, listId, series[0].id);

    const attempts = await Promise.all([
      updateList(intruder, listId, input("Hackeada")),
      deleteList(intruder, listId),
      addItem(intruder, listId, series[1].id),
      removeItem(intruder, listId, series[0].id),
      reorderItems(intruder, listId, [series[0].id]),
      updateItemNote(intruder, listId, series[0].id, "x"),
    ]);
    for (const r of attempts) expect(r).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });

    const list = await db.seriesList.findUniqueOrThrow({ where: { id: listId } });
    expect(list.title).toBe("Melhores dramas");
    expect(await db.seriesListItem.count({ where: { listId } })).toBe(1);
  });

  it("returns NOT_FOUND for a list that no longer exists (stale UI)", async () => {
    const userId = await createUser();
    expect(await deleteList(userId, "gone")).toMatchObject({
      ok: false,
      error: { code: "NOT_FOUND" },
    });
  });
});

describe("updateList / deleteList", () => {
  it("edits metadata without changing the slug", async () => {
    const { userId, listId } = await setup();
    await updateList(
      userId,
      listId,
      input("Outro título", { isRanked: true, isPublic: false, description: "Desc" }),
    );
    expect(await db.seriesList.findUniqueOrThrow({ where: { id: listId } })).toMatchObject({
      title: "Outro título",
      slug: "melhores-dramas",
      isRanked: true,
      isPublic: false,
      description: "Desc",
    });
  });

  it("LST-08 deleting removes the list and its items but not my logs or the series", async () => {
    const { userId, listId, series } = await setup();
    for (const s of series) await addItem(userId, listId, s.id);
    await db.seriesLog.create({
      data: { userId, seriesId: series[0].id, status: "COMPLETED", finishedAt: new Date() },
    });

    expect((await deleteList(userId, listId)).ok).toBe(true);
    expect(await db.seriesList.count()).toBe(0);
    expect(await db.seriesListItem.count()).toBe(0);
    expect(await db.seriesLog.count()).toBe(1);
    expect(await db.series.count()).toBe(3);
  });
});

describe("visibility", () => {
  it("LST-05 a private list is a 404 (null) for others and logged-out visitors, visible to the owner", async () => {
    const { userId, listId } = await setup();
    const visitor = await createUser({ username: "visita", email: "v@x.com" });
    await updateList(userId, listId, input("Melhores dramas", { isPublic: false }));

    expect(await getListView("fulano", "melhores-dramas", visitor)).toBeNull();
    expect(await getListView("fulano", "melhores-dramas", null)).toBeNull();
    expect(await getListView("fulano", "melhores-dramas", userId)).toMatchObject({ isOwner: true });
  });

  it("public lists are visible to everyone; unknown users and slugs are null", async () => {
    await setup();
    expect(await getListView("FULANO", "melhores-dramas", null)).toMatchObject({ isOwner: false });
    expect(await getListView("fulano", "nao-existe", null)).toBeNull();
    expect(await getListView("ninguem", "melhores-dramas", null)).toBeNull();
  });

  it("lists are ordered by position when read", async () => {
    const { userId, listId, series } = await setup();
    for (const s of series) await addItem(userId, listId, s.id);
    await reorderItems(userId, listId, [series[1].id, series[2].id, series[0].id]);
    const view = await getListView("fulano", "melhores-dramas", null);
    expect(view?.list.items.map((i) => i.series.name)).toEqual(["Série 2", "Série 3", "Série 1"]);
  });

  it("getUserLists hides private lists from others; getPopularLists only shows public ones", async () => {
    const { userId } = await setup();
    await createList(userId, input("Secreta", { isPublic: false }));
    const visitor = await createUser({ username: "visita", email: "v@x.com" });

    expect((await getUserLists(userId, visitor)).map((l) => l.title)).toEqual(["Melhores dramas"]);
    expect(await getUserLists(userId, userId)).toHaveLength(2);
    expect((await getPopularLists()).lists.map((l) => l.title)).toEqual(["Melhores dramas"]);
  });

  it("getListsForSeries flags which of my lists contain the series", async () => {
    const { userId, listId, series } = await setup();
    await createList(userId, input("Outra"));
    await addItem(userId, listId, series[0].id);
    const lists = await getListsForSeries(userId, series[0].id);
    expect(lists.map((l) => [l.title, l.hasSeries, l.itemCount]).sort()).toEqual([
      ["Melhores dramas", true, 1],
      ["Outra", false, 0],
    ]);
  });
});
