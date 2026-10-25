import { describe, expect, it } from "vitest";
import { hasAired, isSyncStale, parseTmdbDate, todayInSaoPaulo } from "./dates";
import { averageRating, isValidRating, ratingHistogram, summarizeRatingCounts } from "./rating";
import { parseSeriesSegment, seriesPath, slugify, uniqueSlug } from "./slug";

describe("rating", () => {
  it("averages to one decimal", () => {
    expect(averageRating([5, 4, 3.5])).toBe(4.2);
    expect(averageRating([])).toBeNull();
    expect(averageRating([3])).toBe(3);
  });

  it("histogram always has 10 half-star buckets", () => {
    const h = ratingHistogram([5, 5, 0.5, 3.5]);
    expect(h).toHaveLength(10);
    expect(h.find((b) => b.rating === 5)?.count).toBe(2);
    expect(h.find((b) => b.rating === 0.5)?.count).toBe(1);
    expect(h.find((b) => b.rating === 4)?.count).toBe(0);
  });

  it("summarizes pre-aggregated counts like the raw list", () => {
    const s = summarizeRatingCounts([
      { rating: 5, count: 1 },
      { rating: 4, count: 1 },
      { rating: 3.5, count: 1 },
    ]);
    expect(s).toMatchObject({ average: 4.2, total: 3 });
  });

  it.each([
    [0.5, true],
    [5, true],
    [3.5, true],
    [0, false],
    [5.5, false],
    [3.3, false],
    [Number.NaN, false],
  ])("isValidRating(%s) = %s", (value, expected) => {
    expect(isValidRating(value)).toBe(expected);
  });
});

describe("dates", () => {
  it("uses the São Paulo calendar day, not UTC", () => {
    // 02:00Z on the 2nd is still the 1st at 23:00 in São Paulo (UTC-3).
    expect(todayInSaoPaulo(new Date("2026-03-02T02:00:00Z"))).toBe("2026-03-01");
    expect(todayInSaoPaulo(new Date("2026-03-02T04:00:00Z"))).toBe("2026-03-02");
  });

  it("hasAired compares date-only; missing date means not aired", () => {
    const now = new Date("2026-03-02T02:00:00Z"); // SP: March 1st
    expect(hasAired(parseTmdbDate("2026-03-01"), now)).toBe(true);
    expect(hasAired(parseTmdbDate("2026-03-02"), now)).toBe(false);
    expect(hasAired(null, now)).toBe(false);
  });

  it("parseTmdbDate rejects empty and malformed values", () => {
    expect(parseTmdbDate("")).toBeNull();
    expect(parseTmdbDate(null)).toBeNull();
    expect(parseTmdbDate("2020-13-45")).toBeNull();
    expect(parseTmdbDate("20-01-2020")).toBeNull();
  });

  it("sync is stale after more than 7 days", () => {
    const now = new Date("2026-03-20T00:00:00Z");
    expect(isSyncStale(new Date("2026-03-18T00:00:00Z"), now)).toBe(false);
    expect(isSyncStale(new Date("2026-03-10T00:00:00Z"), now)).toBe(true);
  });
});

describe("slug", () => {
  it("strips accents and punctuation", () => {
    expect(slugify("Melhores Dramas!")).toBe("melhores-dramas");
    expect(slugify("Ação & Aventura — Série")).toBe("acao-aventura-serie");
    expect(slugify("***", "serie")).toBe("serie");
  });

  it("limits length without a trailing hyphen", () => {
    const s = slugify("a".repeat(58) + " bbbb", "x", 60);
    expect(s.length).toBeLessThanOrEqual(60);
    expect(s.endsWith("-")).toBe(false);
  });

  it("uniqueSlug appends -2, -3…", () => {
    expect(uniqueSlug("melhores-dramas", new Set())).toBe("melhores-dramas");
    expect(uniqueSlug("melhores-dramas", new Set(["melhores-dramas"]))).toBe("melhores-dramas-2");
    expect(uniqueSlug("a", new Set(["a", "a-2"]))).toBe("a-3");
  });

  it("builds and parses series URLs", () => {
    expect(seriesPath(1396, "Breaking Bad")).toBe("/serie/1396-breaking-bad");
    expect(parseSeriesSegment("1396-breaking-bad")).toEqual({ tmdbId: 1396, slug: "breaking-bad" });
    expect(parseSeriesSegment("99999999")).toEqual({ tmdbId: 99999999, slug: "" });
    expect(parseSeriesSegment("abc")).toBeNull();
    expect(parseSeriesSegment("-5")).toBeNull();
  });
});
