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
