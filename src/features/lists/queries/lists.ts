import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export const LISTS_PAGE_SIZE = 12;

const COVER_SELECT = {
  items: {
    orderBy: { position: "asc" },
    take: 4,
    select: { series: { select: { tmdbId: true, name: true, posterPath: true } } },
  },
  _count: { select: { items: true } },
} satisfies Prisma.SeriesListSelect;

const listCardSelect = {
  id: true,
  title: true,
  slug: true,
  isPublic: true,
  isRanked: true,
  createdAt: true,
  user: { select: { name: true, username: true } },
  ...COVER_SELECT,
} satisfies Prisma.SeriesListSelect;

export type ListCard = Prisma.SeriesListGetPayload<{ select: typeof listCardSelect }>;

/** Public lists, most series first (there are no likes yet), then newest. */
export async function getPopularLists(page = 1) {
  const where = { isPublic: true };
  const [lists, total] = await Promise.all([
    db.seriesList.findMany({
      where,
      orderBy: [{ items: { _count: "desc" } }, { createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * LISTS_PAGE_SIZE,
      take: LISTS_PAGE_SIZE,
      select: listCardSelect,
    }),
    db.seriesList.count({ where }),
  ]);
  return { lists, totalPages: Math.max(1, Math.ceil(total / LISTS_PAGE_SIZE)) };
}

/** A user's lists as seen by `viewerId`: private lists are only visible to their owner. */
export async function getUserLists(userId: string, viewerId: string | null, take?: number) {
  return db.seriesList.findMany({
    where: { userId, ...(viewerId === userId ? {} : { isPublic: true }) },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take,
    select: listCardSelect,
  });
}

/** null = not found OR private and not the owner (callers must answer 404 for both). */
export async function getListView(username: string, slug: string, viewerId: string | null) {
  const owner = await db.user.findUnique({
    where: { username: username.toLowerCase() },
    select: { id: true, name: true, username: true },
  });
  if (!owner) return null;

  const list = await db.seriesList.findUnique({
    where: { userId_slug: { userId: owner.id, slug } },
    include: {
      items: {
        orderBy: { position: "asc" },
        include: {
          series: {
            select: { id: true, tmdbId: true, name: true, posterPath: true, firstAirDate: true },
          },
        },
      },
    },
  });
  if (!list) return null;
  const isOwner = viewerId === owner.id;
  if (!list.isPublic && !isOwner) return null;
  return { list, owner, isOwner };
}

/** For the "add to list" menu on a series page: my lists and whether each contains the series. */
export async function getListsForSeries(userId: string, seriesId: string) {
  const lists = await db.seriesList.findMany({
    where: { userId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      title: true,
      _count: { select: { items: true } },
      items: { where: { seriesId }, select: { id: true } },
    },
  });
  return lists.map((l) => ({
    id: l.id,
    title: l.title,
    itemCount: l._count.items,
    hasSeries: l.items.length > 0,
  }));
}
