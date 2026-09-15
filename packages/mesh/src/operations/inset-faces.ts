import type { FaceId, IdFactory, VertexId } from "@modeling-kit/core";
import { Vector3 } from "@modeling-kit/math";
import { MeshBuilder } from "../builder";
import type { HalfEdgeMesh } from "../half-edge-mesh";
import { collectBoundaryEdges, connectedFaceIslands } from "../internal/boundary-cycles";
import { deleteFace, faceNormal } from "../internal/delete-face";
import { TopologyMappingBuilder } from "../internal/topology-mapping-builder";
import {
  createMeshOperationContext,
  type MeshOperationContext,
  type MeshOperationResult,
  type MeshOperationWarning,
} from "./contract";
import { runTransactionalMeshOp } from "./contract";

export interface InsetFacesRequest {
  readonly faceIds: readonly FaceId[];
  readonly distance: number;
  readonly mode?: "individual" | "region"; // default "individual"
}

export interface InsetFacesOpResult extends MeshOperationResult {
  readonly innerFaceIds: FaceId[];
  readonly ringFaceIds: FaceId[];
  readonly vertexMap: ReadonlyMap<VertexId, VertexId>;
}

export interface InsetFacesResult {
  readonly innerFaceIds: FaceId[];
  readonly ringFaceIds: FaceId[];
  readonly vertexMap: ReadonlyMap<VertexId, VertexId>;
}

export function insetFaces(
  mesh: HalfEdgeMesh,
  request: InsetFacesRequest,
  ctx: MeshOperationContext,
): InsetFacesOpResult;
export function insetFaces(
  mesh: HalfEdgeMesh,
  faceIds: readonly FaceId[],
  distance: number,
  ids: IdFactory,
): InsetFacesResult;
export function insetFaces(
  mesh: HalfEdgeMesh,
  requestOrIds: InsetFacesRequest | readonly FaceId[],
  ctxOrDistance: MeshOperationContext | number,
  ids?: IdFactory,
): InsetFacesOpResult | InsetFacesResult {
  if (typeof ctxOrDistance === "number") {
    if (!ids) {
      throw new RangeError("insetFaces requires an IdFactory");
    }
    const result = insetFacesOp(
      mesh,
      { faceIds: requestOrIds as readonly FaceId[], distance: ctxOrDistance, mode: "individual" },
      createMeshOperationContext(ids),
    );
    return {
      innerFaceIds: result.innerFaceIds,
      ringFaceIds: result.ringFaceIds,
      vertexMap: result.vertexMap,
    };
  }
  return insetFacesOp(mesh, requestOrIds as InsetFacesRequest, ctxOrDistance);
}

function insetFacesOp(
  mesh: HalfEdgeMesh,
  request: InsetFacesRequest,
  ctx: MeshOperationContext,
): InsetFacesOpResult {
  return runTransactionalMeshOp(mesh, () => {
  const faceIds = [...new Set(request.faceIds)];
  if (faceIds.length === 0) {
    throw new RangeError("insetFaces requires at least one face");
  }
  if (request.distance <= 0) {
    throw new RangeError("inset distance must be positive");
  }
  for (const faceId of faceIds) {
    if (!mesh.faces.has(faceId)) {
      throw new RangeError(`Face ${faceId} does not exist`);
    }
  }
  const mode = request.mode ?? "individual";
  return mode === "region"
    ? insetRegion(mesh, faceIds, request.distance, ctx)
    : insetIndividual(mesh, faceIds, request.distance, ctx);
  });
}

function insetIndividual(
  mesh: HalfEdgeMesh,
  faceIds: readonly FaceId[],
  distance: number,
  ctx: MeshOperationContext,
): InsetFacesOpResult {
  const mapping = new TopologyMappingBuilder(mesh);
  const innerFaceIds: FaceId[] = [];
  const ringFaceIds: FaceId[] = [];
  const vertexMap = new Map<VertexId, VertexId>();
  const warnings: MeshOperationWarning[] = [];

  for (const faceId of faceIds) {
    const face = mesh.faces.get(faceId);
    if (!face) {
      continue;
    }
    const loop = mesh.getFaceVertices(faceId);
    if (loop.length < 3) {
      warnings.push({
        code: "degenerate-face",
        message: `Face ${faceId} skipped because it has fewer than 3 vertices`,
        elementIds: [faceId],
      });
      continue;
    }
    const innerPositions = insetLoopPositions(mesh, faceId, loop, distance, ctx, warnings);
    let builder = MeshBuilder.fromMesh(mesh);
    const innerLoop: VertexId[] = [];
    for (let i = 0; i < loop.length; i++) {
      const orig = loop[i]!;
      const pt = innerPositions[i]!;
      const newVId = ctx.idFactory.vertex();
      builder.addVertex(pt.x, pt.y, pt.z, newVId);
      mapping.createVertex(newVId, [orig]);
      vertexMap.set(orig, newVId);
      innerLoop.push(newVId);
    }
    deleteFace(mesh, faceId);
    builder = MeshBuilder.fromMesh(mesh);
    const innerId = builder.addFace(innerLoop, {
      id: faceId,
      materialSlot: face.materialSlot,
      isSmooth: face.isSmooth,
    });
    innerFaceIds.push(innerId);
    mapping.replaceFace(faceId, [innerId]);
    for (let i = 0; i < loop.length; i++) {
      const origA = loop[i]!;
      const origB = loop[(i + 1) % loop.length]!;
      const ringId = builder.addFace([origA, origB, innerLoop[(i + 1) % loop.length]!, innerLoop[i]!], {
        id: ctx.idFactory.face(),
        materialSlot: face.materialSlot,
        isSmooth: face.isSmooth,
      });
      mapping.createFace(ringId, [faceId]);
      ringFaceIds.push(ringId);
    }
  }

  const { mapping: topology, changes } = mapping.build(mesh);
  return {
    mesh,
    changes,
    mapping: topology,
    selection: { domain: "face", elementIds: innerFaceIds },
    warnings,
    innerFaceIds,
    ringFaceIds,
    vertexMap,
  };
}

