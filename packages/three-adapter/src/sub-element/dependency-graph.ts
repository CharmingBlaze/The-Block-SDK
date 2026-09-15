import type { EdgeId, FaceId, VertexId } from "@modeling-kit/core";
import type { HalfEdgeMesh } from "@modeling-kit/mesh";

export interface AffectedTopology {
  readonly vertices: VertexId[];
  readonly edges: EdgeId[];
  readonly faces: FaceId[];
  readonly truncated: boolean;
}

const DEFAULT_LIMIT = 250_000;

/** Iterative vertex → incident edge/face expansion. Does not flood the mesh. */
export function collectAffectedFromVertices(
  mesh: HalfEdgeMesh,
  seeds: readonly VertexId[],
  limit = DEFAULT_LIMIT,
): AffectedTopology {
  const vertices: VertexId[] = [];
  const edges: EdgeId[] = [];
  const faces: FaceId[] = [];
  const seenV = new Set<VertexId>();
  const seenE = new Set<EdgeId>();
  const seenF = new Set<FaceId>();
  const queue = seeds.slice();
  let processed = 0;
  let truncated = false;

  while (queue.length > 0) {
    const vertexId = queue.pop()!;
    if (seenV.has(vertexId)) {
      continue;
    }
    seenV.add(vertexId);
    vertices.push(vertexId);
    processed += 1;
    if (processed > limit) {
      truncated = true;
      break;
    }
    for (const edgeId of mesh.getVertexEdges(vertexId)) {
      if (seenE.has(edgeId)) {
        continue;
      }
      seenE.add(edgeId);
      edges.push(edgeId);
    }
    for (const faceId of mesh.getVertexFaces(vertexId)) {
      if (seenF.has(faceId)) {
        continue;
      }
      seenF.add(faceId);
      faces.push(faceId);
    }
  }

  return { vertices, edges, faces, truncated };
}
