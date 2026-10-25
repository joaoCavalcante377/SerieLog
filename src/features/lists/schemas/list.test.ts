import { describe, expect, it } from "vitest";
import { moveItem } from "./list";

describe("moveItem", () => {
  const items = ["a", "b", "c", "d"];

  it("LST-04 moves item 3 to position 1", () => {
    expect(moveItem(items, 2, 0)).toEqual(["c", "a", "b", "d"]);
  });

  it("moves down and keeps the original untouched", () => {
    expect(moveItem(items, 0, 3)).toEqual(["b", "c", "d", "a"]);
    expect(items).toEqual(["a", "b", "c", "d"]);
  });

  it("ignores no-op and out-of-range moves", () => {
    expect(moveItem(items, 1, 1)).toEqual(items);
    expect(moveItem(items, -1, 2)).toEqual(items);
    expect(moveItem(items, 1, 9)).toEqual(items);
  });
});
