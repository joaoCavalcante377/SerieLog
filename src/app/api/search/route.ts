import { NextResponse, type NextRequest } from "next/server";
import { searchSeries } from "@/features/series/server/search";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") ?? "";
  const page = Math.max(1, Number(request.nextUrl.searchParams.get("page")) || 1);
  const outcome = await searchSeries(q, page);

  if (outcome.status === "too_short") return NextResponse.json(outcome, { status: 400 });
  if (outcome.status === "error") return NextResponse.json(outcome, { status: 502 });
  return NextResponse.json(outcome);
}
