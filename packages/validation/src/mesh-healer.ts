import type { FaceId, IdFactory, VertexId } from "@modeling-kit/core";
import {
  createMeshOperationContext,
  deleteFace,
  mergeVertices,
  MeshBuilder,
  type HalfEdgeMesh,
} from "@modeling-kit/mesh";
import { validateMesh } from "./mesh-validator";
import type { MeshCleanupReport } from "./types";

const COLLAPSE_EPSILON = 1e-6;

export function healMesh(mesh: HalfEdgeMesh, ids: IdFactory): MeshCleanupReport {
  const ctx = createMeshOperationContext(ids);
  let isolatedVerticesRemoved = 0;
  let edgesCollapsed = 0;
  let duplicateFacesRemoved = 0;
  let facesRewound = 0;

  isolatedVerticesRemoved += removeIsolatedVertices(mesh);

  const maxPasses = Math.max(1, mesh.edges.size + 1);
  let passes = 0;
  let collapsed = true;
  while (collapsed && passes < maxPasses) {
    passes += 1;
    collapsed = false;
    for (const [edgeId] of [...mesh.edges]) {
      const ends = mesh.getEdgeVertices(edgeId);
      if (!ends) {
        continue;
      }
      const a = mesh.vertices.get(ends[0])!.position;
      const b = mesh.vertices.get(ends[1])!.position;
      const dx = a[0] - b[0];
      const dy = a[1] - b[1];
      const dz = a[2] - b[2];
      if (Math.hypot(dx, dy, dz) >= COLLAPSE_EPSILON) {
        continue;
      }
      try {
        mergeVertices(mesh, { vertexIds: ends, target: "center" }, ctx);
        edgesCollapsed += 1;
        collapsed = true;
        break;
      } catch {
        continue;
      }
    }
  }

  duplicateFacesRemoved += removeDuplicateFaces(mesh);
  facesRewound += unifyWinding(mesh);
  isolatedVerticesRemoved += removeIsolatedVertices(mesh);

  return {
    isolatedVerticesRemoved,
    edgesCollapsed,
    duplicateFacesRemoved,
    facesRewound,
    remaining: validateMesh(mesh),
  };
}

function removeIsolatedVertices(mesh: HalfEdgeMesh): number {
  const used = new Set<VertexId>();
  for (const [faceId] of mesh.faces) {
    for (const id of mesh.getFaceVertices(faceId)) {
      used.add(id);
    }
  }
  let removed = 0;
  for (const id of [...mesh.vertices.keys()]) {
    if (!used.has(id)) {
      mesh.vertices.delete(id);
      removed += 1;
    }
  }
  return removed;
}

function removeDuplicateFaces(mesh: HalfEdgeMesh): number {
  const seen = new Map<string, FaceId>();
  let removed = 0;
  for (const [faceId] of [...mesh.faces]) {
    const key = [...mesh.getFaceVertices(faceId)].slice().sort().join("|");
    const existing = seen.get(key);
    if (existing && existing !== faceId) {
      deleteFace(mesh, faceId);
      removed += 1;
    } else {
      seen.set(key, faceId);
    }
  }
  return removed;
}

function unifyWinding(mesh: HalfEdgeMesh): number {
  let rewound = 0;
  for (const [edgeId] of mesh.edges) {
    const [f1, f2] = mesh.getEdgeFaces(edgeId);
    if (!f1 || !f2) {
      continue;
    }
    const dir1 = directedEdge(mesh, f1, edgeId);
    const dir2 = directedEdge(mesh, f2, edgeId);
    if (!dir1 || !dir2) {
      continue;
    }
    if (dir1[0] === dir2[0] && dir1[1] === dir2[1]) {
      reverseFace(mesh, f2);
      rewound += 1;
    }
  }
  return rewound;
}

function directedEdge(
  mesh: HalfEdgeMesh,
  faceId: FaceId,
  edgeId: import("@modeling-kit/core").EdgeId,
): readonly [VertexId, VertexId] | null {
  const loop = mesh.getFaceVertices(faceId);
  const edges = mesh.getFaceEdges(faceId);
  const i = edges.indexOf(edgeId);
  if (i < 0) {
    return null;
  }
  return [loop[i]!, loop[(i + 1) % loop.length]!];
}

function reverseFace(mesh: HalfEdgeMesh, faceId: FaceId): void {
  const face = mesh.faces.get(faceId);
  if (!face) {
    return;
  }
  const verts = [...mesh.getFaceVertices(faceId)].reverse();
  const corners = mesh.getFaceCorners(faceId).map((id) => mesh.corners.get(id));
  const uvs = corners.every((c) => c?.uv)
    ? [...corners].reverse().map((c) => [c!.uv![0], c!.uv![1]] as [number, number])
    : undefined;
  deleteFace(mesh, faceId);
  const builder = MeshBuilder.fromMesh(mesh);
  builder.addFace(verts, {
    id: faceId,
    materialSlot: face.materialSlot,
    isSmooth: face.isSmooth,
    ...(uvs ? { uvs } : {}),
  });
}
