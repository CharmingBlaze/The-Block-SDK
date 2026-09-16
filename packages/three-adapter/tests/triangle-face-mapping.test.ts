import { MeshBuilder, triangulateMesh, type HalfEdgeMesh } from "@modeling-kit/mesh";
import { generateQuadSphere, generateTorus, generateUvSphere } from "@modeling-kit/primitives";
import { describe, expect, it } from "vitest";
import { createBufferGeometry } from "../src/geometry";

function expectLiveFaceMapping(mesh: HalfEdgeMesh): void {
  const tri = triangulateMesh(mesh);
  expect(tri.triangleFaceIds.length).toBe(tri.indices.length / 3);
  expect(tri.triangleFaceIds.length).toBeGreaterThan(0);
  for (const faceId of tri.triangleFaceIds) {
    expect(mesh.faces.has(faceId), `missing FaceId ${faceId}`).toBe(true);
  }
  const derived = createBufferGeometry(mesh);
  expect(derived.mapping.triangleToFace).toEqual(tri.triangleFaceIds);
  expect(derived.geometry.getIndex()?.count).toBe(tri.indices.length);
}

describe("canonical triangle-to-face mapping", () => {
  it("maps both cube render triangles to the same canonical quad FaceId", () => {
    const cube = MeshBuilder.createCube(1, 1, 1);
    const tri = triangulateMesh(cube);
    expect(tri.triangleFaceIds).toHaveLength(12);
    const counts = new Map<string, number>();
    for (const faceId of tri.triangleFaceIds) {
      counts.set(faceId, (counts.get(faceId) ?? 0) + 1);
    }
    expect(counts.size).toBe(6);
    for (const [faceId, count] of counts) {
      expect(count, faceId).toBe(2);
    }
    const derived = createBufferGeometry(cube);
    expect(derived.mapping.triangleToFace[0]).toBe(derived.mapping.triangleToFace[1]);
    expectLiveFaceMapping(cube);
  });

  it("maps a single triangle face to one FaceId", () => {
    const builder = new MeshBuilder();
    const v0 = builder.addVertex(0, 0, 0);
    const v1 = builder.addVertex(1, 0, 0);
    const v2 = builder.addVertex(0, 1, 0);
    const faceId = builder.addFace([v0, v1, v2]);
    const mesh = builder.getMesh();
    const tri = triangulateMesh(mesh);
    expect(tri.triangleFaceIds).toEqual([faceId]);
    expectLiveFaceMapping(mesh);
  });

  it("maps a concave n-gon to one FaceId across every render triangle", () => {
    const builder = new MeshBuilder();
    const v0 = builder.addVertex(0, 0, 0);
    const v1 = builder.addVertex(2, 0, 0);
    const v2 = builder.addVertex(2, 0, 1);
    const v3 = builder.addVertex(1, 0, 1);
    const v4 = builder.addVertex(1, 0, 2);
    const v5 = builder.addVertex(0, 0, 2);
    const faceId = builder.addFace([v0, v1, v2, v3, v4, v5]);
    const mesh = builder.getMesh();
    const tri = triangulateMesh(mesh);
    expect(tri.triangleFaceIds.length).toBeGreaterThan(1);
    expect(tri.triangleFaceIds.every((id) => id === faceId)).toBe(true);
    expectLiveFaceMapping(mesh);
  });

  it("maps UV sphere, quad sphere, and torus triangles to live FaceIds", () => {
    expectLiveFaceMapping(generateUvSphere({ radius: 0.5, widthSegments: 8, heightSegments: 6 }).mesh);
    expectLiveFaceMapping(generateQuadSphere({ radius: 0.5, segments: 3 }).mesh);
    expectLiveFaceMapping(generateTorus({ radius: 0.5, tube: 0.15, radialSegments: 6, tubularSegments: 8 }).mesh);
  });
});
