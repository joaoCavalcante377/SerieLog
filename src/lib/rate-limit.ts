import { db } from "@/lib/db";

/**
 * Fixed-window rate limiter backed by the `RateLimit` table (works across serverless instances).
 *
 * Known limitations (documented in docs/DECISIONS.md): fixed windows allow a short burst at the window edge,
 * the client IP comes from forwarded headers (trustworthy only behind a proxy that sets them), and old rows
 * are only overwritten when the same key returns (a periodic `DELETE` of stale rows is advisable).
 */
export interface RateLimitConfig {
  /** Hits within `windowMs` after which the key is blocked. */
  limit: number;
  windowMs: number;
  blockMs: number;
}

export interface RateLimitStatus {
  blocked: boolean;
  retryAfterMs: number;
}

const OPEN: RateLimitStatus = { blocked: false, retryAfterMs: 0 };

/** Read-only: is this key currently blocked? */
export async function rateLimitStatus(
  key: string,
  now: Date = new Date(),
): Promise<RateLimitStatus> {
  const row = await db.rateLimit.findUnique({ where: { key }, select: { blockedUntil: true } });
  if (!row?.blockedUntil || row.blockedUntil <= now) return OPEN;
  return { blocked: true, retryAfterMs: row.blockedUntil.getTime() - now.getTime() };
}

/**
 * Records one hit atomically (single upsert, so concurrent requests cannot lose counts). When the count
 * reaches `limit` inside the window the key is blocked for `blockMs`.
 */
export async function rateLimitHit(
  key: string,
  { limit, windowMs, blockMs }: RateLimitConfig,
  now: Date = new Date(),
): Promise<RateLimitStatus> {
  const windowStart = new Date(now.getTime() - windowMs);
  const blockedUntil = new Date(now.getTime() + blockMs);

  const rows = await db.$queryRaw<{ blockedUntil: Date | null }[]>`
    INSERT INTO "RateLimit" ("key", "count", "windowStart", "blockedUntil")
    VALUES (${key}, 1, ${now}, ${limit <= 1 ? blockedUntil : null})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimit"."windowStart" <= ${windowStart} THEN 1 ELSE "RateLimit"."count" + 1 END,
      "windowStart" = CASE WHEN "RateLimit"."windowStart" <= ${windowStart} THEN ${now} ELSE "RateLimit"."windowStart" END,
      "blockedUntil" = CASE
        WHEN "RateLimit"."windowStart" <= ${windowStart} THEN ${limit <= 1 ? blockedUntil : null}
        WHEN "RateLimit"."count" + 1 >= ${limit} THEN ${blockedUntil}
        ELSE "RateLimit"."blockedUntil"
      END
    RETURNING "blockedUntil"`;

  const until = rows[0]?.blockedUntil;
  if (!until || until <= now) return OPEN;
  return { blocked: true, retryAfterMs: until.getTime() - now.getTime() };
}

export async function rateLimitReset(key: string): Promise<void> {
  await db.rateLimit.deleteMany({ where: { key } });
}

/** Best-effort client IP from proxy headers (first hop of x-forwarded-for). */
export function clientIp(headers: Pick<Headers, "get">): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip")?.trim() || "unknown";
}

export function formatRetryAfter(ms: number): string {
  const minutes = Math.max(1, Math.ceil(ms / 60_000));
  return `${minutes} ${minutes === 1 ? "minuto" : "minutos"}`;
}
