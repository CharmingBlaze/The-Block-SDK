import type { EdgeId, FaceId, VertexId } from "@modeling-kit/core";
import { Vector3 } from "@modeling-kit/math";
import { collectQuadEdgeLoop, type HalfEdgeMesh } from "@modeling-kit/mesh";
import type { SelectionSnapshot } from "./types";

function allIds(mesh: HalfEdgeMesh, domain: SelectionSnapshot["domain"]): string[] {
  if (domain === "vertex") {
    return [...mesh.vertices.keys()];
  }
  if (domain === "edge") {
    return [...mesh.edges.keys()];
  }
  if (domain === "face") {
    return [...mesh.faces.keys()];
  }
  return [];
}

function liveSet(mesh: HalfEdgeMesh, domain: SelectionSnapshot["domain"], ids: readonly string[]): string[] {
  const live = new Set(allIds(mesh, domain));
  return ids.filter((id) => live.has(id));
}

export function invertElementIds(mesh: HalfEdgeMesh, snapshot: SelectionSnapshot): string[] {
  const current = new Set(liveSet(mesh, snapshot.domain, snapshot.elementIds));
  return allIds(mesh, snapshot.domain).filter((id) => !current.has(id));
}

export function allElementIds(mesh: HalfEdgeMesh, snapshot: SelectionSnapshot): string[] {
  return allIds(mesh, snapshot.domain);
}

export function growElementIds(mesh: HalfEdgeMesh, snapshot: SelectionSnapshot): string[] {
  const selected = new Set(liveSet(mesh, snapshot.domain, snapshot.elementIds));
  if (snapshot.domain === "face") {
    for (const id of [...selected]) {
      for (const adj of mesh.getAdjacentFaces(id as FaceId)) {
        selected.add(adj);
      }
    }
  } else if (snapshot.domain === "vertex") {
    for (const id of [...selected]) {
      for (const faceId of mesh.getVertexFaces(id as VertexId)) {
        for (const vertexId of mesh.getFaceVertices(faceId)) {
          selected.add(vertexId);
        }
      }
    }
  } else if (snapshot.domain === "edge") {
    for (const id of [...selected]) {
      const ends = mesh.getEdgeVertices(id as EdgeId);
      if (!ends) {
        continue;
      }
      for (const vertexId of ends) {
        for (const edgeId of mesh.getVertexEdges(vertexId)) {
          selected.add(edgeId);
        }
      }
    }
  }
  return [...selected];
}

/**
 * Shrink removes selected elements that neighbor an unselected element of the same domain
 * (the selection boundary). Interior elements remain.
 */
export function shrinkElementIds(mesh: HalfEdgeMesh, snapshot: SelectionSnapshot): string[] {
  const selected = new Set(liveSet(mesh, snapshot.domain, snapshot.elementIds));
  const next = new Set(selected);
  if (snapshot.domain === "face") {
    for (const id of selected) {
      const neighbors = mesh.getAdjacentFaces(id as FaceId);
      if (neighbors.some((adj) => !selected.has(adj))) {
        next.delete(id);
      }
    }
  } else if (snapshot.domain === "vertex") {
    for (const id of selected) {
      const edges = mesh.getVertexEdges(id as VertexId);
      const other = edges.some((edgeId) => {
        const ends = mesh.getEdgeVertices(edgeId);
        return ends?.some((vertexId) => vertexId !== id && !selected.has(vertexId));
      });
      if (other) {
        next.delete(id);
      }
    }
  } else if (snapshot.domain === "edge") {
    for (const id of selected) {
      const ends = mesh.getEdgeVertices(id as EdgeId);
      const touches = ends?.some((vertexId) =>
        mesh.getVertexEdges(vertexId).some((edgeId) => edgeId !== id && !selected.has(edgeId)),
      );
      if (touches) {
        next.delete(id);
      }
    }
  }
  return [...next];
}

export function linkedElementIds(mesh: HalfEdgeMesh, snapshot: SelectionSnapshot): string[] {
  const seeds = liveSet(mesh, snapshot.domain, snapshot.elementIds);
  if (seeds.length === 0) {
    return [];
  }
  const seen = new Set<string>();
  const queue = [...seeds];
  while (queue.length > 0) {
    const id = queue.pop()!;
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);
    if (snapshot.domain === "face") {
      for (const adj of mesh.getAdjacentFaces(id as FaceId)) {
        queue.push(adj);
      }
    } else if (snapshot.domain === "vertex") {
      for (const edgeId of mesh.getVertexEdges(id as VertexId)) {
        const ends = mesh.getEdgeVertices(edgeId);
        if (ends) {
          queue.push(ends[0], ends[1]);
        }
      }
    } else if (snapshot.domain === "edge") {
      const ends = mesh.getEdgeVertices(id as EdgeId);
      if (ends) {
        for (const vertexId of ends) {
          queue.push(...mesh.getVertexEdges(vertexId));
        }
      }
    }
  }
  return [...seen];
}

