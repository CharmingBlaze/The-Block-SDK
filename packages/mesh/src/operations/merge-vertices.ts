import type { FaceId, VertexId } from "@modeling-kit/core";
import { MeshBuilder } from "../builder";
import type { HalfEdgeMesh } from "../half-edge-mesh";
import { TopologyMappingBuilder } from "../internal/topology-mapping-builder";
import type { MeshOperationContext, MeshOperationResult, MeshOperationWarning } from "./contract";
import { runTransactionalMeshOp } from "./contract";

export type MergeVertexTarget = "center" | "active" | "first" | "last" | "cursor" | "custom";

export interface MergeVerticesRequest {
  readonly vertexIds: readonly VertexId[];
  readonly target: MergeVertexTarget;
  readonly activeId?: VertexId;
  readonly cursor?: readonly [number, number, number];
  readonly custom?: readonly [number, number, number];
}

export interface MergeVerticesResult extends MeshOperationResult {
  readonly survivorId: VertexId | null;
  readonly mergedCount: number;
}

export function mergeVertices(
  mesh: HalfEdgeMesh,
  request: MergeVerticesRequest,
  ctx: MeshOperationContext,
): MergeVerticesResult {
  return runTransactionalMeshOp(mesh, () => {
    const unique = uniqueVertices(request.vertexIds);
    if (unique.length < 2) {
      throw new RangeError("mergeVertices requires at least two vertices");
    }
    for (const id of unique) {
      if (!mesh.vertices.has(id)) {
        throw new RangeError(`Vertex ${id} does not exist`);
      }
    }

    const mapping = new TopologyMappingBuilder(mesh);
    const survivorId = pickSurvivor(request, unique);
    const position = resolvePosition(mesh, request, unique, survivorId, ctx);
    const remap = new Map<VertexId, VertexId>();
    for (const id of unique) {
      if (id !== survivorId) {
        remap.set(id, survivorId);
        mapping.replaceVertex(id, [survivorId]);
      }
    }
    mesh.vertices.get(survivorId)!.position = [position[0], position[1], position[2]];
    return applyVertexRemap(mesh, mapping, remap, survivorId);
  });
}

export function mergeVerticesByDistance(
  mesh: HalfEdgeMesh,
  epsilon: number,
  ctx: MeshOperationContext,
): MergeVerticesResult {
  if (epsilon <= 0) {
    throw new RangeError("weld epsilon must be strictly positive");
  }
  return runTransactionalMeshOp(mesh, () => mergeVerticesByDistanceUnlocked(mesh, epsilon, ctx));
}

function mergeVerticesByDistanceUnlocked(
  mesh: HalfEdgeMesh,
  epsilon: number,
  ctx: MeshOperationContext,
): MergeVerticesResult {
  const clusters = clusterByDistance(mesh, epsilon);
  const mapping = new TopologyMappingBuilder(mesh);
  if (clusters.length === 0) {
    const { mapping: topology, changes } = mapping.build(mesh);
    const first = [...mesh.vertices.keys()][0] ?? null;
    return {
      mesh,
      changes,
      mapping: topology,
      selection: { domain: "vertex", elementIds: first ? [first] : [] },
      warnings: [],
      survivorId: first,
      mergedCount: 0,
    };
  }

  const remap = new Map<VertexId, VertexId>();
  let survivorId = clusters[0]![0]!;
  for (const cluster of clusters) {
    const localSurvivor = cluster[0]!;
    survivorId = localSurvivor;
    let x = 0;
    let y = 0;
    let z = 0;
    for (const id of cluster) {
      const p = mesh.vertices.get(id)!.position;
      x += p[0];
      y += p[1];
      z += p[2];
    }
    const n = cluster.length;
    mesh.vertices.get(localSurvivor)!.position = [x / n, y / n, z / n];
    for (const id of cluster) {
      if (id !== localSurvivor) {
        remap.set(id, localSurvivor);
        mapping.replaceVertex(id, [localSurvivor]);
      }
    }
  }
  void ctx;
  return applyVertexRemap(mesh, mapping, remap, survivorId);
}

