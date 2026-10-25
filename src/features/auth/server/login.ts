import {
  rateLimitHit,
  rateLimitReset,
  rateLimitStatus,
  type RateLimitConfig,
} from "@/lib/rate-limit";
import { loginSchema } from "../schemas/auth";
import { verifyCredentials } from "./credentials";

/** 5 failures within 10 minutes from the same IP + email block further attempts for 10 minutes. */
export const LOGIN_LIMIT: RateLimitConfig = {
  limit: 5,
  windowMs: 10 * 60_000,
  blockMs: 10 * 60_000,
};

export function loginKey(ip: string, email: string): string {
  return `login:${ip}:${email.trim().toLowerCase()}`;
}

export type LoginAttempt =
  | { status: "ok"; user: NonNullable<Awaited<ReturnType<typeof verifyCredentials>>> }
  | { status: "invalid" }
  | { status: "blocked"; retryAfterMs: number };

/** Used by Auth.js `authorize`, so the limit also covers direct calls to the credentials endpoint. */
export async function attemptLogin(
  raw: unknown,
  ip: string,
  now: Date = new Date(),
): Promise<LoginAttempt> {
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) return { status: "invalid" };
  const key = loginKey(ip, parsed.data.email);

  // A blocked key is refused before the password is even checked (a right password does not bypass it).
  const block = await rateLimitStatus(key, now);
  if (block.blocked) return { status: "blocked", retryAfterMs: block.retryAfterMs };

  const user = await verifyCredentials(raw);
  if (user) {
    await rateLimitReset(key);
    return { status: "ok", user };
  }
  // The failing attempt itself still gets the generic error; the block applies from the next one.
  await rateLimitHit(key, LOGIN_LIMIT, now);
  return { status: "invalid" };
}

/** Read-only check used by the login form action to show a clear message before trying. */
export async function loginBlockStatus(ip: string, email: string, now: Date = new Date()) {
  return rateLimitStatus(loginKey(ip, email), now);
}
