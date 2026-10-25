import { beforeEach, describe, expect, it, vi } from "vitest";

// Server Actions are thin: authenticate → delegate → revalidate. Session, cache and TMDB are faked,
// everything else (validation, authorization, database) is real.
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
  revalidatePath: vi.fn(),
  getOrSyncSeries: vi.fn(),
}));

// next-auth cannot be loaded outside Next, so only the error class the action checks for is faked.
vi.mock("next-auth", () => ({ AuthError: class AuthError extends Error {} }));
vi.mock("@/auth", () => ({ auth: mocks.auth, signIn: mocks.signIn, signOut: mocks.signOut }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": "9.9.9.9" }),
}));
vi.mock("@/features/series/server/sync", () => ({ getOrSyncSeries: mocks.getOrSyncSeries }));

import { AuthError } from "next-auth";
import { db } from "@/lib/db";
import { createSeries, createSeriesWithEpisodes, createUser, resetDb } from "@/test/db";
import { loginAction, logoutAction, signUpAction } from "./auth/actions/auth-actions";
import {
  createListAction,
  deleteListAction,
  addSeriesToListAction,
  removeListItemAction,
  reorderListAction,
  setSeriesInListAction,
  updateListAction,
  updateListItemNoteAction,
} from "./lists/actions/list-actions";
import {
  createLogAction,
  deleteLogAction,
  loadDiaryPageAction,
  rateSeriesAction,
  updateLogAction,
} from "./logs/actions/log-actions";
import {
  completeSeriesAction,
  markSeasonAction,
  markSeriesAction,
  rateSeasonAction,
  resumeWatchingAction,
  toggleEpisodeAction,
} from "./progress/actions/progress-actions";
import {
  addFavoriteAction,
  removeFavoriteAction,
  reorderFavoritesAction,
} from "./profile/actions/favorites-actions";
import {
  changePasswordAction,
  deleteAccountAction,
  updateProfileAction,
} from "./profile/actions/profile-actions";
import {
  addToWatchlistAction,
  removeFromWatchlistAction,
  setWatchlistPublicAction,
} from "./watchlist/actions/watchlist-actions";

const PAST = "2020-01-01";

beforeEach(async () => {
  await resetDb();
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue(null);
  mocks.signIn.mockResolvedValue(undefined);
  mocks.getOrSyncSeries.mockImplementation(async (tmdbId: number) =>
    db.series.findUnique({ where: { tmdbId } }),
  );
});

const signedInAs = (userId: string) => mocks.auth.mockResolvedValue({ user: { id: userId } });

const logInput = (seriesId: string, over: Record<string, unknown> = {}) => ({
  seriesId,
  status: "COMPLETED" as const,
  finishedAt: PAST,
  reviewText: "",
  containsSpoilers: false,
  isRewatch: false,
  ...over,
});

