import type { VertexId } from "@modeling-kit/core";
import type { HalfEdgeMesh } from "@modeling-kit/mesh";
import { UvUnwrapError } from "../errors";

export interface UnwrapVertexTable {
  readonly vertexIds: readonly VertexId[];
  indexOf(vertexId: VertexId): number;
  toPositions(): Float32Array;
}

export function createUnwrapVertexTable(mesh: HalfEdgeMesh): UnwrapVertexTable {
  const vertexIndex = new Map<VertexId, number>();
  const vertexIds: VertexId[] = [];
  const positions: number[] = [];

  return {
    get vertexIds() {
      return vertexIds;
    },
    indexOf(vertexId: VertexId): number {
      const existing = vertexIndex.get(vertexId);
      if (existing !== undefined) {
        return existing;
      }
      const vertex = mesh.vertices.get(vertexId);
      if (!vertex) {
        throw new UvUnwrapError("missing-corner-mapping", `Missing vertex ${vertexId}`);
      }
      const [x, y, z] = vertex.position;
      if (![x, y, z].every(Number.isFinite)) {
        throw new UvUnwrapError("non-finite-position", `Vertex ${vertexId} has a non-finite position`);
      }
      const next = vertexIds.length;
      vertexIndex.set(vertexId, next);
      vertexIds.push(vertexId);
      positions.push(x, y, z);
      return next;
    },
    toPositions(): Float32Array {
      return new Float32Array(positions);
    },
  };
}