function insetRegion(
  mesh: HalfEdgeMesh,
  faceIds: readonly FaceId[],
  distance: number,
  ctx: MeshOperationContext,
): InsetFacesOpResult {
  const mapping = new TopologyMappingBuilder(mesh);
  const innerFaceIds: FaceId[] = [];
  const ringFaceIds: FaceId[] = [];
  const vertexMap = new Map<VertexId, VertexId>();
  const warnings: MeshOperationWarning[] = [];

  for (const island of connectedFaceIslands(mesh, faceIds)) {
    const selected = new Set(island);
    const sums = new Map<VertexId, { x: number; y: number; z: number; n: number }>();
    for (const faceId of island) {
      const loop = mesh.getFaceVertices(faceId);
      if (loop.length < 3) {
        continue;
      }
      const positions = insetLoopPositions(mesh, faceId, loop, distance, ctx, warnings);
      for (let i = 0; i < loop.length; i++) {
        const id = loop[i]!;
        const pt = positions[i]!;
        const acc = sums.get(id) ?? { x: 0, y: 0, z: 0, n: 0 };
        acc.x += pt.x;
        acc.y += pt.y;
        acc.z += pt.z;
        acc.n += 1;
        sums.set(id, acc);
      }
    }

    let builder = MeshBuilder.fromMesh(mesh);
    for (const [vertexId, acc] of sums) {
      if (vertexMap.has(vertexId)) {
        continue;
      }
      const newVId = ctx.idFactory.vertex();
      builder.addVertex(acc.x / acc.n, acc.y / acc.n, acc.z / acc.n, newVId);
      mapping.createVertex(newVId, [vertexId]);
      vertexMap.set(vertexId, newVId);
    }

    const boundary = collectBoundaryEdges(mesh, selected);
    const plans = island.map((faceId) => {
      const face = mesh.faces.get(faceId)!;
      return {
        faceId,
        loop: mesh.getFaceVertices(faceId).map((id) => vertexMap.get(id)!),
        materialSlot: face.materialSlot,
        isSmooth: face.isSmooth,
      };
    });
    for (const faceId of island) {
      deleteFace(mesh, faceId);
    }
    builder = MeshBuilder.fromMesh(mesh);
    for (const plan of plans) {
      const innerId = builder.addFace(plan.loop, {
        id: plan.faceId,
        materialSlot: plan.materialSlot,
        isSmooth: plan.isSmooth,
      });
      innerFaceIds.push(innerId);
      mapping.replaceFace(plan.faceId, [innerId]);
    }
    const ringSlot = plans[0]?.materialSlot ?? 0;
    const ringSmooth = plans[0]?.isSmooth ?? false;
    for (const edge of boundary) {
      const na = vertexMap.get(edge.a);
      const nb = vertexMap.get(edge.b);
      if (!na || !nb) {
        continue;
      }
      const ringId = builder.addFace([edge.a, edge.b, nb, na], {
        id: ctx.idFactory.face(),
        materialSlot: ringSlot,
        isSmooth: ringSmooth,
      });
      mapping.createFace(ringId);
      ringFaceIds.push(ringId);
    }
  }

  const { mapping: topology, changes } = mapping.build(mesh);
  return {
    mesh,
    changes,
    mapping: topology,
    selection: { domain: "face", elementIds: innerFaceIds },
    warnings,
    innerFaceIds,
    ringFaceIds,
    vertexMap,
  };
}

