import { brand } from "@modeling-kit/core";
import { applyPointPickToSelection, SelectionManager } from "../src/index";
import { describe, expect, it } from "vitest";
import type { IdentityPickResult } from "../src/picking";

function identityFace(faceId: string, objectId = "obj-1"): IdentityPickResult {
  return {
    kind: "identity",
    source: "gpu-id-buffer",
    domain: "face",
    objectId: brand<string, "ObjectId">(objectId),
    faceId: brand<string, "FaceId">(faceId),
  };
}

describe("applyPointPickToSelection", () => {
  it("replaces, adds, toggles, and subtracts without reading keyboard state", () => {
    const selection = new SelectionManager();
    const objectId = brand<string, "ObjectId">("obj-1");
    const faceA = brand<string, "FaceId">("f-a");
    const faceB = brand<string, "FaceId">("f-b");
    applyPointPickToSelection(selection, identityFace("f-a"));
    expect(selection.elementIds).toEqual([faceA]);
    applyPointPickToSelection(selection, identityFace("f-b"), "add");
    expect(selection.elementIds).toEqual([faceA, faceB]);
    applyPointPickToSelection(selection, identityFace("f-a"), "toggle");
    expect(selection.elementIds).toEqual([faceB]);
    applyPointPickToSelection(selection, identityFace("f-b"), "subtract");
    expect(selection.elementIds).toEqual([]);
    expect(objectId).toBe(identityFace("f-a").objectId);
  });

  it("clears on a replace miss and leaves add/toggle/subtract misses unchanged", () => {
    const selection = new SelectionManager();
    selection.replace({
      domain: "object",
      objectIds: [brand<string, "ObjectId">("keep")],
    });
    applyPointPickToSelection(selection, undefined, "add");
    expect(selection.objectIds).toHaveLength(1);
    applyPointPickToSelection(selection, undefined, "toggle");
    expect(selection.objectIds).toHaveLength(1);
    applyPointPickToSelection(selection, undefined, "subtract");
    expect(selection.objectIds).toHaveLength(1);
    applyPointPickToSelection(selection, undefined, "replace");
    expect(selection.domain).toBe("none");
  });
});
