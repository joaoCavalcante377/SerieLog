import { describe, expect, it } from "vitest";
import { buildBrowseQuery, parseBrowseParams } from "./browse";

describe("browse params", () => {
  it("DISC-05 round-trips filters through the URL query string", () => {
    const query = buildBrowseQuery({ genre: 18, sort: "rating", year: 2020, page: 2 });
    expect(query).toBe("?genre=18&year=2020&sort=rating&page=2");

    const params = Object.fromEntries(new URLSearchParams(query));
    expect(parseBrowseParams(params)).toEqual({ genre: 18, year: 2020, sort: "rating", page: 2 });
  });

  it("omits defaults so shared URLs stay clean", () => {
    expect(buildBrowseQuery({ sort: "popularity", page: 1 })).toBe("");
  });

  it("falls back to defaults for invalid values", () => {
    expect(parseBrowseParams({ genre: "abc", year: "1800", sort: "xyz", page: "-3" })).toEqual({
      genre: undefined,
      year: undefined,
      sort: "popularity",
      page: 1,
    });
  });

  it("uses the first value when a param is repeated", () => {
    expect(parseBrowseParams({ genre: ["18", "80"] }).genre).toBe(18);
  });
});
