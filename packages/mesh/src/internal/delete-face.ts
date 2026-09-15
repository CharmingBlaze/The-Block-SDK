import type { FaceId } from "@modeling-kit/core";
import { Vector3 } from "@modeling-kit/math";
import type { HalfEdgeMesh } from "../half-edge-mesh";

export function deleteFace(mesh: HalfEdgeMesh, faceId: FaceId): void {
  const face = mesh.faces.get(faceId);
  if (!face) {
    return;
  }
  const corners = mesh.getFaceCorners(faceId);
  const halfEdgesToDelete: string[] = [];
  let curr = face.halfEdge;
  const start = curr;
  do {
    const he = mesh.halfEdges.get(curr);
    if (!he) {
      break;
    }
    halfEdgesToDelete.push(he.id);
    if (he.twin) {
      const twin = mesh.halfEdges.get(he.twin);
      if (twin) {
        twin.twin = null;
      }
    }
    const edge = mesh.edges.get(he.edgeId);
    if (edge && edge.halfEdge === he.id) {
      if (he.twin) {
        mesh.edges.set(he.edgeId, { ...edge, halfEdge: he.twin });
      } else {
        mesh.edges.delete(he.edgeId);
      }
    }
    curr = he.next;
  } while (curr !== start);

  for (const heId of halfEdgesToDelete) {
    mesh.halfEdges.delete(heId as typeof start);
  }
  for (const cornerId of corners) {
    mesh.corners.delete(cornerId);
  }
  mesh.faces.delete(faceId);
  mesh.bumpRevision();
}

export function faceNormal(mesh: HalfEdgeMesh, faceId: FaceId): Vector3 {
  const vertexIds = mesh.getFaceVertices(faceId);
  const points = vertexIds.map((id) => {
    const v = mesh.vertices.get(id);
    if (!v) {
      throw new RangeError(`Missing vertex ${id}`);
    }
    return new Vector3(v.position[0], v.position[1], v.position[2]);
  });
  if (points.length < 3) {
    throw new RangeError("Cannot compute a normal for a degenerate face");
  }
  let normal = new Vector3(0, 0, 0);
  for (let i = 0; i < points.length; i++) {
    const current = points[i]!;
    const next = points[(i + 1) % points.length]!;
    normal = normal.add(
      new Vector3(
        (current.y - next.y) * (current.z + next.z),
        (current.z - next.z) * (current.x + next.x),
        (current.x - next.x) * (current.y + next.y),
      ),
    );
  }
  const length = normal.length();
  if (length <= 1e-12) {
    return new Vector3(0, 0, 1);
  }
  return normal.scale(1 / length);
}
