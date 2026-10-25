import { describe, expect, it } from "vitest";
import { isFullyWatched, progressPercent, summarizeProgress } from "./progress";

describe("progress", () => {
  it("is watched aired / total aired as a whole percentage", () => {
    expect(progressPercent(1, 3)).toBe(33);
    expect(progressPercent(2, 3)).toBe(66);
    expect(progressPercent(3, 3)).toBe(100);
    expect(progressPercent(0, 10)).toBe(0);
  });

  it("is 0 when nothing has aired and clamps out-of-range counts", () => {
    expect(progressPercent(0, 0)).toBe(0);
    expect(progressPercent(5, 0)).toBe(0);
    expect(progressPercent(9, 3)).toBe(100);
    expect(progressPercent(-1, 3)).toBe(0);
  });

  it("only reports complete with at least one aired episode", () => {
    expect(isFullyWatched(0, 0)).toBe(false);
    expect(isFullyWatched(3, 3)).toBe(true);
    expect(summarizeProgress(2, 4)).toEqual({
      watchedAired: 2,
      totalAired: 4,
      percent: 50,
      complete: false,
    });
  });
});
