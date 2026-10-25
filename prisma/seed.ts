/**
 * Demo data: 3 users, ~15 real series from TMDB, logs, episode progress, lists, watchlist and favorites.
 * Idempotent: users are upserted and their activity is wiped and rebuilt, so running it twice gives the same result.
 *
 * Run: pnpm db:seed   (needs DATABASE_URL and TMDB_API_READ_TOKEN in .env)
 * Demo accounts all use the password "demo1234" — local development only.
 */
import argon2 from "argon2";
import { syncSeries } from "../src/features/series/server/sync";
import { db } from "../src/lib/db";
import { todayInSaoPaulo } from "../src/lib/domain/dates";

const DEMO_PASSWORD = "demo1234";

const SERIES: Record<string, number> = {
  breakingBad: 1396,
  gameOfThrones: 1399,
  strangerThings: 66732,
  peakyBlinders: 60574,
  chernobyl: 87108,
  betterCallSaul: 60059,
  friends: 1668,
  theOffice: 2316,
  theBoys: 76479,
  mandalorian: 82856,
  lastOfUs: 100088,
  lost: 4607,
  bigBang: 1418,
  dark: 70523,
  naruto: 46260,
};

const USERS = [
  {
    name: "Ana Demo",
    username: "ana_demo",
    email: "ana@demo.serielog.test",
    bio: "Drama é a minha praia.",
  },
  {
    name: "Bruno Demo",
    username: "bruno_demo",
    email: "bruno@demo.serielog.test",
    bio: "Comédias e maratonas.",
  },
  { name: "Carla Demo", username: "carla_demo", email: "carla@demo.serielog.test", bio: null },
] as const;

type SeriesKey = keyof typeof SERIES;

function daysAgo(n: number): Date {
  const today = new Date(`${todayInSaoPaulo()}T00:00:00Z`);
  today.setUTCDate(today.getUTCDate() - n);
  return today;
}

