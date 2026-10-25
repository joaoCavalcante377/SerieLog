import { db } from "@/lib/db";

/** Wipes user data between tests. Series cache tables are included so tests start clean. */
export async function resetDb() {
  await db.$executeRawUnsafe(
    'TRUNCATE TABLE "User", "Series", "Genre", "VerificationToken", "RateLimit" RESTART IDENTITY CASCADE',
  );
}

export async function createUser(overrides: { email?: string; username?: string } = {}) {
  const { registerUser } = await import("@/features/auth/server/register");
  const result = await registerUser({
    name: "Fulano",
    username: overrides.username ?? "fulano",
    email: overrides.email ?? "fulano@example.com",
    password: "senha1234",
  });
  if (!result.ok) throw new Error("test user creation failed");
  return result.data.id;
}

export async function createSeries(tmdbId = 1, name = `Série ${tmdbId}`, firstAirDate?: string) {
  return db.series.create({
    data: {
      tmdbId,
      name,
      originalName: name,
      status: "Ended",
      lastSyncedAt: new Date(),
      firstAirDate: firstAirDate ? new Date(`${firstAirDate}T00:00:00Z`) : null,
    },
  });
}

export interface SeasonSpec {
  seasonNumber: number;
  /** One air date per episode; null = unknown date (treated as not aired). */
  airDates: (string | null)[];
}

/** A series with seasons/episodes; returns ids grouped by season number for easy assertions. */
export async function createSeriesWithEpisodes(tmdbId: number, seasons: SeasonSpec[]) {
  const series = await createSeries(tmdbId);
  const bySeason: Record<number, { seasonId: string; episodeIds: string[] }> = {};
  let tmdbEpisodeId = tmdbId * 10_000;
  for (const spec of seasons) {
    const season = await db.season.create({
      data: {
        seriesId: series.id,
        tmdbSeasonId: tmdbId * 100 + spec.seasonNumber,
        seasonNumber: spec.seasonNumber,
        name: spec.seasonNumber === 0 ? "Especiais" : `Temporada ${spec.seasonNumber}`,
        episodeCount: spec.airDates.length,
      },
    });
    const episodeIds: string[] = [];
    for (const [i, airDate] of spec.airDates.entries()) {
      const ep = await db.episode.create({
        data: {
          seasonId: season.id,
          seriesId: series.id,
          tmdbEpisodeId: tmdbEpisodeId++,
          episodeNumber: i + 1,
          seasonNumber: spec.seasonNumber,
          name: `Episódio ${i + 1}`,
          airDate: airDate ? new Date(`${airDate}T00:00:00Z`) : null,
        },
      });
      episodeIds.push(ep.id);
    }
    bySeason[spec.seasonNumber] = { seasonId: season.id, episodeIds };
  }
  return { seriesId: series.id, bySeason };
}