function applyVertexRemap(
  mesh: HalfEdgeMesh,
  mapping: TopologyMappingBuilder,
  remap: Map<VertexId, VertexId>,
  survivorId: VertexId,
): MergeVerticesResult {
  const warnings: MeshOperationWarning[] = [];
  const facesToRecreate: Array<{
    id: FaceId;
    materialSlot: number;
    isSmooth: boolean;
    vertices: VertexId[];
  }> = [];

  for (const [faceId, face] of mesh.faces) {
    const remapped = collapseLoop(mesh.getFaceVertices(faceId), remap);
    if (remapped.length < 3) {
      warnings.push({
        code: "degenerate-face",
        message: `Face ${faceId} collapsed and was removed`,
        elementIds: [faceId],
      });
      mapping.deleteFace(faceId);
      continue;
    }
    facesToRecreate.push({
      id: faceId,
      materialSlot: face.materialSlot,
      isSmooth: face.isSmooth,
      vertices: remapped,
    });
  }

  mesh.halfEdges.clear();
  mesh.edges.clear();
  mesh.corners.clear();
  mesh.faces.clear();

  for (const [from] of remap) {
    mesh.vertices.delete(from);
  }
  for (const v of mesh.vertices.values()) {
    v.halfEdge = null;
  }

  const builder = MeshBuilder.fromMesh(mesh);
  for (const face of facesToRecreate) {
    builder.addFace(face.vertices, {
      id: face.id,
      materialSlot: face.materialSlot,
      isSmooth: face.isSmooth,
    });
  }

  const { mapping: topology, changes } = mapping.build(mesh);
  return {
    mesh,
    changes,
    mapping: topology,
    selection: { domain: "vertex", elementIds: [survivorId] },
    warnings,
    survivorId,
    mergedCount: remap.size,
  };
}

function uniqueVertices(ids: readonly VertexId[]): VertexId[] {
  return [...new Set(ids)];
}

function pickSurvivor(request: MergeVerticesRequest, unique: readonly VertexId[]): VertexId {
  switch (request.target) {
    case "active":
      if (!request.activeId || !unique.includes(request.activeId)) {
        throw new RangeError("mergeVertices active target requires activeId in the set");
      }
      return request.activeId;
    case "first":
      return unique[0]!;
    case "last":
      return unique[unique.length - 1]!;
    case "center":
    case "cursor":
    case "custom":
      return unique[0]!;
    default: {
      const _never: never = request.target;
      return _never;
    }
  }
}

function resolvePosition(
  mesh: HalfEdgeMesh,
  request: MergeVerticesRequest,
  unique: readonly VertexId[],
  survivorId: VertexId,
  _ctx: MeshOperationContext,
): [number, number, number] {
  if (request.target === "custom") {
    if (!request.custom) {
      throw new RangeError("mergeVertices custom target requires custom position");
    }
    return [request.custom[0], request.custom[1], request.custom[2]];
  }
  if (request.target === "cursor") {
    if (!request.cursor) {
      throw new RangeError("mergeVertices cursor target requires cursor position");
    }
    return [request.cursor[0], request.cursor[1], request.cursor[2]];
  }
  if (request.target === "center") {
    let x = 0;
    let y = 0;
    let z = 0;
    for (const id of unique) {
      const p = mesh.vertices.get(id)!.position;
      x += p[0];
      y += p[1];
      z += p[2];
    }
    const n = unique.length;
    return [x / n, y / n, z / n];
  }
  const p = mesh.vertices.get(survivorId)!.position;
  return [p[0], p[1], p[2]];
}

function collapseLoop(loop: readonly VertexId[], remap: ReadonlyMap<VertexId, VertexId>): VertexId[] {
  const remapped: VertexId[] = [];
  for (const vId of loop) {
    const target = remap.get(vId) ?? vId;
    if (remapped.length === 0 || remapped[remapped.length - 1] !== target) {
      remapped.push(target);
    }
  }
  if (remapped.length > 1 && remapped[0] === remapped[remapped.length - 1]) {
    remapped.pop();
  }
  return remapped;
}

function clusterByDistance(mesh: HalfEdgeMesh, epsilon: number): VertexId[][] {
  const vList = [...mesh.vertices.values()];
  const parent = new Map<VertexId, VertexId>();
  const find = (id: VertexId): VertexId => {
    let current = parent.get(id) ?? id;
    while ((parent.get(current) ?? current) !== current) {
      current = parent.get(current)!;
    }
    parent.set(id, current);
    return current;
  };
  const union = (a: VertexId, b: VertexId): void => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) {
      parent.set(rb, ra);
    }
  };
  for (const v of vList) {
    parent.set(v.id, v.id);
  }
  const eps2 = epsilon * epsilon;
  for (let i = 0; i < vList.length; i++) {
    const a = vList[i]!;
    for (let j = i + 1; j < vList.length; j++) {
      const b = vList[j]!;
      const dx = a.position[0] - b.position[0];
      const dy = a.position[1] - b.position[1];
      const dz = a.position[2] - b.position[2];
      if (dx * dx + dy * dy + dz * dz <= eps2) {
        union(a.id, b.id);
      }
    }
  }
  const groups = new Map<VertexId, VertexId[]>();
  for (const v of vList) {
    const root = find(v.id);
    const list = groups.get(root) ?? [];
    list.push(v.id);
    groups.set(root, list);
  }
  return [...groups.values()].filter((group) => group.length > 1);
}
