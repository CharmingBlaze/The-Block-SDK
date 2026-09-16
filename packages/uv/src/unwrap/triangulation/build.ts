import type { CornerId, FaceId, VertexId } from "@modeling-kit/core";
import type { HalfEdgeMesh } from "@modeling-kit/mesh";
import { UvUnwrapError } from "../errors";
import type { UvTriangulationMapping, UvUnwrapBackendInput } from "../types";
import { triangulateFaceForUnwrap } from "./face";
import { createUnwrapVertexTable } from "./vertices";

export interface BuiltUvTriangulation {
  readonly input: UvUnwrapBackendInput;
  readonly mapping: UvTriangulationMapping;
  readonly vertexIds: readonly VertexId[];
}

export function buildUvTriangulation(
  mesh: HalfEdgeMesh,
  faceIds: readonly FaceId[],
): BuiltUvTriangulation {
  if (faceIds.length === 0) {
    throw new UvUnwrapError("empty-selection", "Automatic chart unwrap requires at least one face");
  }

  const vertices = createUnwrapVertexTable(mesh);
  const triangleFaceIds: FaceId[] = [];
  const triangleCornerIds: Array<[CornerId, CornerId, CornerId]> = [];
  const triangleVertexIndices: Array<[number, number, number]> = [];
  const indices: number[] = [];

  for (const faceId of faceIds) {
    for (const triangle of triangulateFaceForUnwrap(mesh, faceId)) {
      const a = vertices.indexOf(triangle.vertexIds[0]);
      const b = vertices.indexOf(triangle.vertexIds[1]);
      const c = vertices.indexOf(triangle.vertexIds[2]);
      if (a === b || b === c || a === c) {
        throw new UvUnwrapError("degenerate-triangle", `Degenerate triangle produced for face ${faceId}`, {
          faceIds: [faceId],
          cornerIds: [...triangle.corners],
        });
      }
      indices.push(a, b, c);
      triangleFaceIds.push(faceId);
      triangleCornerIds.push([triangle.corners[0], triangle.corners[1], triangle.corners[2]]);
      triangleVertexIndices.push([a, b, c]);
    }
  }

  if (indices.length === 0) {
    throw new UvUnwrapError("empty-mesh", "Automatic chart unwrap produced no triangles");
  }
  if (indices.length % 3 !== 0) {
    throw new UvUnwrapError("invalid-indices", "Automatic chart unwrap produced a non-triangle index buffer");
  }

  return {
    input: {
      positions: vertices.toPositions(),
      indices: new Uint32Array(indices),
    },
    mapping: {
      triangleFaceIds,
      triangleCornerIds,
      triangleVertexIndices,
    },
    vertexIds: vertices.vertexIds,
  };
}
