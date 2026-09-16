import { describe, expect, it } from "vitest";
import { invertRemap, remapTriangles } from "../src/mapping";
import { MeshoptJobMachine } from "../src/job-lifecycle";
import type { FaceId } from "@modeling-kit/core";
import { brand } from "@modeling-kit/core";

describe("meshopt mapping helpers", () => {
  it("recovers face ids after a compacting vertex remap", () => {
    const original = new Uint32Array([0, 1, 2, 0, 2, 3]);
    const remap = new Uint32Array([2, 0, 1, 3]);
    const unique = 4;
    const inverse = invertRemap(remap, unique);
    const reordered = new Uint32Array([
      remap[0]!,
      remap[1]!,
      remap[2]!,
      remap[0]!,
      remap[2]!,
      remap[3]!,
    ]);
    const faceA = brand<string, "FaceId">("face-a") as FaceId;
    const faceB = brand<string, "FaceId">("face-b") as FaceId;
    const result = remapTriangles(original, reordered, [faceA, faceB], inverse);
    expect(result.dropped).toBe(0);
    expect(result.ids).toEqual([faceA, faceB]);
  });
});

describe("meshopt job machine", () => {
  it("rejects illegal transitions", () => {
    const machine = new MeshoptJobMachine();
    expect(machine.transition("completed")).toBe(false);
    expect(machine.transition("running")).toBe(true);
    expect(machine.transition("cancelling")).toBe(true);
    expect(machine.transition("completed")).toBe(false);
    expect(machine.transition("failed")).toBe(true);
    expect(machine.transition("disposed")).toBe(true);
    expect(machine.terminal).toBe(true);
  });
});