describe("every write action refuses anonymous callers", () => {
  const listInput = { title: "x", description: "", isPublic: true, isRanked: false };
  const calls: [string, () => Promise<{ ok: boolean; error?: { code: string } }>][] = [
    ["createLogAction", () => createLogAction(logInput("s"))],
    ["updateLogAction", () => updateLogAction("l", logInput("s"))],
    ["deleteLogAction", () => deleteLogAction("l")],
    ["rateSeriesAction", () => rateSeriesAction("s", 3)],
    ["toggleEpisodeAction", () => toggleEpisodeAction("e", true)],
    ["markSeasonAction", () => markSeasonAction("s", true)],
    ["markSeriesAction", () => markSeriesAction("s", true)],
    ["completeSeriesAction", () => completeSeriesAction("s")],
    ["resumeWatchingAction", () => resumeWatchingAction("s")],
    ["rateSeasonAction", () => rateSeasonAction("s", 3)],
    ["addToWatchlistAction", () => addToWatchlistAction("s")],
    ["removeFromWatchlistAction", () => removeFromWatchlistAction("s")],
    ["setWatchlistPublicAction", () => setWatchlistPublicAction(false)],
    ["createListAction", () => createListAction(listInput)],
    ["updateListAction", () => updateListAction("l", listInput)],
    ["deleteListAction", () => deleteListAction("l")],
    ["addSeriesToListAction", () => addSeriesToListAction("l", 1)],
    ["setSeriesInListAction", () => setSeriesInListAction("l", "s", true)],
    ["removeListItemAction", () => removeListItemAction("l", "s")],
    ["reorderListAction", () => reorderListAction("l", [])],
    ["updateListItemNoteAction", () => updateListItemNoteAction("l", "s", "n")],
    ["addFavoriteAction", () => addFavoriteAction(1)],
    ["removeFavoriteAction", () => removeFavoriteAction("s")],
    ["reorderFavoritesAction", () => reorderFavoritesAction([])],
    [
      "updateProfileAction",
      () => updateProfileAction({ name: "a", username: "abc", bio: "", image: "" }),
    ],
    [
      "changePasswordAction",
      () => changePasswordAction({ currentPassword: "a", newPassword: "senha1234" }),
    ],
    ["deleteAccountAction", () => deleteAccountAction({ confirmUsername: "x" })],
  ];

  it.each(calls)("%s → UNAUTHENTICATED and never revalidates", async (_name, call) => {
    const result = await call();
    expect(result).toMatchObject({ ok: false, error: { code: "UNAUTHENTICATED" } });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
    expect(await db.seriesLog.count()).toBe(0);
    expect(await db.seriesList.count()).toBe(0);
  });

  it("loadDiaryPageAction needs a session for your own diary but not for a public one", async () => {
    expect(await loadDiaryPageAction({ filters: { sort: "date" }, offset: 0 })).toMatchObject({
      ok: false,
      error: { code: "UNAUTHENTICATED" },
    });
    await createUser();
    expect(
      await loadDiaryPageAction({ username: "fulano", filters: { sort: "date" }, offset: 0 }),
    ).toMatchObject({ ok: true, data: { entries: [], canEdit: false } });
    expect(
      await loadDiaryPageAction({ username: "ninguem", filters: { sort: "date" }, offset: 0 }),
    ).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
  });
});

describe("logs, ratings and diary", () => {
  it("creates, edits, rates, lists and deletes a log, revalidating on success only", async () => {
    const userId = await createUser();
    signedInAs(userId);
    const series = await createSeries(1);

    const created = await createLogAction(logInput(series.id, { rating: 4 }));
    expect(created.ok).toBe(true);
    expect(mocks.revalidatePath).toHaveBeenCalled();
    const logId = created.ok ? created.data.id : "";

    mocks.revalidatePath.mockClear();
    const bad = await createLogAction(logInput(series.id, { finishedAt: "2999-01-01" }));
    expect(bad.ok).toBe(false);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();

    expect((await updateLogAction(logId, logInput(series.id, { rating: 5 }))).ok).toBe(true);
    expect((await rateSeriesAction(series.id, 2.5)).ok).toBe(true);
    expect(Number((await db.seriesLog.findUniqueOrThrow({ where: { id: logId } })).rating)).toBe(
      2.5,
    );

    const diary = await loadDiaryPageAction({ filters: { sort: "date" }, offset: 0 });
    expect(diary).toMatchObject({ ok: true, data: { canEdit: true, hasMore: false } });
    expect(diary.ok && diary.data.entries).toHaveLength(1);

    expect((await deleteLogAction(logId)).ok).toBe(true);
    expect(await db.seriesLog.count()).toBe(0);
  });

  it("a user cannot edit or delete another user's log through the actions (FORBIDDEN)", async () => {
    const owner = await createUser();
    const intruder = await createUser({ username: "intruso", email: "i@x.com" });
    const series = await createSeries(1);
    signedInAs(owner);
    const created = await createLogAction(logInput(series.id));
    const logId = created.ok ? created.data.id : "";

    signedInAs(intruder);
    expect(await updateLogAction(logId, logInput(series.id, { rating: 1 }))).toMatchObject({
      ok: false,
      error: { code: "FORBIDDEN" },
    });
    expect(await deleteLogAction(logId)).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    expect(await db.seriesLog.count()).toBe(1);
  });
});

