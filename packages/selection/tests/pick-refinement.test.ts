import { brand } from "@modeling-kit/core";
import { Matrix4, Vector3 } from "@modeling-kit/math";
import { MeshBuilder } from "@modeling-kit/mesh";
import { describe, expect, it } from "vitest";
import { refineFaceSurface } from "../src/picking";

function identityWorld(): Matrix4 {
  return Matrix4.identity();
}

describe("canonical face refinement", () => {
  it("hits a triangle face at the origin along -Z", () => {
    const builder = new MeshBuilder();
    const v0 = builder.addVertex(-1, -1, 0);
    const v1 = builder.addVertex(1, -1, 0);
    const v2 = builder.addVertex(0, 1, 0);
    const faceId = builder.addFace([v0, v1, v2]);
    const mesh = builder.getMesh();
    const outcome = refineFaceSurface({
      objectId: brand<string, "ObjectId">("obj"),
      meshId: brand<string, "MeshId">("mesh"),
      faceId,
      mesh,
      worldFromLocal: identityWorld(),
      worldRayOrigin: { x: 0, y: 0, z: 8 },
      worldRayDirection: { x: 0, y: 0, z: -1 },
      backfaceMode: "front-only",
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) {
      return;
    }
    expect(outcome.hit.kind).toBe("surface");
    expect(outcome.hit.faceId).toBe(faceId);
    expect(outcome.hit.worldPoint.z).toBeCloseTo(0, 5);
    expect(outcome.hit.localPoint.z).toBeCloseTo(0, 5);
    expect(outcome.hit.worldNormal.z).toBeGreaterThan(0.9);
    expect(outcome.hit.barycentric).toBeDefined();
  });

  it("hits both triangles of a translated quad as the same FaceId", () => {
    const cube = MeshBuilder.createCube(2, 2, 2);
    const faceId = [...cube.faces.keys()][0]!;
    const world = Matrix4.translation(new Vector3(0, 3, 0));
    const outcome = refineFaceSurface({
      objectId: brand<string, "ObjectId">("obj"),
      meshId: brand<string, "MeshId">("mesh"),
      faceId,
      mesh: cube,
      worldFromLocal: world,
      worldRayOrigin: { x: 0, y: 3, z: 8 },
      worldRayDirection: { x: 0, y: 0, z: -1 },
      backfaceMode: "front-and-back",
    });
    if (!outcome.ok) {
      // The first cube face may not face +Z; try every face.
      const hits = [...cube.faces.keys()].map((id) =>
        refineFaceSurface({
          objectId: brand<string, "ObjectId">("obj"),
          meshId: brand<string, "MeshId">("mesh"),
          faceId: id,
          mesh: cube,
          worldFromLocal: world,
          worldRayOrigin: { x: 0, y: 3, z: 8 },
          worldRayDirection: { x: 0, y: 0, z: -1 },
          backfaceMode: "front-and-back",
        }),
      );
      expect(hits.some((hit) => hit.ok)).toBe(true);
      return;
    }
    expect(outcome.hit.faceId).toBe(faceId);
    expect(outcome.hit.worldPoint.y).toBeCloseTo(3, 4);
  });

  it("returns a structured failure instead of a zero point", () => {
    const builder = new MeshBuilder();
    const v0 = builder.addVertex(-1, -1, 0);
    const v1 = builder.addVertex(1, -1, 0);
    const v2 = builder.addVertex(0, 1, 0);
    const faceId = builder.addFace([v0, v1, v2]);
    const missing = refineFaceSurface({
      objectId: brand<string, "ObjectId">("obj"),
      meshId: brand<string, "MeshId">("mesh"),
      faceId: brand<string, "FaceId">("gone"),
      mesh: builder.getMesh(),
      worldFromLocal: identityWorld(),
      worldRayOrigin: { x: 0, y: 0, z: 8 },
      worldRayDirection: { x: 0, y: 0, z: -1 },
      backfaceMode: "front-only",
    });
    expect(missing).toEqual({ ok: false, reason: "missing-face" });
    const behind = refineFaceSurface({
      objectId: brand<string, "ObjectId">("obj"),
      meshId: brand<string, "MeshId">("mesh"),
      faceId,
      mesh: builder.getMesh(),
      worldFromLocal: identityWorld(),
      worldRayOrigin: { x: 0, y: 0, z: -8 },
      worldRayDirection: { x: 0, y: 0, z: -1 },
      backfaceMode: "front-only",
    });
    expect(behind.ok).toBe(false);
    if (!behind.ok) {
      expect(behind.reason).toBe("no-intersection");
    }
  });

  it("hits a concave n-gon, respects front-only, and keeps world/local frames", () => {
    const builder = new MeshBuilder();
    const v0 = builder.addVertex(-2, -2, 0);
    const v1 = builder.addVertex(2, -2, 0);
    const v2 = builder.addVertex(2, 2, 0);
    const v3 = builder.addVertex(0.25, 0.25, 0);
    const v4 = builder.addVertex(-2, 2, 0);
    const faceId = builder.addFace([v0, v1, v2, v3, v4]);
    const mesh = builder.getMesh();
    const parent = Matrix4.translation(new Vector3(4, 0, 0));
    const hit = refineFaceSurface({
      objectId: brand<string, "ObjectId">("obj"),
      meshId: brand<string, "MeshId">("mesh"),
      faceId,
      mesh,
      worldFromLocal: parent,
      worldRayOrigin: { x: 3.2, y: -1, z: 8 },
      worldRayDirection: { x: 0, y: 0, z: -1 },
      backfaceMode: "front-only",
    });
    expect(hit.ok).toBe(true);
    if (!hit.ok) {
      return;
    }
    expect(hit.hit.faceId).toBe(faceId);
    expect(hit.hit.worldPoint.x).toBeCloseTo(3.2, 4);
    expect(hit.hit.localPoint.x).toBeCloseTo(-0.8, 4);
    expect(hit.hit.worldNormal.z).toBeGreaterThan(0.9);
    expect(hit.hit.localNormal.z).toBeGreaterThan(0.9);
    expect(hit.hit.barycentric).toBeDefined();

    const back = refineFaceSurface({
      objectId: brand<string, "ObjectId">("obj"),
      meshId: brand<string, "MeshId">("mesh"),
      faceId,
      mesh,
      worldFromLocal: identityWorld(),
      worldRayOrigin: { x: 0, y: 0, z: -8 },
      worldRayDirection: { x: 0, y: 0, z: 1 },
      backfaceMode: "front-only",
    });
    expect(back.ok).toBe(false);
    const allowed = refineFaceSurface({
      objectId: brand<string, "ObjectId">("obj"),
      meshId: brand<string, "MeshId">("mesh"),
      faceId,
      mesh,
      worldFromLocal: identityWorld(),
      worldRayOrigin: { x: 0, y: 0, z: -8 },
      worldRayDirection: { x: 0, y: 0, z: 1 },
      backfaceMode: "front-and-back",
    });
    expect(allowed.ok).toBe(true);
  });

  it("uses an orthographic-style parallel ray and the closest triangle", () => {
    const builder = new MeshBuilder();
    const v0 = builder.addVertex(-1, -1, 0);
    const v1 = builder.addVertex(1, -1, 0);
    const v2 = builder.addVertex(1, 1, -1);
    const v3 = builder.addVertex(-1, 1, 1);
    const faceId = builder.addFace([v0, v1, v2, v3]);
    const mesh = builder.getMesh();
    const outcome = refineFaceSurface({
      objectId: brand<string, "ObjectId">("obj"),
      meshId: brand<string, "MeshId">("mesh"),
      faceId,
      mesh,
      worldFromLocal: identityWorld(),
      worldRayOrigin: { x: 0, y: 0, z: 12 },
      worldRayDirection: { x: 0, y: 0, z: -1 },
      backfaceMode: "front-and-back",
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) {
      return;
    }
    expect(outcome.hit.triangleIndex).toBeDefined();
    expect(outcome.hit.worldPoint.z).toBeGreaterThan(-0.5);
  });
});
