import type { HalfEdgeMesh } from "@modeling-kit/mesh";
import { Vector3, type Vec3 } from "@modeling-kit/math";
import {
  closestOnSegment,
  snapToGrid,
  type SnapResult,
  type SnapTargetType,
} from "./snap";

export interface SnapQueryOptions {
  readonly snapRadius?: number;
  /** Alias of `snapRadius` for knife/query callers. */
  readonly radius?: number;
  readonly gridSize?: number;
  readonly targets?: readonly SnapTargetType[];
  readonly priorities?: Partial<Record<SnapTargetType, number>>;
  readonly snapToVertices?: boolean;
  readonly snapToEdges?: boolean;
  readonly snapToMidpoints?: boolean;
  readonly snapToFaces?: boolean;
  readonly snapToGrid?: boolean;
  readonly excludeTargetIds?: ReadonlySet<string> | readonly string[];
  readonly previousTargetId?: string;
  readonly hysteresis?: number;
}

export const defaultSnapPriorities: Record<SnapTargetType, number> = {
  vertex: 100,
  midpoint: 80,
  edge: 60,
  face: 40,
  grid: 20,
  surface: 30,
  bbox: 10,
  increment: 10,
  angle: 10,
  "uv-pixel": 10,
  timeline: 10,
};

export function computeMeshSnapRadius(mesh: HalfEdgeMesh, fraction = 0.04): number {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;
  for (const vertex of mesh.vertices.values()) {
    const [x, y, z] = vertex.position;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (z < minZ) minZ = z;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
    if (z > maxZ) maxZ = z;
  }
  if (!Number.isFinite(minX)) {
    return 0.15;
  }
  const diagonal = Math.hypot(maxX - minX, maxY - minY, maxZ - minZ);
  return Math.max(diagonal * fraction, 1e-4);
}

interface SnapCandidate {
  readonly targetType: SnapTargetType;
  readonly targetId?: string;
  readonly worldPosition: Vector3;
  readonly distance: number;
  readonly priority: number;
}