describe("progress", () => {
  it("marks episodes, seasons and the series, completes it and rates a season", async () => {
    const userId = await createUser();
    signedInAs(userId);
    const s = await createSeriesWithEpisodes(1, [
      { seasonNumber: 1, airDates: [PAST, PAST] },
      { seasonNumber: 2, airDates: [PAST] },
    ]);

    expect((await toggleEpisodeAction(s.bySeason[1].episodeIds[0], true)).ok).toBe(true);
    expect((await markSeasonAction(s.bySeason[1].seasonId, true)).ok).toBe(true);
    const all = await markSeriesAction(s.seriesId, true);
    expect(all.ok && all.data.promptCompletion).toBe(true);

    expect((await completeSeriesAction(s.seriesId)).ok).toBe(true);
    expect((await resumeWatchingAction(s.seriesId)).ok).toBe(true);
    expect((await rateSeasonAction(s.bySeason[1].seasonId, 4, "Boa")).ok).toBe(true);
    expect(await db.seasonRating.count()).toBe(1);
    expect(mocks.revalidatePath).toHaveBeenCalled();
  });
});

describe("watchlist", () => {
  it("adds, removes and changes privacy", async () => {
    const userId = await createUser();
    signedInAs(userId);
    const series = await createSeries(1);
    expect((await addToWatchlistAction(series.id)).ok).toBe(true);
    expect(await db.watchlistItem.count()).toBe(1);
    expect((await removeFromWatchlistAction(series.id)).ok).toBe(true);
    expect(await db.watchlistItem.count()).toBe(0);
    expect((await setWatchlistPublicAction(false)).ok).toBe(true);
    expect((await db.user.findUniqueOrThrow({ where: { id: userId } })).watchlistPublic).toBe(
      false,
    );
  });
});

describe("lists", () => {
  it("creates a list (returning the owner's path parts) and manages its items", async () => {
    const userId = await createUser();
    signedInAs(userId);
    const [a, b] = [await createSeries(1, "A"), await createSeries(2, "B")];

    const created = await createListAction({
      title: "Minha lista",
      description: "",
      isPublic: true,
      isRanked: false,
    });
    expect(created).toMatchObject({ ok: true, data: { username: "fulano", slug: "minha-lista" } });
    const list = await db.seriesList.findFirstOrThrow();

    expect((await addSeriesToListAction(list.id, 1)).ok).toBe(true); // syncs (mocked) then adds
    expect((await setSeriesInListAction(list.id, b.id, true)).ok).toBe(true);
    expect((await reorderListAction(list.id, [b.id, a.id])).ok).toBe(true);
    expect((await updateListItemNoteAction(list.id, a.id, "nota")).ok).toBe(true);
    expect((await removeListItemAction(list.id, a.id)).ok).toBe(true);
    expect((await setSeriesInListAction(list.id, b.id, false)).ok).toBe(true);
    expect(await db.seriesListItem.count()).toBe(0);

    expect(
      (
        await updateListAction(list.id, {
          title: "Novo",
          description: "",
          isPublic: false,
          isRanked: true,
        })
      ).ok,
    ).toBe(true);
    expect((await deleteListAction(list.id)).ok).toBe(true);
    expect(await db.seriesList.count()).toBe(0);
  });

  it("reports a TMDB sync failure or unknown series without writing anything", async () => {
    const userId = await createUser();
    signedInAs(userId);
    const created = await createListAction({
      title: "x",
      description: "",
      isPublic: true,
      isRanked: false,
    });
    expect(created.ok).toBe(true);
    const list = await db.seriesList.findFirstOrThrow();

    mocks.getOrSyncSeries.mockRejectedValueOnce(new Error("tmdb down"));
    expect(await addSeriesToListAction(list.id, 99)).toMatchObject({
      ok: false,
      error: { code: "INTERNAL" },
    });
    mocks.getOrSyncSeries.mockResolvedValueOnce(null);
    expect(await addSeriesToListAction(list.id, 98)).toMatchObject({
      ok: false,
      error: { code: "NOT_FOUND" },
    });
    expect(await db.seriesListItem.count()).toBe(0);
  });

  it("another user cannot change my list through the actions", async () => {
    const owner = await createUser();
    const intruder = await createUser({ username: "intruso", email: "i@x.com" });
    signedInAs(owner);
    await createListAction({ title: "Minha", description: "", isPublic: true, isRanked: false });
    const list = await db.seriesList.findFirstOrThrow();

    signedInAs(intruder);
    expect(await deleteListAction(list.id)).toMatchObject({
      ok: false,
      error: { code: "FORBIDDEN" },
    });
    expect(await db.seriesList.count()).toBe(1);
  });
});