function insetLoopPositions(
  mesh: HalfEdgeMesh,
  faceId: FaceId,
  loop: readonly VertexId[],
  distance: number,
  ctx: MeshOperationContext,
  warnings: MeshOperationWarning[],
): Vector3[] {
  const n = loop.length;
  const normal = faceNormal(mesh, faceId);
  const originalPoints: Vector3[] = [];
  for (const vId of loop) {
    const v = mesh.vertices.get(vId)!;
    originalPoints.push(new Vector3(v.position[0], v.position[1], v.position[2]));
  }

  let concave = false;
  let fold = 0;
  for (let i = 0; i < n; i++) {
    const prevPt = originalPoints[(i - 1 + n) % n]!;
    const currPt = originalPoints[i]!;
    const nextPt = originalPoints[(i + 1) % n]!;
    const cross = nextPt.clone().sub(currPt).cross(currPt.clone().sub(prevPt));
    const s = Math.sign(cross.dot(normal));
    if (s === 0) {
      continue;
    }
    if (fold === 0) {
      fold = s;
    } else if (s !== fold) {
      concave = true;
    }
  }
  if (concave) {
    warnings.push({
      code: "inset-centroid-offset",
      message: `Face ${faceId} is concave; inset uses bisector/centroid offset, not a robust even offset`,
      elementIds: [faceId],
    });
  }

  let centroid = new Vector3(0, 0, 0);
  for (const pt of originalPoints) {
    centroid = centroid.add(pt);
  }
  centroid = centroid.scale(1 / n);
  const newPoints = evenOffsetLoop(originalPoints, normal, centroid, distance);
  if (insetInverts(originalPoints, newPoints, normal) || insetSelfIntersects(newPoints, normal)) {
    const message = `Inset distance inverts face ${faceId}`;
    if (ctx.validation === "strict") {
      throw new RangeError(message);
    }
    warnings.push({
      code: "inset-self-intersection",
      message,
      elementIds: [faceId],
    });
  }
  return newPoints;
}

function evenOffsetLoop(
  points: readonly Vector3[],
  normal: Vector3,
  centroid: Vector3,
  distance: number,
): Vector3[] {
  const n = points.length;
  const lines: Array<{ origin: Vector3; dir: Vector3 }> = [];
  for (let i = 0; i < n; i++) {
    const curr = points[i]!;
    const next = points[(i + 1) % n]!;
    const edge = next.sub(curr);
    const len = edge.length();
    if (len < 1e-12) {
      throw new RangeError("insetFaces cannot offset a degenerate edge");
    }
    const dir = edge.scale(1 / len);
    let inward = normal.cross(dir);
    if (inward.length() < 1e-12) {
      throw new RangeError("insetFaces cannot offset an edge parallel to the face normal");
    }
    inward = inward.normalize();
    if (inward.dot(centroid.sub(curr)) < 0) {
      inward = inward.negate();
    }
    lines.push({ origin: curr.add(inward.scale(distance)), dir });
  }
  const out: Vector3[] = [];
  for (let i = 0; i < n; i++) {
    const prev = lines[(i - 1 + n) % n]!;
    const curr = lines[i]!;
    const hit = intersectPlanarLines(prev.origin, prev.dir, curr.origin, curr.dir, normal);
    if (!hit) {
      throw new RangeError("insetFaces even offset produced a parallel miter");
    }
    out.push(hit);
  }
  return out;
}

function intersectPlanarLines(
  p1: Vector3,
  d1: Vector3,
  p2: Vector3,
  d2: Vector3,
  normal: Vector3,
): Vector3 | null {
  const denom = d1.cross(d2).dot(normal);
  if (Math.abs(denom) < 1e-12) {
    return null;
  }
  const s = p2.sub(p1).cross(d2).dot(normal) / denom;
  return p1.add(d1.scale(s));
}

function insetSelfIntersects(points: readonly Vector3[], normal: Vector3): boolean {
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const a1 = points[i]!;
    const a2 = points[(i + 1) % n]!;
    for (let j = i + 1; j < n; j++) {
      if (Math.abs(i - j) <= 1 || (i === 0 && j === n - 1)) {
        continue;
      }
      const b1 = points[j]!;
      const b2 = points[(j + 1) % n]!;
      if (segmentsCross(a1, a2, b1, b2, normal)) {
        return true;
      }
    }
  }
  return false;
}

function segmentsCross(a1: Vector3, a2: Vector3, b1: Vector3, b2: Vector3, normal: Vector3): boolean {
  const da = a2.sub(a1);
  const db = b2.sub(b1);
  const denom = da.cross(db).dot(normal);
  if (Math.abs(denom) < 1e-12) {
    return false;
  }
  const s = b1.sub(a1).cross(db).dot(normal) / denom;
  const t = b1.sub(a1).cross(da).dot(normal) / denom;
  return s > 1e-6 && s < 1 - 1e-6 && t > 1e-6 && t < 1 - 1e-6;
}

function insetInverts(original: readonly Vector3[], inset: readonly Vector3[], normal: Vector3): boolean {
  const orig = signedArea(original, normal);
  const next = signedArea(inset, normal);
  if (Math.abs(orig) < 1e-12) {
    return false;
  }
  return next * orig <= 0 || Math.abs(next) > Math.abs(orig) * 1.05;
}

function signedArea(points: readonly Vector3[], normal: Vector3): number {
  let area = 0;
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const a = points[i]!;
    const b = points[(i + 1) % n]!;
    area += a.cross(b).dot(normal);
  }
  return area * 0.5;
}
