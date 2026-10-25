import { PrismaClient } from "@prisma/client";

/**
 * Start every E2E run from a clean slate: all users (and, by cascade, their logs, lists, ratings…)
 * plus rate-limit counters are removed. The TMDB series cache is kept so runs stay fast.
 */
export default async function globalSetup() {
  const url =
    process.env.TEST_DATABASE_URL ??
    "postgresql://serielog:serielog@localhost:5432/serielog_test?schema=public";
  const db = new PrismaClient({ datasources: { db: { url } } });
  try {
    await db.$executeRawUnsafe('TRUNCATE TABLE "User", "RateLimit" CASCADE');
  } finally {
    await db.$disconnect();
  }
}
