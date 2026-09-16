import { createSequenceIdFactory, type EdgeId, type VertexId } from "@modeling-kit/core";
import { MeshBuilder, cloneMesh, type HalfEdgeMesh } from "../../src/index";

export function uniqueIds(prefix: string): ReturnType<typeof createSequenceIdFactory> {
  return createSequenceIdFactory(prefix);
}

export function closedCube(prefix: string, size = 2): {
  mesh: HalfEdgeMesh;
  ids: ReturnType<typeof createSequenceIdFactory>;
} {
  const ids = uniqueIds(prefix);
  return { mesh: cloneMesh(MeshBuilder.createCube(size, size, size, ids.mesh())), ids };
}

export function openQuad(prefix: string): {
  mesh: HalfEdgeMesh;
  ids: ReturnType<typeof createSequenceIdFactory>;
} {
  const ids = uniqueIds(prefix);
  return {
    mesh: cloneMesh(MeshBuilder.createQuad([-1, 0, -1], [1, 0, -1], [1, 0, 1], [-1, 0, 1], ids.mesh())),
    ids,
  };
}

export function disjointLoops(
  prefix: string,
  gap: number,
): {
  mesh: HalfEdgeMesh;
  loopA: VertexId[];
  loopB: VertexId[];
  ids: ReturnType<typeof createSequenceIdFactory>;
} {
  const ids = uniqueIds(prefix);
  const builder = new MeshBuilder(ids.mesh());
  const loopA = [
    builder.addVertex(-1, 0, -1),
    builder.addVertex(1, 0, -1),
    builder.addVertex(1, 0, 1),
    builder.addVertex(-1, 0, 1),
  ];
  const loopB = [
    builder.addVertex(-1, gap, -1),
    builder.addVertex(1, gap, -1),
    builder.addVertex(1, gap, 1),
    builder.addVertex(-1, gap, 1),
  ];
  return { mesh: builder.getMesh(), loopA, loopB, ids };
}

export function faceEdgeMidpoint(
  mesh: HalfEdgeMesh,
  edgeId: EdgeId,
): [number, number, number] {
  const ends = mesh.getEdgeVertices(edgeId)!;
  const a = mesh.vertices.get(ends[0])!.position;
  const b = mesh.vertices.get(ends[1])!.position;
  return [(a[0] + b[0]) * 0.5, (a[1] + b[1]) * 0.5, (a[2] + b[2]) * 0.5];
}
