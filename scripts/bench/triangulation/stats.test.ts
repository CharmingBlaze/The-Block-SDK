import { describe, expect, it } from "vitest";
import { median, mean } from "./stats.ts";

describe("triangulation bench stats", () => {
  it("returns the middle value for an odd sample count", () => {
    expect(median([3, 1, 2])).toBe(2);
  });

  it("averages the two middle values for an even sample count", () => {
    expect(median([4, 1, 2, 3])).toBe(2.5);
  });

  it("computes the arithmetic mean", () => {
    expect(mean([1, 2, 3, 4])).toBe(2.5);
  });
});
