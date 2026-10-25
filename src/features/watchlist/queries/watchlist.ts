import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { WATCHLIST_PAGE_SIZE, type WatchlistParams } from "../schemas/watchlist";

const ORDER: Record<WatchlistParams["sort"], Prisma.WatchlistItemOrderByWithRelationInput[]> = {
  added: [{ addedAt: "desc" }, { id: "desc" }],
  year: [{ series: { firstAirDate: { sort: "desc", nulls: "last" } } }, { id: "desc" }],
  title: [{ series: { name: "asc" } }, { id: "asc" }],
};

export async function getWatchlistPage(userId: string, params: WatchlistParams) {
  const where: Prisma.WatchlistItemWhereInput = {
    userId,
    ...(params.genre ? { series: { genres: { some: { genreId: params.genre } } } } : {}),
  };
  const [items, total, genres] = await Promise.all([
    db.watchlistItem.findMany({
      where,
      orderBy: ORDER[params.sort],
      skip: (params.page - 1) * WATCHLIST_PAGE_SIZE,
      take: WATCHLIST_PAGE_SIZE,
      select: {
        id: true,
        series: { select: { tmdbId: true, name: true, posterPath: true, firstAirDate: true } },
      },
    }),
    db.watchlistItem.count({ where }),
    // Genres actually present in this watchlist, for the filter.
    db.genre.findMany({
      where: { series: { some: { series: { watchlistItems: { some: { userId } } } } } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  return { items, total, genres, totalPages: Math.max(1, Math.ceil(total / WATCHLIST_PAGE_SIZE)) };
}

export type WatchlistAccess =
  | { status: "not_found" }
  | { status: "private"; name: string }
  | { status: "ok"; userId: string; name: string; isOwner: boolean };

/** Resolves a public watchlist URL: unknown user → not_found; private and not the owner → private. */
export async function resolveWatchlistAccess(
  username: string,
  viewerId: string | null,
): Promise<WatchlistAccess> {
  const user = await db.user.findUnique({
    where: { username: username.toLowerCase() },
    select: { id: true, name: true, watchlistPublic: true },
  });
  if (!user) return { status: "not_found" };
  const isOwner = viewerId === user.id;
  if (!user.watchlistPublic && !isOwner) return { status: "private", name: user.name };
  return { status: "ok", userId: user.id, name: user.name, isOwner };
}

export async function isOnWatchlist(userId: string, seriesId: string): Promise<boolean> {
  return (await db.watchlistItem.count({ where: { userId, seriesId } })) > 0;
}