export function querySnap(
  mesh: HalfEdgeMesh | undefined,
  point: Vec3 | readonly [number, number, number],
  options?: SnapQueryOptions,
): SnapResult {
  const requestedRadius = options?.snapRadius ?? options?.radius;
  if (requestedRadius !== undefined && requestedRadius <= 0) {
    return { matched: false };
  }

  const radius =
    requestedRadius ?? (mesh && mesh.vertices.size > 0 ? computeMeshSnapRadius(mesh) : 0);

  if (radius <= 0 && (!options?.gridSize || options.gridSize <= 0)) {
    return { matched: false };
  }

  const p =
    typeof point === "object" && point !== null && "x" in point
      ? Vector3.from(point)
      : new Vector3(point[0], point[1], point[2]);

  const targets = options?.targets;
  const isEnabled = (type: SnapTargetType): boolean => {
    if (targets) {
      return targets.includes(type);
    }
    switch (type) {
      case "vertex":
        return options?.snapToVertices !== false;
      case "edge":
        return options?.snapToEdges !== false;
      case "midpoint":
        return options?.snapToMidpoints !== false;
      case "face":
        return options?.snapToFaces !== false;
      case "grid":
        return (
          options?.snapToGrid === true ||
          (options?.gridSize !== undefined && options.gridSize > 0)
        );
      default:
        return true;
    }
  };

  const priorities: Record<SnapTargetType, number> = {
    ...defaultSnapPriorities,
    ...(options?.priorities ?? {}),
  };

  const candidates: SnapCandidate[] = [];

  if (mesh && mesh.vertices.size > 0 && radius > 0) {
    // 1. Vertices
    if (isEnabled("vertex")) {
      for (const [vId, vertex] of mesh.vertices) {
        const vPos = new Vector3(vertex.position[0], vertex.position[1], vertex.position[2]);
        const dist = p.distanceTo(vPos);
        if (dist <= radius) {
          candidates.push({
            targetType: "vertex",
            targetId: vId,
            worldPosition: vPos,
            distance: dist,
            priority: priorities.vertex,
          });
        }
      }
    }

    // 2. Midpoints & Edges
    if (isEnabled("midpoint") || isEnabled("edge")) {
      for (const [eId] of mesh.edges) {
        const ends = mesh.getEdgeVertices(eId);
        if (!ends) continue;
        const vA = mesh.vertices.get(ends[0]);
        const vB = mesh.vertices.get(ends[1]);
        if (!vA || !vB) continue;
        const a = new Vector3(vA.position[0], vA.position[1], vA.position[2]);
        const b = new Vector3(vB.position[0], vB.position[1], vB.position[2]);

        if (isEnabled("midpoint")) {
          const mid = a.add(b).scale(0.5);
          const midDist = p.distanceTo(mid);
          if (midDist <= radius) {
            candidates.push({
              targetType: "midpoint",
              targetId: eId,
              worldPosition: mid,
              distance: midDist,
              priority: priorities.midpoint,
            });
          }
        }

        if (isEnabled("edge")) {
          const seg = closestOnSegment(p, a, b);
          if (seg.dist <= radius) {
            candidates.push({
              targetType: "edge",
              targetId: eId,
              worldPosition: seg.point,
              distance: seg.dist,
              priority: priorities.edge,
            });
          }
        }
      }
    }

    // 3. Faces (Centroid)
    if (isEnabled("face")) {
      for (const [fId] of mesh.faces) {
        const vIds = mesh.getFaceVertices(fId);
        if (vIds.length < 3) continue;
        let sumX = 0;
        let sumY = 0;
        let sumZ = 0;
        let count = 0;
        for (const vId of vIds) {
          const v = mesh.vertices.get(vId);
          if (v) {
            sumX += v.position[0];
            sumY += v.position[1];
            sumZ += v.position[2];
            count += 1;
          }
        }
        if (count >= 3) {
          const centroid = new Vector3(sumX / count, sumY / count, sumZ / count);
          const centroidDist = p.distanceTo(centroid);
          if (centroidDist <= radius) {
            candidates.push({
              targetType: "face",
              targetId: fId,
              worldPosition: centroid,
              distance: centroidDist,
              priority: priorities.face,
            });
          }
        }
      }
    }
  }

  // 4. Grid
  if (isEnabled("grid") && options?.gridSize && options.gridSize > 0) {
    const gridPoint = snapToGrid(p, options.gridSize);
    const gridDist = p.distanceTo(gridPoint);
    const maxGridDist = radius > 0 ? radius : options.gridSize;
    if (gridDist <= maxGridDist) {
      candidates.push({
        targetType: "grid",
        worldPosition: gridPoint,
        distance: gridDist,
        priority: priorities.grid,
      });
    }
  }

  if (candidates.length === 0) {
    return { matched: false };
  }

  const exclude = new Set(
    options?.excludeTargetIds instanceof Set
      ? options.excludeTargetIds
      : (options?.excludeTargetIds ?? []),
  );
  const filtered = candidates.filter((candidate) => !candidate.targetId || !exclude.has(candidate.targetId));
  if (filtered.length === 0) {
    return { matched: false };
  }

  filtered.sort((a, b) => {
    if (b.priority !== a.priority) {
      return b.priority - a.priority;
    }
    return a.distance - b.distance;
  });

  let best = filtered[0]!;
  const hysteresis = options?.hysteresis ?? 0.15;
  if (options?.previousTargetId) {
    const previous = filtered.find((candidate) => candidate.targetId === options.previousTargetId);
    if (previous && previous.targetId !== best.targetId) {
      const keepPrevious =
        best.priority <= previous.priority && best.distance >= previous.distance * (1 - hysteresis);
      if (keepPrevious) {
        best = previous;
      }
    }
  }
  return {
    matched: true,
    targetType: best.targetType,
    ...(best.targetId !== undefined ? { targetId: best.targetId } : {}),
    worldPosition: best.worldPosition,
    distance: best.distance,
    score: radius > 0 ? 1 - best.distance / radius : 1,
  };
}

export class SnapQuery {
  constructor(
    private readonly mesh?: HalfEdgeMesh,
    private readonly defaultOptions?: SnapQueryOptions,
  ) {}

  query(
    point: Vec3 | readonly [number, number, number],
    options?: SnapQueryOptions,
  ): SnapResult {
    return querySnap(this.mesh, point, { ...this.defaultOptions, ...options });
  }
}

export interface QuerySnapTupleOptions extends SnapQueryOptions {
  readonly mesh?: HalfEdgeMesh;
  readonly radius?: number;
}

export function querySnapTuple(
  point: Vec3 | readonly [number, number, number],
  options?: QuerySnapTupleOptions,
): SnapResult {
  const snapRadius = options?.radius ?? options?.snapRadius;
  return querySnap(options?.mesh, point, {
    ...options,
    ...(snapRadius !== undefined ? { snapRadius } : {}),
  });
}