async function main() {
  if (!process.env.TMDB_API_READ_TOKEN)
    throw new Error("TMDB_API_READ_TOKEN is required to seed series");

  // 1) Series (fetched from TMDB, cached in our tables).
  const ids = new Map<SeriesKey, string>();
  for (const [key, tmdbId] of Object.entries(SERIES) as [SeriesKey, number][]) {
    try {
      const existing = await db.series.findUnique({ where: { tmdbId }, select: { id: true } });
      const series = existing ?? (await syncSeries(tmdbId));
      ids.set(key, series.id);
      console.log(`series ${tmdbId} ok`);
    } catch (e) {
      console.warn(`series ${tmdbId} skipped: ${String(e)}`);
    }
  }
  const sid = (key: SeriesKey) => {
    const id = ids.get(key);
    if (!id) throw new Error(`Series "${key}" is not available; rerun when TMDB is reachable.`);
    return id;
  };

  // 2) Users (upsert; password only set on first creation).
  const passwordHash = await argon2.hash(DEMO_PASSWORD);
  const users: Record<string, string> = {};
  for (const u of USERS) {
    const user = await db.user.upsert({
      where: { email: u.email },
      create: { ...u, passwordHash },
      update: { name: u.name, username: u.username, bio: u.bio },
      select: { id: true },
    });
    users[u.username] = user.id;
  }
  const [ana, bruno, carla] = [users.ana_demo, users.bruno_demo, users.carla_demo];

  // 3) Wipe the demo users' activity so the seed is repeatable.
  const demoIds = Object.values(users);
  await db.$transaction([
    db.seriesLog.deleteMany({ where: { userId: { in: demoIds } } }),
    db.episodeWatch.deleteMany({ where: { userId: { in: demoIds } } }),
    db.seasonRating.deleteMany({ where: { userId: { in: demoIds } } }),
    db.watchlistItem.deleteMany({ where: { userId: { in: demoIds } } }),
    db.favoriteSeries.deleteMany({ where: { userId: { in: demoIds } } }),
    db.seriesList.deleteMany({ where: { userId: { in: demoIds } } }),
  ]);

  // 4) Logs.
  type LogSeed = {
    user: string;
    series: SeriesKey;
    status?: "COMPLETED" | "WATCHING" | "DROPPED";
    rating?: number;
    finished?: number;
    started?: number;
    review?: string;
    spoilers?: boolean;
    rewatch?: boolean;
  };
  const logs: LogSeed[] = [
    {
      user: ana,
      series: "breakingBad",
      rating: 5,
      finished: 200,
      started: 260,
      review: "Uma obra-prima do início ao fim.\nO episódio final é perfeito.",
    },
    {
      user: ana,
      series: "chernobyl",
      rating: 4.5,
      finished: 120,
      started: 125,
      review: "Tenso e brutal. Imperdível.",
      spoilers: true,
    },
    { user: ana, series: "betterCallSaul", rating: 4.5, finished: 90, started: 150 },
    {
      user: ana,
      series: "dark",
      rating: 4,
      finished: 60,
      started: 80,
      review: "Complicada, mas vale cada minuto.",
    },
    { user: ana, series: "breakingBad", rating: 5, finished: 20, started: 40, rewatch: true },
    { user: ana, series: "lost", rating: 3, finished: 400, started: 500 },
    { user: ana, series: "strangerThings", status: "WATCHING", started: 5 },
    {
      user: bruno,
      series: "theOffice",
      rating: 5,
      finished: 300,
      started: 330,
      review: "Conforto em forma de série.",
    },
    { user: bruno, series: "friends", rating: 4, finished: 150, started: 200 },
    { user: bruno, series: "bigBang", rating: 3.5, finished: 100, started: 130 },
    {
      user: bruno,
      series: "theBoys",
      rating: 4.5,
      finished: 30,
      started: 50,
      review: "Ácida e muito divertida.",
    },
    { user: bruno, series: "mandalorian", rating: 4, finished: 10, started: 25 },
    {
      user: carla,
      series: "gameOfThrones",
      rating: 3.5,
      finished: 220,
      started: 300,
      review: "Ótima até a metade.",
      spoilers: true,
    },
    { user: carla, series: "lastOfUs", rating: 5, finished: 15, started: 30 },
    {
      user: carla,
      series: "peakyBlinders",
      status: "DROPPED",
      rating: 2,
      finished: 70,
      started: 90,
    },
    { user: carla, series: "naruto", status: "WATCHING", started: 12 },
  ];
  for (const l of logs) {
    const status = l.status ?? "COMPLETED";
    await db.seriesLog.create({
      data: {
        userId: l.user,
        seriesId: sid(l.series),
        status,
        rating: l.rating ?? null,
        startedAt: l.started !== undefined ? daysAgo(l.started) : null,
        finishedAt:
          status === "WATCHING" ? null : l.finished !== undefined ? daysAgo(l.finished) : null,
        reviewText: l.review ?? null,
        containsSpoilers: l.spoilers ?? false,
        isRewatch: l.rewatch ?? false,
      },
    });
  }

  // 5) Episode progress for the series being watched (first season, a few aired episodes).
  const progress: [string, SeriesKey, number][] = [
    [ana, "strangerThings", 3],
    [carla, "naruto", 5],
  ];
  const now = new Date();
  for (const [userId, key, count] of progress) {
    const episodes = await db.episode.findMany({
      where: { seriesId: sid(key), seasonNumber: 1, airDate: { lte: now } },
      orderBy: { episodeNumber: "asc" },
      take: count,
      select: { id: true },
    });
    await db.episodeWatch.createMany({
      data: episodes.map((e) => ({ userId, episodeId: e.id, seriesId: sid(key), watchedAt: now })),
      skipDuplicates: true,
    });
  }
  const season = await db.season.findFirst({
    where: { seriesId: sid("breakingBad"), seasonNumber: 1 },
  });
  if (season) {
    await db.seasonRating.create({
      data: {
        userId: ana,
        seasonId: season.id,
        rating: 4.5,
        reviewText: "A melhor primeira temporada.",
      },
    });
  }

  // 6) Watchlist, favorites.
  const watchlist: [string, SeriesKey][] = [
    [ana, "theBoys"],
    [ana, "lastOfUs"],
    [ana, "peakyBlinders"],
    [bruno, "dark"],
    [bruno, "chernobyl"],
    [carla, "friends"],
  ];
  await db.watchlistItem.createMany({
    data: watchlist.map(([userId, key]) => ({ userId, seriesId: sid(key) })),
  });
  await db.user.update({ where: { id: bruno }, data: { watchlistPublic: false } });

  const favorites: [string, SeriesKey[]][] = [
    [ana, ["breakingBad", "chernobyl", "betterCallSaul", "dark"]],
    [bruno, ["theOffice", "theBoys", "friends"]],
  ];
  for (const [userId, keys] of favorites) {
    await db.favoriteSeries.createMany({
      data: keys.map((key, i) => ({ userId, seriesId: sid(key), position: i + 1 })),
    });
  }

  // 7) Lists.
  const lists: {
    user: string;
    title: string;
    slug: string;
    description?: string;
    isPublic?: boolean;
    isRanked?: boolean;
    items: [SeriesKey, string?][];
  }[] = [
    {
      user: ana,
      title: "Melhores dramas",
      slug: "melhores-dramas",
      isRanked: true,
      description: "Os dramas que mais me marcaram.",
      items: [
        ["breakingBad", "Imbatível."],
        ["chernobyl"],
        ["betterCallSaul", "Quase no mesmo nível."],
        ["dark"],
        ["lost"],
      ],
    },
    {
      user: ana,
      title: "Para ver depois",
      slug: "para-ver-depois",
      isPublic: false,
      items: [["theBoys"], ["lastOfUs"]],
    },
    {
      user: bruno,
      title: "Comédias para maratonar",
      slug: "comedias-para-maratonar",
      description: "Para rir sem culpa.",
      items: [["theOffice"], ["friends"], ["bigBang"]],
    },
    {
      user: carla,
      title: "Fantasia e ficção",
      slug: "fantasia-e-ficcao",
      items: [["gameOfThrones"], ["lastOfUs"], ["naruto"]],
    },
  ];
  for (const l of lists) {
    await db.seriesList.create({
      data: {
        userId: l.user,
        title: l.title,
        slug: l.slug,
        description: l.description ?? null,
        isPublic: l.isPublic ?? true,
        isRanked: l.isRanked ?? false,
        items: {
          create: l.items.map(([key, note], i) => ({
            seriesId: sid(key),
            position: i + 1,
            note: note ?? null,
          })),
        },
      },
    });
  }

  console.log(
    `\nSeed complete. Demo logins: ana@demo.serielog.test, bruno@demo.serielog.test, carla@demo.serielog.test (password: ${DEMO_PASSWORD})`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