export function edgeLoopIds(mesh: HalfEdgeMesh, snapshot: SelectionSnapshot): string[] {
  if (snapshot.domain !== "edge") {
    return liveSet(mesh, snapshot.domain, snapshot.elementIds);
  }
  const start = liveSet(mesh, "edge", snapshot.elementIds)[0] as EdgeId | undefined;
  if (!start || !mesh.edges.has(start)) {
    return [];
  }
  return collectQuadEdgeLoop(mesh, start);
}

export function edgeRingIds(mesh: HalfEdgeMesh, snapshot: SelectionSnapshot): string[] {
  if (snapshot.domain !== "edge") {
    return liveSet(mesh, snapshot.domain, snapshot.elementIds);
  }
  const start = liveSet(mesh, "edge", snapshot.elementIds)[0] as EdgeId | undefined;
  if (!start) {
    return [];
  }
  const ring = new Set<string>([start]);
  const [f1, f2] = mesh.getEdgeFaces(start);
  for (const faceId of [f1, f2]) {
    if (!faceId) {
      continue;
    }
    const loop = mesh.getFaceEdges(faceId);
    if (loop.length !== 4) {
      continue;
    }
    const index = loop.indexOf(start);
    if (index < 0) {
      continue;
    }
    ring.add(loop[(index + 2) % loop.length]!);
  }
  return [...ring];
}

export function boundaryElementIds(mesh: HalfEdgeMesh, snapshot: SelectionSnapshot): string[] {
  const boundaryEdges = new Set(mesh.findBoundaryEdges());
  if (snapshot.domain === "edge") {
    return [...boundaryEdges];
  }
  if (snapshot.domain === "vertex") {
    const verts = new Set<string>();
    for (const edgeId of boundaryEdges) {
      const ends = mesh.getEdgeVertices(edgeId);
      if (ends) {
        verts.add(ends[0]);
        verts.add(ends[1]);
      }
    }
    return [...verts];
  }
  if (snapshot.domain === "face") {
    const faces = new Set<string>();
    for (const edgeId of boundaryEdges) {
      const [f1, f2] = mesh.getEdgeFaces(edgeId);
      if (f1) {
        faces.add(f1);
      }
      if (f2) {
        faces.add(f2);
      }
    }
    return [...faces];
  }
  return liveSet(mesh, snapshot.domain, snapshot.elementIds);
}

function pointInPolygon(x: number, y: number, polygon: readonly (readonly [number, number])[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const xi = polygon[i]![0];
    const yi = polygon[i]![1];
    const xj = polygon[j]![0];
    const yj = polygon[j]![1];
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + Number.EPSILON) + xi;
    if (intersect) {
      inside = !inside;
    }
  }
  return inside;
}

export interface ScreenSelectOptions {
  readonly project: (x: number, y: number, z: number) => readonly [number, number];
  readonly viewDirection?: readonly [number, number, number];
  readonly frontFacingOnly?: boolean;
  readonly xray?: boolean;
}

function elementScreenPoints(
  mesh: HalfEdgeMesh,
  domain: SelectionSnapshot["domain"],
  id: string,
): { x: number; y: number; z: number }[] {
  if (domain === "vertex") {
    const p = mesh.vertices.get(id as VertexId)?.position;
    return p ? [{ x: p[0], y: p[1], z: p[2] }] : [];
  }
  if (domain === "edge") {
    const ends = mesh.getEdgeVertices(id as EdgeId);
    if (!ends) {
      return [];
    }
    return ends.map((vertexId) => {
      const p = mesh.vertices.get(vertexId)!.position;
      return { x: p[0], y: p[1], z: p[2] };
    });
  }
  if (domain === "face") {
    return mesh.getFaceVertices(id as FaceId).map((vertexId) => {
      const p = mesh.vertices.get(vertexId)!.position;
      return { x: p[0], y: p[1], z: p[2] };
    });
  }
  return [];
}

