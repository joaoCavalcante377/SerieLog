import { beforeEach, describe, expect, it } from "vitest";
import { attemptLogin, LOGIN_LIMIT, loginBlockStatus } from "@/features/auth/server/login";
import { db } from "@/lib/db";
import { createUser, resetDb } from "@/test/db";
import {
  clientIp,
  formatRetryAfter,
  rateLimitHit,
  rateLimitReset,
  rateLimitStatus,
} from "./rate-limit";

beforeEach(resetDb);

const T0 = new Date("2026-06-01T12:00:00Z");
const minutes = (n: number) => new Date(T0.getTime() + n * 60_000);
const CFG = { limit: 3, windowMs: 60_000, blockMs: 120_000 };

describe("rateLimitHit", () => {
  it("blocks when the count reaches the limit inside the window", async () => {
    expect((await rateLimitHit("k", CFG, T0)).blocked).toBe(false);
    expect((await rateLimitHit("k", CFG, T0)).blocked).toBe(false);
    const third = await rateLimitHit("k", CFG, T0);
    expect(third).toMatchObject({ blocked: true, retryAfterMs: 120_000 });
    expect((await rateLimitStatus("k", T0)).blocked).toBe(true);
  });

  it("unblocks after blockMs and starts a fresh window", async () => {
    for (let i = 0; i < 3; i++) await rateLimitHit("k", CFG, T0);
    expect((await rateLimitStatus("k", new Date(T0.getTime() + 119_000))).blocked).toBe(true);
    expect((await rateLimitStatus("k", new Date(T0.getTime() + 121_000))).blocked).toBe(false);

    const later = new Date(T0.getTime() + 130_000);
    expect((await rateLimitHit("k", CFG, later)).blocked).toBe(false);
    expect((await db.rateLimit.findUniqueOrThrow({ where: { key: "k" } })).count).toBe(1);
  });

  it("does not lose counts under concurrency", async () => {
    await Promise.all(
      Array.from({ length: 10 }, () => rateLimitHit("k", { ...CFG, limit: 50 }, T0)),
    );
    expect((await db.rateLimit.findUniqueOrThrow({ where: { key: "k" } })).count).toBe(10);
  });

  it("keys are independent and can be reset", async () => {
    for (let i = 0; i < 3; i++) await rateLimitHit("a", CFG, T0);
    expect((await rateLimitStatus("b", T0)).blocked).toBe(false);
    await rateLimitReset("a");
    expect((await rateLimitStatus("a", T0)).blocked).toBe(false);
  });

  it("a limit of 1 blocks on the first hit", async () => {
    expect((await rateLimitHit("one", { ...CFG, limit: 1 }, T0)).blocked).toBe(true);
  });
});

describe("login rate limiting", () => {
  const good = { email: "fulano@example.com", password: "senha1234" };
  const bad = { email: "fulano@example.com", password: "errada123" };

  it("AUTH-07 blocks after 5 failures from the same IP+email for 10 minutes, even with the right password", async () => {
    await createUser();
    for (let i = 0; i < 5; i++) {
      // Every one of the five failing attempts gets the generic error.
      expect(await attemptLogin(bad, "1.2.3.4", minutes(i))).toEqual({ status: "invalid" });
    }
    const status = await loginBlockStatus("1.2.3.4", good.email, minutes(5));
    expect(status.blocked).toBe(true);

    const blocked = await attemptLogin(good, "1.2.3.4", minutes(5));
    expect(blocked).toMatchObject({ status: "blocked" });
    expect(blocked.status === "blocked" && blocked.retryAfterMs).toBeGreaterThan(4 * 60_000);
    expect(blocked.status === "blocked" && blocked.retryAfterMs).toBeLessThanOrEqual(
      LOGIN_LIMIT.blockMs,
    );
  });

  it("AUTH-07 allows logging in again once the block has expired", async () => {
    await createUser();
    for (let i = 0; i < 5; i++) await attemptLogin(bad, "1.2.3.4", minutes(0));
    expect((await attemptLogin(good, "1.2.3.4", minutes(9))).status).toBe("blocked");
    expect((await attemptLogin(good, "1.2.3.4", minutes(11))).status).toBe("ok");
  });

  it("other IPs and other emails are not affected", async () => {
    await createUser();
    await createUser({ username: "outro", email: "outro@example.com" });
    for (let i = 0; i < 5; i++) await attemptLogin(bad, "1.2.3.4", minutes(0));

    expect((await attemptLogin(good, "9.9.9.9", minutes(1))).status).toBe("ok");
    expect(
      (
        await attemptLogin(
          { email: "outro@example.com", password: "senha1234" },
          "1.2.3.4",
          minutes(1),
        )
      ).status,
    ).toBe("ok");
  });

  it("a successful login resets the failure counter", async () => {
    await createUser();
    for (let i = 0; i < 4; i++) await attemptLogin(bad, "1.2.3.4", minutes(i));
    expect((await attemptLogin(good, "1.2.3.4", minutes(4))).status).toBe("ok");
    // Four more failures are fine again: the counter restarted.
    for (let i = 0; i < 4; i++)
      expect((await attemptLogin(bad, "1.2.3.4", minutes(5))).status).toBe("invalid");
    expect((await attemptLogin(good, "1.2.3.4", minutes(5))).status).toBe("ok");
  });

  it("malformed input is invalid without touching the limiter", async () => {
    expect(await attemptLogin({ email: "x" }, "1.2.3.4")).toEqual({ status: "invalid" });
    expect(await db.rateLimit.count()).toBe(0);
  });
});

describe("helpers", () => {
  it("clientIp prefers the first x-forwarded-for hop, then x-real-ip", () => {
    const h = (o: Record<string, string>) => ({ get: (k: string) => o[k] ?? null });
    expect(clientIp(h({ "x-forwarded-for": "5.6.7.8, 10.0.0.1" }))).toBe("5.6.7.8");
    expect(clientIp(h({ "x-real-ip": "9.9.9.9" }))).toBe("9.9.9.9");
    expect(clientIp(h({}))).toBe("unknown");
  });

  it("formatRetryAfter rounds up to whole minutes", () => {
    expect(formatRetryAfter(1)).toBe("1 minuto");
    expect(formatRetryAfter(61_000)).toBe("2 minutos");
    expect(formatRetryAfter(10 * 60_000)).toBe("10 minutos");
  });
});
