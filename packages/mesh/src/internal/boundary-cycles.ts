import type { EdgeId, FaceId, VertexId } from "@modeling-kit/core";
import type { HalfEdgeMesh } from "../half-edge-mesh";

export function connectedFaceIslands(
  mesh: HalfEdgeMesh,
  faceIds: readonly FaceId[],
): FaceId[][] {
  const selected = new Set(faceIds);
  const remaining = new Set(faceIds);
  const islands: FaceId[][] = [];
  while (remaining.size > 0) {
    const start = remaining.values().next().value as FaceId;
    const island: FaceId[] = [];
    const queue = [start];
    remaining.delete(start);
    while (queue.length > 0) {
      const faceId = queue.pop()!;
      island.push(faceId);
      for (const edgeId of mesh.getFaceEdges(faceId)) {
        const [f1, f2] = mesh.getEdgeFaces(edgeId);
        const other = f1 === faceId ? f2 : f1;
        if (other && selected.has(other) && remaining.has(other)) {
          remaining.delete(other);
          queue.push(other);
        }
      }
    }
    islands.push(island);
  }
  return islands;
}

export function collectBoundaryEdges(
  mesh: HalfEdgeMesh,
  selected: ReadonlySet<FaceId>,
): Array<{ a: VertexId; b: VertexId; edgeId: EdgeId }> {
  const out: Array<{ a: VertexId; b: VertexId; edgeId: EdgeId }> = [];
  for (const faceId of selected) {
    const loop = mesh.getFaceVertices(faceId);
    const edges = mesh.getFaceEdges(faceId);
    for (let i = 0; i < loop.length; i++) {
      const edgeId = edges[i]!;
      const [f1, f2] = mesh.getEdgeFaces(edgeId);
      const other = f1 === faceId ? f2 : f1;
      if (other && selected.has(other)) {
        continue;
      }
      out.push({ a: loop[i]!, b: loop[(i + 1) % loop.length]!, edgeId });
    }
  }
  return out;
}
