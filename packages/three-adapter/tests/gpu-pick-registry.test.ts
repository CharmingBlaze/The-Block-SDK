import { brand } from "@modeling-kit/core";
import { describe, expect, it } from "vitest";
import { InMemoryGpuPickRegistry } from "../src/gpu-picking/registry";
import { encodePickId } from "../src/gpu-picking/encode";

function allocatedId(id: number | undefined): number {
  if (id === undefined) {
    throw new Error("expected pick id");
  }
  return id;
}

describe("GpuPickRegistry", () => {
  it("does not resolve background or unallocated IDs", () => {
    const registry = new InMemoryGpuPickRegistry();
    expect(registry.resolve(0)).toBeUndefined();
    expect(registry.resolve(1)).toBeUndefined();
  });

  it("allocates and resolves records without hashing canonical IDs", () => {
    const registry = new InMemoryGpuPickRegistry();
    const objectId = brand<string, "ObjectId">("obj-live");
    const faceId = brand<string, "FaceId">("face-live");
    const pickId = registry.allocate({
      objectId,
      domain: "face",
      faceId,
      triangleIndex: 0,
    });
    expect(pickId).toBe(1);
    expect(typeof objectId).toBe("string");
    expect(encodePickId(pickId!).r).toBe(0);
    expect(registry.resolve(pickId!)).toEqual({
      objectId,
      domain: "face",
      faceId,
      triangleIndex: 0,
    });
  });

  it("clears stale IDs after a rebuild", () => {
    const registry = new InMemoryGpuPickRegistry();
    const first = allocatedId(registry.allocate({
      objectId: brand<string, "ObjectId">("a"),
      domain: "object",
    }));
    registry.clear();
    expect(registry.resolve(first)).toBeUndefined();
    const second = registry.allocate({
      objectId: brand<string, "ObjectId">("b"),
      domain: "object",
    });
    expect(second).toBe(1);
    expect(registry.resolve(second!)?.objectId).toBe("b");
  });

  it("invalidates object and face entries without changing other IDs", () => {
    const registry = new InMemoryGpuPickRegistry();
    const keep = allocatedId(registry.allocate({
      objectId: brand<string, "ObjectId">("keep"),
      domain: "object",
    }));
    const objectId = brand<string, "ObjectId">("drop");
    const droppedObject = allocatedId(registry.allocate({ objectId, domain: "object" }));
    const faceId = brand<string, "FaceId">("f-drop");
    const droppedFace = allocatedId(registry.allocate({
      objectId: brand<string, "ObjectId">("other"),
      domain: "face",
      faceId,
      triangleIndex: 3,
    }));
    registry.invalidateObject(objectId);
    registry.invalidateFace(faceId);
    expect(registry.resolve(keep)?.objectId).toBe("keep");
    expect(registry.resolve(droppedObject)).toBeUndefined();
    expect(registry.resolve(droppedFace)).toBeUndefined();
  });

  it("returns undefined instead of wrapping past the codec maximum", () => {
    const registry = new InMemoryGpuPickRegistry({
      backgroundId: 0,
      maxId: 2,
      encodeToRgb: encodePickId,
      decodeFromRgb: () => 0,
    });
    expect(registry.allocate({ objectId: brand<string, "ObjectId">("a"), domain: "object" })).toBe(1);
    expect(registry.allocate({ objectId: brand<string, "ObjectId">("b"), domain: "object" })).toBe(2);
    expect(
      registry.allocate({
        objectId: brand<string, "ObjectId">("overflow"),
        domain: "object",
      }),
    ).toBeUndefined();
  });
});
