import { describe, expect, it } from "vitest";
import { brand } from "@modeling-kit/core";
import { SelectionManager } from "../src/index";

describe("SelectionManager", () => {
  it("replaces, snapshots, and remaps", () => {
    const selection = new SelectionManager();
    const objectId = brand<string, "ObjectId">("obj-1");
    selection.replace({
      domain: "face",
      objectId,
      elementIds: ["f-a", "f-b"],
    });
    expect(selection.activeId).toBe("f-a");
    const snap = selection.snapshot();
    selection.applyRemap({
      map: new Map([["f-a", "f-a2"]]),
      deleted: new Set(["f-b"]),
    });
    expect(selection.elementIds).toEqual(["f-a2"]);
    selection.restore(snap);
    expect(selection.elementIds).toEqual(["f-a", "f-b"]);
  });

  it("notifies listeners on replace", () => {
    const selection = new SelectionManager();
    const seen: string[] = [];
    selection.onChange((snapshot) => {
      seen.push(snapshot.domain);
    });
    selection.replace({ domain: "object", objectIds: [brand<string, "ObjectId">("o")] });
    expect(seen).toEqual(["object"]);
  });

  it("adds, toggles, removes, and clears while tracking the active element", () => {
    const selection = new SelectionManager();
    const objectId = brand<string, "ObjectId">("obj-2");
    selection.replace({ domain: "vertex", objectId, elementIds: ["v1"] });
    selection.add(["v2", "v3"]);
    expect(selection.elementIds).toEqual(["v1", "v2", "v3"]);
    expect(selection.activeId).toBe("v3");
    selection.toggle("v2");
    expect(selection.elementIds).toEqual(["v1", "v3"]);
    selection.remove(["v1"]);
    expect(selection.activeId).toBe("v3");
    selection.clear();
    expect(selection.domain).toBe("none");
    expect(selection.elementIds).toEqual([]);
    expect(selection.activeId).toBeNull();
    selection.replace({ domain: "object", objectIds: [objectId] });
    expect(selection.domain).toBe("object");
    expect(selection.objectIds).toEqual([objectId]);
    expect(selection.activeId).toBe(objectId);
    const off = selection.onChange(() => undefined);
    off();
    selection.dispose();
  });
});
