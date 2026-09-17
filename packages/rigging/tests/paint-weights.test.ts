import { createSequenceIdFactory, type BoneId, type VertexId } from "@modeling-kit/core";
import { MeshBuilder } from "@modeling-kit/mesh";
import { describe, expect, it } from "vitest";
import {
  dilateWeights,
  paintWeights,
  pruneWeights,
  smoothWeights,
  type BoneWeight,
} from "../src/index";

type WeightMap = Map<VertexId, readonly BoneWeight[]>;

function scene() {
  const ids = createSequenceIdFactory("paint");
  const mesh = MeshBuilder.createCube(2, 2, 2, ids.mesh());
  return { ids, mesh, vertexIds: [...mesh.vertices.keys()], boneA: ids.bone(), boneB: ids.bone() };
}

/** Binds the seed fully to `boneA` and every other cube vertex fully to `boneB`. */
function boundAll(
  vertexIds: readonly VertexId[],
  boneA: BoneId,
  boneB: BoneId,
  seed: VertexId,
): WeightMap {
  const map: WeightMap = new Map();
  for (const vertexId of vertexIds) {
    map.set(
      vertexId,
      vertexId === seed ? [{ boneId: boneA, weight: 1 }] : [{ boneId: boneB, weight: 1 }],
    );
  }
  return map;
}