describe("profile and favorites", () => {
  it("updates the profile and password, and manages favorites", async () => {
    const userId = await createUser();
    signedInAs(userId);

    expect(
      (await updateProfileAction({ name: "Novo", username: "novo", bio: "oi", image: "" })).ok,
    ).toBe(true);
    expect((await db.user.findUniqueOrThrow({ where: { id: userId } })).username).toBe("novo");
    expect(
      (await changePasswordAction({ currentPassword: "senha1234", newPassword: "outra12345" })).ok,
    ).toBe(true);

    await createSeries(1, "A");
    await createSeries(2, "B");
    expect((await addFavoriteAction(1)).ok).toBe(true);
    expect((await addFavoriteAction(2)).ok).toBe(true);
    const rows = await db.favoriteSeries.findMany({ orderBy: { position: "asc" } });
    expect((await reorderFavoritesAction(rows.map((r) => r.seriesId).reverse())).ok).toBe(true);
    expect((await removeFavoriteAction(rows[0].seriesId)).ok).toBe(true);
    expect(await db.favoriteSeries.count()).toBe(1);
    expect(mocks.revalidatePath).toHaveBeenCalled();

    mocks.getOrSyncSeries.mockRejectedValueOnce(new Error("tmdb down"));
    expect(await addFavoriteAction(3)).toMatchObject({ ok: false, error: { code: "INTERNAL" } });
    mocks.getOrSyncSeries.mockResolvedValueOnce(null);
    expect(await addFavoriteAction(4)).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
  });

  it("deleting the account signs out only on success", async () => {
    const userId = await createUser();
    signedInAs(userId);
    expect((await deleteAccountAction({ confirmUsername: "errado" })).ok).toBe(false);
    expect(mocks.signOut).not.toHaveBeenCalled();
    expect((await deleteAccountAction({ confirmUsername: "fulano" })).ok).toBe(true);
    expect(mocks.signOut).toHaveBeenCalledWith({ redirectTo: "/" });
    expect(await db.user.count()).toBe(0);
  });
});

describe("auth actions", () => {
  it("signUpAction creates the account and starts a session", async () => {
    const result = await signUpAction({
      name: "Ana",
      username: "ana",
      email: "ana@x.com",
      password: "senha1234",
    });
    expect(result.ok).toBe(true);
    expect(mocks.signIn).toHaveBeenCalledWith("credentials", {
      email: "ana@x.com",
      password: "senha1234",
      redirect: false,
    });
  });

  it("signUpAction rejects duplicates without starting a session", async () => {
    await createUser({ email: "ana@x.com", username: "ana" });
    const result = await signUpAction({
      name: "Outra",
      username: "ana",
      email: "ana@x.com",
      password: "senha1234",
    });
    expect(result).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(mocks.signIn).not.toHaveBeenCalled();
  });

  it("loginAction: ok, generic error on AuthError, malformed input, and the rate-limit message", async () => {
    await createUser();
    expect((await loginAction({ email: "fulano@example.com", password: "senha1234" })).ok).toBe(
      true,
    );

    mocks.signIn.mockRejectedValueOnce(new AuthError("bad"));
    expect(await loginAction({ email: "fulano@example.com", password: "x" })).toMatchObject({
      ok: false,
      error: { code: "UNAUTHENTICATED", message: "E-mail ou senha inválidos" },
    });

    expect(await loginAction({ email: "", password: "" })).toMatchObject({
      ok: false,
      error: { message: "E-mail ou senha inválidos" },
    });

    // Block the key (IP comes from the mocked x-forwarded-for header).
    await db.rateLimit.create({
      data: {
        key: "login:9.9.9.9:fulano@example.com",
        count: 5,
        windowStart: new Date(),
        blockedUntil: new Date(Date.now() + 5 * 60_000),
      },
    });
    mocks.signIn.mockClear();
    const blocked = await loginAction({ email: "fulano@example.com", password: "senha1234" });
    expect(blocked).toMatchObject({ ok: false, error: { code: "RATE_LIMITED" } });
    expect(!blocked.ok && blocked.error.message).toMatch(
      /Muitas tentativas de login\. Tente novamente em \d+ minutos?\./,
    );
    expect(mocks.signIn).not.toHaveBeenCalled();
  });

  it("logoutAction signs out and returns home", async () => {
    await logoutAction();
    expect(mocks.signOut).toHaveBeenCalledWith({ redirectTo: "/" });
  });
});
