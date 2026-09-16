import { describe, expect, it } from "vitest";
import { defaultSubElementTheme } from "../src/sub-element/theme";
import { edgeDisplayColor, faceFillColor, vertexDisplayColor } from "../src/sub-element/selection-colors";

describe("selection overlay colors", () => {
  it("maps visual states without renderer lifecycle", () => {
    const selected = vertexDisplayColor(defaultSubElementTheme, "selected");
    expect(selected.opacity).toBeGreaterThan(0);
    const hidden = edgeDisplayColor(defaultSubElementTheme, "interior", "hidden");
    expect(hidden.opacity).toBe(0);
    const tint = faceFillColor(defaultSubElementTheme, "selected", "tint");
    const fill = faceFillColor(defaultSubElementTheme, "selected", "fill");
    expect(tint.opacity).toBeLessThanOrEqual(fill.opacity);
  });
});
