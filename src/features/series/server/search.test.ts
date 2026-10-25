import { describe, expect, it, vi } from "vitest";
import type { TmdbClient } from "@/lib/tmdb/client";
import { TmdbError } from "@/lib/tmdb/client";
import { searchSeries } from "./search";

const page = (results: object[]) => ({
  page: 1,
  total_pages: 1,
  total_results: results.length,
  results,
});

function clientWith(searchTv: ReturnType<typeof vi.fn>) {
  return { searchTv } as unknown as TmdbClient;
}

describe("searchSeries", () => {
  it("DISC-01 maps results with name, year, poster and canonical href", async () => {
    const searchTv = vi.fn().mockResolvedValue(
      page([
        {
          id: 1396,
          name: "Breaking Bad",
          original_name: "Breaking Bad",
          first_air_date: "2008-01-20",
          poster_path: "/p.jpg",
        },
      ]),
    );
    const outcome = await searchSeries("breaking", 1, clientWith(searchTv));
    expect(outcome).toMatchObject({
      status: "ok",
      results: [
        {
          tmdbId: 1396,
          name: "Breaking Bad",
          year: 2008,
          posterPath: "/p.jpg",
          href: "/serie/1396-breaking-bad",
        },
      ],
    });
  });

  it("DISC-02 returns an empty result list for no matches", async () => {
    const outcome = await searchSeries(
      "zzzzqqqq",
      1,
      clientWith(vi.fn().mockResolvedValue(page([]))),
    );
    expect(outcome).toMatchObject({ status: "ok", results: [] });
  });

  it("DISC-03 makes no request for queries shorter than 2 characters", async () => {
    const searchTv = vi.fn();
    expect(await searchSeries("a", 1, clientWith(searchTv))).toEqual({ status: "too_short" });
    expect(await searchSeries("  b ", 1, clientWith(searchTv))).toEqual({ status: "too_short" });
    expect(searchTv).not.toHaveBeenCalled();
  });

  it("DISC-04 reports an error state when TMDB fails", async () => {
    const searchTv = vi.fn().mockRejectedValue(new TmdbError("down", "network"));
    expect(await searchSeries("breaking", 1, clientWith(searchTv))).toEqual({ status: "error" });
  });

  it("falls back to the original name and tolerates missing dates", async () => {
    const searchTv = vi
      .fn()
      .mockResolvedValue(
        page([
          { id: 5, name: "", original_name: "Sem Título", first_air_date: "", poster_path: null },
        ]),
      );
    const outcome = await searchSeries("sem", 1, clientWith(searchTv));
    expect(outcome).toMatchObject({ results: [{ name: "Sem Título", year: null }] });
  });
});
