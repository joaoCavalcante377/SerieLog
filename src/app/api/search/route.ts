import { NextResponse, type NextRequest } from "next/server";
import { searchSeries } from "@/features/series/server/search";
import { clientIp, rateLimitHit, rateLimitStatus, type RateLimitConfig } from "@/lib/rate-limit";

/** 60 searches per minute per IP; going over blocks the IP for a minute. */
const SEARCH_LIMIT: RateLimitConfig = { limit: 60, windowMs: 60_000, blockMs: 60_000 };

export async function GET(request: NextRequest) {
  const key = `search:${clientIp(request.headers)}`;
  const status = await rateLimitStatus(key);
  if (status.blocked) {
    return NextResponse.json(
      { status: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(status.retryAfterMs / 1000)) } },
    );
  }
  await rateLimitHit(key, SEARCH_LIMIT);

  const q = request.nextUrl.searchParams.get("q") ?? "";
  const page = Math.max(1, Number(request.nextUrl.searchParams.get("page")) || 1);
  const outcome = await searchSeries(q, page);

  if (outcome.status === "too_short") return NextResponse.json(outcome, { status: 400 });
  if (outcome.status === "error") return NextResponse.json(outcome, { status: 502 });
  return NextResponse.json(outcome);
}
