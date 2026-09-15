import type { FaceId } from "@modeling-kit/core";
import type { HalfEdgeMesh } from "../half-edge-mesh";
import type { HalfEdgeRecord } from "../types";
import { repairVertexHalfEdges } from "./rebuild";

/**
 * Reverse a face loop in place. Recreating the face through MeshBuilder cannot
 * represent a single-face winding flip on a closed mesh: the reversed directed
 * edges are already occupied by neighboring faces.
 */
export function reverseFaceLoop(mesh: HalfEdgeMesh, faceId: FaceId): void {
  const face = mesh.faces.get(faceId);
  if (!face) {
    return;
  }
  const loop: HalfEdgeRecord[] = [];
  let curr = face.halfEdge;
  const start = curr;
  do {
    const he = mesh.halfEdges.get(curr);
    if (!he) {
      break;
    }
    loop.push(he);
    curr = he.next;
  } while (curr !== start);

  const n = loop.length;
  if (n < 3) {
    return;
  }

  const oldNext = loop.map((he) => he.next);
  const oldPrev = loop.map((he) => he.prev);
  const oldCorners = loop.map((he) => he.corner);
  const destinations = loop.map((he, index) => {
    const next = mesh.halfEdges.get(he.next);
    return next?.origin ?? loop[(index + 1) % n]!.origin;
  });

  for (let i = 0; i < n; i++) {
    const he = loop[i]!;
    he.next = oldPrev[i]!;
    he.prev = oldNext[i]!;
    he.origin = destinations[i]!;
    he.corner = oldCorners[(i + 1) % n]!;
    if (he.corner) {
      const corner = mesh.corners.get(he.corner);
      if (corner) {
        mesh.corners.set(he.corner, { ...corner, vertexId: he.origin });
      }
    }
  }

  repairVertexHalfEdges(mesh);
  mesh.bumpRevision();
}
