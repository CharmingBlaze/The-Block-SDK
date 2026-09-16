import type { FaceId } from "@modeling-kit/core";
import { planarTurnSign, Vector3 } from "@modeling-kit/math";
import { cloneMesh, restoreMesh, serializeMesh } from "../serialize";
import type { HalfEdgeMesh } from "../half-edge-mesh";
import { faceNormal } from "../internal/delete-face";
import { TopologyMappingBuilder } from "../internal/topology-mapping-builder";
import { dissolveEdge } from "./dissolve-edge";
import type { MeshOperationContext, MeshOperationResult } from "./contract";

export interface TrianglesToQuadsRequest {
  readonly faceIds?: readonly FaceId[];
  readonly angleEpsilon?: number;
}

export interface TrianglesToQuadsResult extends MeshOperationResult {
  readonly quadFaceIds: readonly FaceId[];
}

function isConvexQuad(mesh: HalfEdgeMesh, faceId: FaceId): boolean {
  const loop = mesh.getFaceVertices(faceId);
  if (loop.length !== 4) {
    return false;
  }
  const pts = loop.map((id) => {
    const p = mesh.vertices.get(id)!.position;
    return new Vector3(p[0], p[1], p[2]);
  });
  const n = faceNormal(mesh, faceId);
  let sign = 0;
  for (let i = 0; i < 4; i += 1) {
    const a = pts[i]!;
    const b = pts[(i + 1) % 4]!;
    const c = pts[(i + 2) % 4]!;
    const s = planarTurnSign(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z, n.x, n.y, n.z);
    if (s === 0) {
      continue;
    }
    if (sign === 0) {
      sign = s;
    } else if (s !== sign) {
      return false;
    }
  }
  return true;
}

export function trianglesToQuads(
  mesh: HalfEdgeMesh,
  request: TrianglesToQuadsRequest,
  ctx: MeshOperationContext,
): TrianglesToQuadsResult {
  const start = cloneMesh(mesh);
  const allow = request.faceIds ? new Set(request.faceIds) : null;
  const angleEpsilon = request.angleEpsilon ?? ctx.tolerance.angleEpsilon;
  const usedFaces = new Set<FaceId>();
  const quadFaceIds: FaceId[] = [];

  const candidates = [...mesh.edges.keys()].filter((edgeId) => {
    const [f1, f2] = mesh.getEdgeFaces(edgeId);
    if (!f1 || !f2) {
      return false;
    }
    if (allow && (!allow.has(f1) || !allow.has(f2))) {
      return false;
    }
    if (mesh.getFaceVertices(f1).length !== 3 || mesh.getFaceVertices(f2).length !== 3) {
      return false;
    }
    const n1 = faceNormal(mesh, f1).normalize();
    const n2 = faceNormal(mesh, f2).normalize();
    return n1.dot(n2) >= 1 - Math.max(angleEpsilon * 20, 1e-3);
  });

  for (const edgeId of candidates) {
    if (!mesh.edges.has(edgeId)) {
      continue;
    }
    const [f1, f2] = mesh.getEdgeFaces(edgeId);
    if (!f1 || !f2 || usedFaces.has(f1) || usedFaces.has(f2)) {
      continue;
    }
    const before = serializeMesh(mesh);
    try {
      const result = dissolveEdge(mesh, { edgeId }, ctx);
      if (!isConvexQuad(mesh, result.faceId)) {
        restoreMesh(mesh, before);
        continue;
      }
      usedFaces.add(f1);
      usedFaces.add(f2);
      quadFaceIds.push(result.faceId);
    } catch {
      restoreMesh(mesh, before);
    }
  }

  const mapping = new TopologyMappingBuilder(start);
  mapping.snapshotNewElements(start, mesh);
  const built = mapping.build(mesh);
  return {
    mesh,
    ...built,
    selection: { domain: "face", elementIds: [...quadFaceIds] },
    warnings: [],
    quadFaceIds,
  };
}
