import { expect } from "vitest";
import { meshFingerprint, type HalfEdgeMesh } from "../../src/index";

export function assertClosedManifold(mesh: HalfEdgeMesh): void {
  expect(mesh.findBoundaryEdges()).toHaveLength(0);
  for (const [edgeId] of mesh.edges) {
    const [f1, f2] = mesh.getEdgeFaces(edgeId);
    expect(f1).toBeTruthy();
    expect(f2).toBeTruthy();
  }
  assertFinitePositions(mesh);
}

export function assertManifoldAllowBoundary(mesh: HalfEdgeMesh): void {
  for (const [edgeId] of mesh.edges) {
    const [f1, f2] = mesh.getEdgeFaces(edgeId);
    const count = (f1 ? 1 : 0) + (f2 ? 1 : 0);
    expect(count).toBeGreaterThanOrEqual(1);
    expect(count).toBeLessThanOrEqual(2);
  }
  assertFinitePositions(mesh);
}

export function assertFinitePositions(mesh: HalfEdgeMesh): void {
  for (const vertex of mesh.vertices.values()) {
    expect(vertex.position.every(Number.isFinite)).toBe(true);
  }
}

export function assertUnchangedOnThrow(mesh: HalfEdgeMesh, fn: () => void): void {
  const before = meshFingerprint(mesh);
  expect(fn).toThrow(RangeError);
  expect(meshFingerprint(mesh)).toBe(before);
}
