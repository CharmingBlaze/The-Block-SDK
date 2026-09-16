import { describe, expect, it } from "vitest";
import { createSequenceIdFactory } from "@modeling-kit/core";
import { CreatePrimitiveCommand, SetTransformsCommand, createModelingSession } from "@modeling-kit/commands";
import { PerspectiveCamera, Scene } from "three";
import { ThreeViewportAdapter } from "../src/adapter";
import {
  BruteForceSpatialQuery,
  BvhSpatialQuery,
  spatialPrimitivesFingerprint,
} from "../src/spatial-query";

function stubRenderer() {
  return {
    setSize: () => undefined,
    setPixelRatio: () => undefined,
  };
}

describe("SpatialQueryBackend", () => {
  it("returns the closest hit from brute-force testers", () => {
    const backend = new BruteForceSpatialQuery([
      () => ({ objectId: "far", distance: 4, point: { x: 0, y: 0, z: 4 } }),
      () => ({ objectId: "near", distance: 1, point: { x: 0, y: 0, z: 1 } }),
    ]);
    const hit = backend.raycast({
      origin: { x: 0, y: 0, z: 0 },
      direction: { x: 0, y: 0, z: 1 },
    });
    expect(hit?.objectId).toBe("near");
    backend.dispose();
  });

  it("returns null when no testers are registered so CPU Raycaster remains canonical", () => {
    const backend = new BruteForceSpatialQuery();
    expect(
      backend.raycast({
        origin: { x: 0, y: 0, z: 0 },
        direction: { x: 0, y: 0, z: 1 },
      }),
    ).toBeNull();
    backend.dispose();
  });

  it("raycasts the nearest object AABB in a rebuilt tree", () => {
    const backend = new BvhSpatialQuery([
      { objectId: "far", min: { x: -0.5, y: -0.5, z: 4 }, max: { x: 0.5, y: 0.5, z: 5 }, revision: 1 },
      { objectId: "near", min: { x: -0.5, y: -0.5, z: 1 }, max: { x: 0.5, y: 0.5, z: 2 }, revision: 1 },
    ]);
    const hit = backend.raycast({
      origin: { x: 0, y: 0, z: 0 },
      direction: { x: 0, y: 0, z: 1 },
    });
    expect(hit?.objectId).toBe("near");
    expect(hit?.distance).toBeCloseTo(1);
    backend.setBoxes([]);
    expect(
      backend.raycast({
        origin: { x: 0, y: 0, z: 0 },
        direction: { x: 0, y: 0, z: 1 },
      }),
    ).toBeNull();
    backend.dispose();
  });

  it("skips rebuild when ids, revisions, and bounds are unchanged", () => {
    const boxes = [
      { objectId: "a", min: { x: 0, y: 0, z: 0 }, max: { x: 1, y: 1, z: 1 }, revision: 3 },
    ];
    const backend = new BvhSpatialQuery(boxes);
    expect(backend.rebuildCount).toBe(1);
    backend.syncPrimitives(boxes);
    backend.syncPrimitives([{ ...boxes[0]! }]);
    expect(backend.rebuildCount).toBe(1);
    backend.syncPrimitives([{ ...boxes[0]!, revision: 4 }]);
    expect(backend.rebuildCount).toBe(2);
    backend.dispose();
  });

  it("fingerprints primitives independently of input order", () => {
    const a = { objectId: "a", min: { x: 0, y: 0, z: 0 }, max: { x: 1, y: 1, z: 1 }, revision: 1 };
    const b = { objectId: "b", min: { x: 2, y: 0, z: 0 }, max: { x: 3, y: 1, z: 1 }, revision: 2 };
    expect(spatialPrimitivesFingerprint([a, b])).toBe(spatialPrimitivesFingerprint([b, a]));
  });
});

describe("adapter spatial BVH", () => {
  it("rebuilds on mount and transform, not on pick or view", () => {
    const session = createModelingSession(createSequenceIdFactory("bvh-rev"));
    const cube = session.execute(new CreatePrimitiveCommand("cube", { width: 1, height: 1, depth: 1 }));
    const backend = new BvhSpatialQuery();
    const adapter = new ThreeViewportAdapter({
      session,
      scene: new Scene(),
      camera: new PerspectiveCamera(50, 1, 0.1, 100),
      renderer: stubRenderer(),
      spatialQuery: backend,
      ownsSpatialQuery: true,
    });
    adapter.mount();
    expect(backend.rebuildCount).toBe(1);
    expect(backend.primitiveCount).toBeGreaterThan(0);
    const afterMount = backend.rebuildCount;
    adapter.pick(0, 0, { domain: "object" });
    adapter.updateView();
    expect(backend.rebuildCount).toBe(afterMount);
    session.execute(
      new SetTransformsCommand({
        objects: [
          {
            objectId: cube.objectId,
            before: session.document.scene.nodes.get(cube.objectId)!.localTransform,
            after: {
              position: { x: 2, y: 0, z: 0 },
              rotation: { x: 0, y: 0, z: 0, w: 1 },
              scale: { x: 1, y: 1, z: 1 },
            },
          },
        ],
      }),
    );
    expect(backend.rebuildCount).toBeGreaterThan(afterMount);
    adapter.dispose();
  });
});
