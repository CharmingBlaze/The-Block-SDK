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

  it("mutates objectIds for object-domain add, remove, toggle, and remap", () => {
    const selection = new SelectionManager();
    const a = brand<string, "ObjectId">("obj-a");
    const b = brand<string, "ObjectId">("obj-b");
    const c = brand<string, "ObjectId">("obj-c");
    selection.replace({ domain: "object", objectIds: [a], activeId: a });
    expect(selection.objectIds).toEqual([a]);
    expect(selection.elementIds).toEqual([]);
    expect(selection.activeId).toBe(a);

    selection.add([b]);
    expect(selection.objectIds).toEqual([a, b]);
    expect(selection.elementIds).toEqual([]);
    expect(selection.activeId).toBe(b);

    selection.toggle(c);
    expect(selection.objectIds).toEqual([a, b, c]);
    selection.toggle(b);
    expect(selection.objectIds).toEqual([a, c]);
    expect(selection.activeId).toBe(c);

    selection.remove([a]);
    expect(selection.objectIds).toEqual([c]);
    expect(selection.activeId).toBe(c);

    const snap = selection.snapshot();
    selection.add([a]);
    selection.restore(snap);
    expect(selection.objectIds).toEqual([c]);
    expect(selection.activeId).toBe(c);

    selection.replace({ domain: "object", objectIds: [a, c], activeId: a });
    selection.applyRemap({
      map: new Map([[a, "obj-a2"]]),
      deleted: new Set([c]),
    });
    expect(selection.objectIds).toEqual(["obj-a2"]);
    expect(selection.activeId).toBe("obj-a2");
    expect(selection.elementIds).toEqual([]);
  });
});