function isFrontFacing(mesh: HalfEdgeMesh, domain: SelectionSnapshot["domain"], id: string, view: readonly [number, number, number]): boolean {
  if (domain === "face") {
    const n = faceNormal(mesh, id as FaceId);
    return n.x * view[0] + n.y * view[1] + n.z * view[2] < 0;
  }
  return true;
}

export function boxSelectIds(
  mesh: HalfEdgeMesh,
  snapshot: SelectionSnapshot,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
  options: ScreenSelectOptions,
): string[] {
  const hits: string[] = [];
  for (const id of allIds(mesh, snapshot.domain)) {
    if (options.frontFacingOnly && options.viewDirection && !isFrontFacing(mesh, snapshot.domain, id, options.viewDirection)) {
      continue;
    }
    const pts = elementScreenPoints(mesh, snapshot.domain, id);
    const inside = pts.some((p) => {
      const [sx, sy] = options.project(p.x, p.y, p.z);
      return sx >= minX && sx <= maxX && sy >= minY && sy <= maxY;
    });
    if (inside) {
      hits.push(id);
      if (options.xray === false && hits.length > 0 && snapshot.domain === "face") {
        break;
      }
    }
  }
  return hits;
}

export function lassoSelectIds(
  mesh: HalfEdgeMesh,
  snapshot: SelectionSnapshot,
  polygon: readonly (readonly [number, number])[],
  options: ScreenSelectOptions,
): string[] {
  const hits: string[] = [];
  for (const id of allIds(mesh, snapshot.domain)) {
    if (options.frontFacingOnly && options.viewDirection && !isFrontFacing(mesh, snapshot.domain, id, options.viewDirection)) {
      continue;
    }
    const pts = elementScreenPoints(mesh, snapshot.domain, id);
    const inside = pts.some((p) => {
      const [sx, sy] = options.project(p.x, p.y, p.z);
      return pointInPolygon(sx, sy, polygon);
    });
    if (inside) {
      hits.push(id);
    }
  }
  return hits;
}

function faceNormal(mesh: HalfEdgeMesh, faceId: FaceId): Vector3 {
  const vertexIds = mesh.getFaceVertices(faceId);
  const points = vertexIds.map((id) => {
    const v = mesh.vertices.get(id);
    if (!v) {
      throw new RangeError(`Missing vertex ${id}`);
    }
    return new Vector3(v.position[0], v.position[1], v.position[2]);
  });
  if (points.length < 3) {
    return new Vector3(0, 1, 0);
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

export function coplanarFaceIds(
  mesh: HalfEdgeMesh,
  snapshot: SelectionSnapshot,
  angleEpsilon = 1e-3,
): string[] {
  if (snapshot.domain !== "face") {
    return liveSet(mesh, snapshot.domain, snapshot.elementIds);
  }
  const seedIds = liveSet(mesh, "face", snapshot.elementIds);
  const selected = new Set(seedIds);
  const queue = [...seedIds];
  while (queue.length > 0) {
    const id = queue.pop() as FaceId;
    const seedN = faceNormal(mesh, id).normalize();
    const seedP = mesh.vertices.get(mesh.getFaceVertices(id)[0]!)!.position;
    for (const adj of mesh.getAdjacentFaces(id)) {
      if (selected.has(adj)) {
        continue;
      }
      const n = faceNormal(mesh, adj).normalize();
      if (seedN.dot(n) < 1 - angleEpsilon * 20) {
        continue;
      }
      const q = mesh.vertices.get(mesh.getFaceVertices(adj)[0]!)!.position;
      const dx = q[0] - seedP[0];
      const dy = q[1] - seedP[1];
      const dz = q[2] - seedP[2];
      if (Math.abs(seedN.x * dx + seedN.y * dy + seedN.z * dz) > 1e-4) {
        continue;
      }
      selected.add(adj);
      queue.push(adj);
    }
  }
  return [...selected];
}

export function similarMaterialFaceIds(mesh: HalfEdgeMesh, snapshot: SelectionSnapshot): string[] {
  if (snapshot.domain !== "face") {
    return liveSet(mesh, snapshot.domain, snapshot.elementIds);
  }
  const seeds = liveSet(mesh, "face", snapshot.elementIds);
  if (seeds.length === 0) {
    return [];
  }
  const slots = new Set(seeds.map((id) => mesh.faces.get(id as FaceId)?.materialSlot ?? 0));
  return [...mesh.faces.keys()].filter((id) => slots.has(mesh.faces.get(id)?.materialSlot ?? 0));
}

