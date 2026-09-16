import type { EdgeId, FaceId, MeshId, ObjectId, VertexId } from "@modeling-kit/core";
import type { HalfEdgeMesh } from "@modeling-kit/mesh";
import type { PointPickSource } from "@modeling-kit/selection";
import { Vector2, Vector3, type Camera, type Intersection } from "three";
import type { RenderMapping } from "./geometry";

export type PickDomain = "object" | "face" | "edge" | "vertex";

export interface PickingOptions {
  readonly domain: PickDomain;
  readonly pixelHitRadius: number;
  readonly frontFacingOnly: boolean;
}

export interface PickResult {
  readonly domain: PickDomain;
  readonly objectId: ObjectId;
  readonly elementId: string;
  readonly faceId?: FaceId;
  readonly vertexId?: VertexId;
  readonly edgeId?: EdgeId;
  readonly meshId?: MeshId;
  readonly triangleIndex?: number;
  readonly point: { x: number; y: number; z: number };
  readonly distance: number;
  readonly source?: PointPickSource;
}

export function resolveFaceId(
  intersection: Intersection,
  mapping: RenderMapping,
): FaceId | undefined {
  if (intersection.faceIndex === undefined || intersection.faceIndex === null) {
    return undefined;
  }
  return mapping.triangleToFace[intersection.faceIndex];
}

export function pickVertexOnFace(
  mesh: HalfEdgeMesh,
  faceId: FaceId,
  worldPoint: Vector3,
  localToWorld: (local: Vector3) => Vector3,
  camera: Camera,
  ndc: Vector2,
  viewport: { width: number; height: number },
  pixelHitRadius: number,
): VertexId | undefined {
  const ids = mesh.getFaceVertices(faceId);
  let best: { id: VertexId; pixels: number } | undefined;
  for (const id of ids) {
    const v = mesh.vertices.get(id);
    if (!v) continue;
    const world = localToWorld(new Vector3(v.position[0], v.position[1], v.position[2]));
    const pixels = screenDistance(world, camera, ndc, viewport);
    if (!best || pixels < best.pixels) {
      best = { id, pixels };
    }
  }
  if (best && best.pixels <= pixelHitRadius) {
    return best.id;
  }
  const nearest = nearestVertex(mesh, faceId, worldPoint, localToWorld);
  return nearest;
}

export function pickEdgeOnFace(
  mesh: HalfEdgeMesh,
  faceId: FaceId,
  worldPoint: Vector3,
  localToWorld: (local: Vector3) => Vector3,
  camera: Camera,
  ndc: Vector2,
  viewport: { width: number; height: number },
  pixelHitRadius: number,
): EdgeId | undefined {
  const edges = mesh.getFaceEdges(faceId);
  let best: { id: EdgeId; pixels: number } | undefined;
  for (const edgeId of edges) {
    const edge = mesh.edges.get(edgeId);
    if (!edge) continue;
    const he = mesh.halfEdges.get(edge.halfEdge);
    if (!he) continue;
    const twinOrigin = mesh.halfEdges.get(he.next)?.origin;
    const a = mesh.vertices.get(he.origin);
    const b = twinOrigin ? mesh.vertices.get(twinOrigin) : undefined;
    if (!a || !b) continue;
    const wa = localToWorld(new Vector3(a.position[0], a.position[1], a.position[2]));
    const wb = localToWorld(new Vector3(b.position[0], b.position[1], b.position[2]));
    const closest = closestPointOnSegment(worldPoint, wa, wb);
    const pixels = screenDistance(closest, camera, ndc, viewport);
    if (!best || pixels < best.pixels) {
      best = { id: edgeId, pixels };
    }
  }
  if (best && best.pixels <= pixelHitRadius) {
    return best.id;
  }
  return best?.id;
}

function nearestVertex(
  mesh: HalfEdgeMesh,
  faceId: FaceId,
  worldPoint: Vector3,
  localToWorld: (local: Vector3) => Vector3,
): VertexId | undefined {
  let best: { id: VertexId; d: number } | undefined;
  for (const id of mesh.getFaceVertices(faceId)) {
    const v = mesh.vertices.get(id);
    if (!v) continue;
    const world = localToWorld(new Vector3(v.position[0], v.position[1], v.position[2]));
    const d = world.distanceTo(worldPoint);
    if (!best || d < best.d) {
      best = { id, d };
    }
  }
  return best?.id;
}

function closestPointOnSegment(p: Vector3, a: Vector3, b: Vector3): Vector3 {
  const ab = new Vector3().subVectors(b, a);
  const t = Math.max(0, Math.min(1, p.clone().sub(a).dot(ab) / ab.lengthSq()));
  return a.clone().add(ab.multiplyScalar(t));
}

function screenDistance(
  world: Vector3,
  camera: Camera,
  ndc: Vector2,
  viewport: { width: number; height: number },
): number {
  const projected = world.clone().project(camera);
  const dx = ((projected.x - ndc.x) * viewport.width) / 2;
  const dy = ((projected.y - ndc.y) * viewport.height) / 2;
  return Math.hypot(dx, dy);
}