describe("weight painting", () => {
  it("gives an unbound vertex full influence on the first stroke", () => {
    const { vertexIds, boneA } = scene();
    const v = vertexIds[0]!;
    const { weights, changed } = paintWeights(new Map(), {
      boneId: boneA,
      hits: [{ vertexId: v, strength: 0.5 }],
    });
    expect(changed).toEqual([v]);
    expect(weights.get(v)).toEqual([{ boneId: boneA, weight: 1 }]);
  });

  it("add dilutes the existing bones through normalisation", () => {
    const { vertexIds, boneA, boneB } = scene();
    const v = vertexIds[0]!;
    const { weights } = paintWeights(new Map([[v, [{ boneId: boneB, weight: 1 }]]]), {
      boneId: boneA,
      hits: [{ vertexId: v, strength: 0.5 }],
    });
    const settled = weights.get(v)!;
    expect(settled).toHaveLength(2);
    expect(settled[0]!.boneId).toBe(boneB);
    expect(settled[0]!.weight).toBeCloseTo(2 / 3, 10);
    expect(settled[1]!.weight).toBeCloseTo(1 / 3, 10);
    expect(settled.reduce((sum, item) => sum + item.weight, 0)).toBeCloseTo(1, 10);
  });

  it("replace pins the target bone and scales the rest into the remainder", () => {
    const { vertexIds, boneA, boneB } = scene();
    const v = vertexIds[0]!;
    const { weights } = paintWeights(new Map([[v, [{ boneId: boneB, weight: 1 }]]]), {
      boneId: boneA,
      mode: "replace",
      hits: [{ vertexId: v, strength: 0.4 }],
    });
    const settled = weights.get(v)!;
    expect(settled.find((item) => item.boneId === boneA)!.weight).toBeCloseTo(0.4, 10);
    expect(settled.find((item) => item.boneId === boneB)!.weight).toBeCloseTo(0.6, 10);
  });

  it("treats a zero-strength stroke as a no-op", () => {
    const { vertexIds, boneA } = scene();
    const v = vertexIds[0]!;
    const start: WeightMap = new Map([[v, [{ boneId: boneA, weight: 1 }]]]);
    const result = paintWeights(start, { boneId: boneA, hits: [{ vertexId: v, strength: 0 }] });
    expect(result.changed).toEqual([]);
    expect(result.weights.get(v)).toEqual(start.get(v));
  });

  it("caps influences at the canonical maximum of four", () => {
    const { ids, vertexIds, boneA } = scene();
    const v = vertexIds[0]!;
    const extra = [ids.bone(), ids.bone(), ids.bone(), ids.bone()];
    const start: WeightMap = new Map([
      [v, [{ boneId: boneA, weight: 0.5 }, ...extra.map((id) => ({ boneId: id, weight: 0.125 }))]],
    ]);
    const { weights } = paintWeights(start, { boneId: boneA, hits: [{ vertexId: v, strength: 0.5 }] });
    const settled = weights.get(v)!;
    expect(settled).toHaveLength(4);
    expect(settled[0]!.boneId).toBe(boneA);
  });

  it("leaves raw weights alone when normalize is false", () => {
    const { ids, vertexIds, boneA } = scene();
    const v = vertexIds[0]!;
    const other = ids.bone();
    const start: WeightMap = new Map([[v, [{ boneId: other, weight: 1 }]]]);
    const { weights } = paintWeights(start, {
      boneId: boneA,
      normalize: false,
      hits: [{ vertexId: v, strength: 0.5 }],
    });
    const settled = weights.get(v)!;
    expect(settled.find((item) => item.boneId === boneA)!.weight).toBe(0.5);
    expect(settled.reduce((sum, item) => sum + item.weight, 0)).toBeCloseTo(1.5, 10);
  });

  it("rejects bad modes and non-finite strengths", () => {
    const { vertexIds, boneA } = scene();
    const v = vertexIds[0]!;
    expect(() =>
      paintWeights(new Map(), {
        boneId: boneA,
        mode: "multiply" as "add",
        hits: [{ vertexId: v, strength: 0.5 }],
      }),
    ).toThrow(/mode/);
    expect(() =>
      paintWeights(new Map(), { boneId: boneA, hits: [{ vertexId: v, strength: Number.NaN }] }),
    ).toThrow(/finite/);
  });

  it("prunes negligible influences and reports emptied vertices", () => {
    const { ids, vertexIds, boneA } = scene();
    const [a, b] = vertexIds;
    const junk = ids.bone();
    const start: WeightMap = new Map([
      [a!, [{ boneId: boneA, weight: 1 }]],
      [b!, [{ boneId: junk, weight: 1e-9 }]],
    ]);

    const result = pruneWeights(start, { threshold: 1e-6 });
    expect(result.removed).toBe(1);
    expect(result.emptied).toEqual([b]);
    expect(result.weights.get(a!)).toEqual([{ boneId: boneA, weight: 1 }]);
    expect(result.weights.get(b!)).toEqual([]);
    expect(() => pruneWeights(new Map(), { threshold: -1 })).toThrow(/threshold/);
  });

  it("smooths influence across a real shared edge", () => {
    const { mesh, vertexIds, boneA, boneB } = scene();
    const seed = vertexIds[0]!;
    // Take an actual edge neighbour rather than assuming key order is adjacency.
    const ends = mesh.getEdgeVertices(mesh.getVertexEdges(seed)[0]!)!;
    const neighbour = ends[0] === seed ? ends[1] : ends[0];

    const start: WeightMap = new Map([
      [seed, [{ boneId: boneA, weight: 1 }]],
      [neighbour, [{ boneId: boneB, weight: 1 }]],
    ]);

    const { weights, smoothed } = smoothWeights(mesh, start, { vertices: [seed, neighbour] });
    expect(smoothed).toHaveLength(2);
    // A corner has three edge neighbours, so the pair sits in a 4-sample average.
    for (const vertexId of [seed, neighbour]) {
      const settled = weights.get(vertexId)!;
      expect(settled).toHaveLength(2);
      expect(settled.reduce((sum, item) => sum + item.weight, 0)).toBeCloseTo(1, 10);
      for (const item of settled) {
        expect(item.weight).toBeCloseTo(0.5, 10);
      }
    }
    expect(() => smoothWeights(mesh, start, { iterations: 0 })).toThrow(/iterations/);
  });

  it("dilates outward through bound neighbours only", () => {
    const { mesh, vertexIds, boneA, boneB } = scene();
    const [v0] = vertexIds;
    const start = boundAll(vertexIds, boneA, boneB, v0!);

    const result = dilateWeights(mesh, start, { boneId: boneA, vertices: [v0!], growth: 0.5 });
    // A cube corner has three edge neighbours, all of them bound here.
    expect(result.grew).toHaveLength(3);
    expect(result.skipped).toBe(0);
    for (const vertexId of result.grew) {
      const settled = result.weights.get(vertexId)!;
      expect(settled.find((item) => item.boneId === boneA)!.weight).toBeCloseTo(1 / 3, 10);
      expect(settled.find((item) => item.boneId === boneB)!.weight).toBeCloseTo(2 / 3, 10);
    }

    const twoPass = dilateWeights(mesh, start, {
      boneId: boneA,
      vertices: [v0!],
      growth: 0.5,
      iterations: 2,
    });
    expect(twoPass.grew.length).toBeGreaterThanOrEqual(6);
    expect(() => dilateWeights(mesh, start, { boneId: boneA, vertices: [], iterations: 0 })).toThrow(
      /iterations/,
    );
  });

  it("skips unbound neighbours instead of handing them full weight", () => {
    const { mesh, vertexIds, boneA } = scene();
    const [v0] = vertexIds;
    const start: WeightMap = new Map([[v0!, [{ boneId: boneA, weight: 1 }]]]);
    const result = dilateWeights(mesh, start, { boneId: boneA, vertices: [v0!], growth: 0.5 });
    // Every neighbour is unbound, so nothing is created and none of them is 1.0.
    expect(result.grew).toEqual([]);
    expect(result.skipped).toBe(3);
  });

  it("is deterministic for identical input", () => {
    const { vertexIds, boneA, boneB } = scene();
    const v = vertexIds[0]!;
    const run = () =>
      paintWeights(new Map([[v, [{ boneId: boneB, weight: 1 }]]]), {
        boneId: boneA,
        hits: [{ vertexId: v, strength: 0.25 }],
      });
    expect(JSON.stringify(run().weights.get(v))).toBe(JSON.stringify(run().weights.get(v)));
  });
});