import type { EdgeId, FaceId, VertexId } from "@modeling-kit/core";
import { MeshBuilder } from "../builder";
import type { HalfEdgeMesh } from "../half-edge-mesh";
import { lerpColor, lerpUv } from "../internal/attribute-interpolation";
import { deleteFace } from "../internal/delete-face";
import { TopologyMappingBuilder } from "../internal/topology-mapping-builder";
import { cloneMesh } from "../serialize";
import type { MeshOperationContext, MeshOperationResult, MeshOperationWarning } from "./contract";
import { runTransactionalMeshOp } from "./contract";

export interface CatmullClarkRequest {
  readonly iterations?: number;
}

export interface CatmullClarkResult extends MeshOperationResult {
  readonly newFaceIds: readonly FaceId[];
  readonly iterations: number;
}

export function catmullClarkSubdivide(
  mesh: HalfEdgeMesh,
  request: CatmullClarkRequest,
  ctx: MeshOperationContext,
): CatmullClarkResult {
  return runTransactionalMeshOp(mesh, () => {
  if (mesh.faces.size === 0) {
    throw new RangeError("catmullClarkSubdivide requires at least one face");
  }
  const iterations = Math.max(1, Math.floor(request.iterations ?? 1));
  const start = cloneMesh(mesh);
  const mapping = new TopologyMappingBuilder(mesh);
  const warnings: MeshOperationWarning[] = [];
  let newFaceIds: FaceId[] = [];
  for (let i = 0; i < iterations; i += 1) {
    newFaceIds = catmullClarkOnce(mesh, ctx, mapping, warnings);
  }
  mapping.snapshotNewElements(start, mesh);
  const { mapping: topology, changes } = mapping.build(mesh);
  return {
    mesh,
    changes,
    mapping: topology,
    selection: { domain: "face", elementIds: newFaceIds },
    warnings,
    newFaceIds,
    iterations,
  };
  });
}

interface FaceSnap {
  readonly id: FaceId;
  readonly loop: readonly VertexId[];
  readonly edges: readonly EdgeId[];
  readonly materialSlot: number;
  readonly isSmooth: boolean;
  readonly hasUv: boolean;
  readonly hasColor: boolean;
  readonly uvs: readonly [number, number][];
  readonly colors: readonly [number, number, number, number][];
}

function catmullClarkOnce(
  mesh: HalfEdgeMesh,
  ctx: MeshOperationContext,
  mapping: TopologyMappingBuilder,
  warnings: MeshOperationWarning[],
): FaceId[] {
  const snaps: FaceSnap[] = [];
  for (const [faceId, face] of mesh.faces) {
    const loop = mesh.getFaceVertices(faceId);
    if (loop.length < 3) {
      warnings.push({
        code: "degenerate-face",
        message: `Face ${faceId} skipped because it has fewer than 3 vertices`,
        elementIds: [faceId],
      });
      continue;
    }
    const attrs = faceLoopAttributes(mesh, faceId);
    snaps.push({
      id: faceId,
      loop,
      edges: mesh.getFaceEdges(faceId),
      materialSlot: face.materialSlot,
      isSmooth: face.isSmooth,
      hasUv: attrs.hasUv,
      hasColor: attrs.hasColor,
      uvs: attrs.uvs,
      colors: attrs.colors,
    });
  }
  if (snaps.length === 0) {
    throw new RangeError("catmullClarkSubdivide requires at least one non-degenerate face");
  }

  const facesByVertex = new Map<VertexId, FaceId[]>();
  const edgesByVertex = new Map<VertexId, EdgeId[]>();
  const facesByEdge = new Map<EdgeId, FaceId[]>();
  const edgeEnds = new Map<EdgeId, readonly [VertexId, VertexId]>();

  for (const snap of snaps) {
    const n = snap.loop.length;
    for (let i = 0; i < n; i += 1) {
      const v = snap.loop[i]!;
      const e = snap.edges[i]!;
      const next = snap.loop[(i + 1) % n]!;
      pushUnique(facesByVertex, v, snap.id);
      pushUnique(edgesByVertex, v, e);
      pushUnique(facesByEdge, e, snap.id);
      if (!edgeEnds.has(e)) {
        edgeEnds.set(e, [v, next]);
      }
    }
  }

  const facePointPos = new Map<FaceId, [number, number, number]>();
  const facePointId = new Map<FaceId, VertexId>();
  for (const snap of snaps) {
    facePointPos.set(snap.id, averagePositions(mesh, snap.loop));
    const id = ctx.idFactory.vertex();
    facePointId.set(snap.id, id);
    mapping.createVertex(id, [...snap.loop]);
  }

  const edgePointPos = new Map<EdgeId, [number, number, number]>();
  const edgePointId = new Map<EdgeId, VertexId>();
  for (const [edgeId, ends] of edgeEnds) {
    const p0 = mesh.vertices.get(ends[0])!.position;
    const p1 = mesh.vertices.get(ends[1])!.position;
    const incident = facesByEdge.get(edgeId) ?? [];
    let pos: [number, number, number];
    if (incident.length === 2) {
      const f0 = facePointPos.get(incident[0]!)!;
      const f1 = facePointPos.get(incident[1]!)!;
      pos = [
        (p0[0] + p1[0] + f0[0] + f1[0]) * 0.25,
        (p0[1] + p1[1] + f0[1] + f1[1]) * 0.25,
        (p0[2] + p1[2] + f0[2] + f1[2]) * 0.25,
      ];
    } else {
      pos = [(p0[0] + p1[0]) * 0.5, (p0[1] + p1[1]) * 0.5, (p0[2] + p1[2]) * 0.5];
    }
    edgePointPos.set(edgeId, pos);
    const id = ctx.idFactory.vertex();
    edgePointId.set(edgeId, id);
    mapping.createVertex(id, [ends[0], ends[1]]);
  }

  const vertexPointPos = new Map<VertexId, [number, number, number]>();
  for (const [vertexId, vertex] of mesh.vertices) {
    const S = vertex.position;
    const incidentEdges = edgesByVertex.get(vertexId) ?? [];
    if (incidentEdges.length === 0) {
      vertexPointPos.set(vertexId, [S[0], S[1], S[2]]);
      continue;
    }
    const boundaryEdges = incidentEdges.filter((edgeId) => (facesByEdge.get(edgeId) ?? []).length < 2);
    if (boundaryEdges.length > 0) {
      const neighbors: VertexId[] = [];
      for (const edgeId of boundaryEdges) {
        const ends = edgeEnds.get(edgeId)!;
        neighbors.push(ends[0] === vertexId ? ends[1] : ends[0]);
      }
      if (neighbors.length === 2) {
        const a = mesh.vertices.get(neighbors[0]!)!.position;
        const b = mesh.vertices.get(neighbors[1]!)!.position;
        vertexPointPos.set(vertexId, [
          (a[0] + 6 * S[0] + b[0]) / 8,
          (a[1] + 6 * S[1] + b[1]) / 8,
          (a[2] + 6 * S[2] + b[2]) / 8,
        ]);
      } else {
        let x = S[0];
        let y = S[1];
        let z = S[2];
        for (const other of neighbors) {
          const p = mesh.vertices.get(other)!.position;
          x += p[0];
          y += p[1];
          z += p[2];
        }
        const denom = neighbors.length + 1;
        vertexPointPos.set(vertexId, [x / denom, y / denom, z / denom]);
      }
      continue;
    }

    const n = incidentEdges.length;
    const incidentFaces = facesByVertex.get(vertexId) ?? [];
    const Q = averageVec(incidentFaces.map((id) => facePointPos.get(id)!));
    const R = averageVec(
      incidentEdges.map((edgeId) => {
        const ends = edgeEnds.get(edgeId)!;
        const a = mesh.vertices.get(ends[0])!.position;
        const b = mesh.vertices.get(ends[1])!.position;
        return [(a[0] + b[0]) * 0.5, (a[1] + b[1]) * 0.5, (a[2] + b[2]) * 0.5] as [
          number,
          number,
          number,
        ];
      }),
    );
    vertexPointPos.set(vertexId, [
      (Q[0] + 2 * R[0] + (n - 3) * S[0]) / n,
      (Q[1] + 2 * R[1] + (n - 3) * S[1]) / n,
      (Q[2] + 2 * R[2] + (n - 3) * S[2]) / n,
    ]);
  }

  for (const snap of snaps) {
    deleteFace(mesh, snap.id);
  }

  for (const [vertexId, pos] of vertexPointPos) {
    const vertex = mesh.vertices.get(vertexId);
    if (vertex) {
      vertex.position[0] = pos[0];
      vertex.position[1] = pos[1];
      vertex.position[2] = pos[2];
    }
  }

  const builder = MeshBuilder.fromMesh(mesh);
  for (const [faceId, pos] of facePointPos) {
    builder.addVertex(pos[0], pos[1], pos[2], facePointId.get(faceId)!);
  }
  for (const [edgeId, pos] of edgePointPos) {
    builder.addVertex(pos[0], pos[1], pos[2], edgePointId.get(edgeId)!);
  }

  const newFaceIds: FaceId[] = [];
  for (const snap of snaps) {
    const facePt = facePointId.get(snap.id)!;
    const n = snap.loop.length;
    const created: FaceId[] = [];
    const centerUv = snap.hasUv ? averageUv(snap.uvs) : undefined;
    const centerColor = snap.hasColor ? averageColor(snap.colors) : undefined;
    for (let i = 0; i < n; i += 1) {
      const childId = i === 0 ? snap.id : ctx.idFactory.face();
      const prev = (i - 1 + n) % n;
      const uvs =
        snap.hasUv && centerUv
          ? [
              snap.uvs[i]!,
              lerpUv(snap.uvs[i]!, snap.uvs[(i + 1) % n]!, 0.5),
              centerUv,
              lerpUv(snap.uvs[prev]!, snap.uvs[i]!, 0.5),
            ]
          : undefined;
      const colors =
        snap.hasColor && centerColor
          ? [
              snap.colors[i]!,
              lerpColor(snap.colors[i]!, snap.colors[(i + 1) % n]!, 0.5),
              centerColor,
              lerpColor(snap.colors[prev]!, snap.colors[i]!, 0.5),
            ]
          : undefined;
      builder.addFace(
        [snap.loop[i]!, edgePointId.get(snap.edges[i]!)!, facePt, edgePointId.get(snap.edges[prev]!)!],
        {
          id: childId,
          materialSlot: snap.materialSlot,
          isSmooth: snap.isSmooth,
          ...(uvs ? { uvs } : {}),
          ...(colors ? { colors } : {}),
        },
      );
      if (childId !== snap.id) {
        mapping.createFace(childId, [snap.id]);
      }
      created.push(childId);
      newFaceIds.push(childId);
    }
    mapping.replaceFace(snap.id, created);
  }

  return newFaceIds;
}

function pushUnique<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const list = map.get(key);
  if (!list) {
    map.set(key, [value]);
    return;
  }
  if (!list.includes(value)) {
    list.push(value);
  }
}

function averagePositions(mesh: HalfEdgeMesh, ids: readonly VertexId[]): [number, number, number] {
  return averageVec(ids.map((id) => mesh.vertices.get(id)!.position));
}

function averageVec(points: readonly (readonly [number, number, number])[]): [number, number, number] {
  let x = 0;
  let y = 0;
  let z = 0;
  for (const p of points) {
    x += p[0];
    y += p[1];
    z += p[2];
  }
  const n = points.length || 1;
  return [x / n, y / n, z / n];
}

function faceLoopAttributes(mesh: HalfEdgeMesh, faceId: FaceId): {
  hasUv: boolean;
  hasColor: boolean;
  uvs: [number, number][];
  colors: [number, number, number, number][];
} {
  const attrs = {
    hasUv: false,
    hasColor: false,
    uvs: [] as [number, number][],
    colors: [] as [number, number, number, number][],
  };
  for (const cornerId of mesh.getFaceCorners(faceId)) {
    const corner = mesh.corners.get(cornerId);
    if (corner?.uv) {
      attrs.hasUv = true;
      attrs.uvs.push([corner.uv[0], corner.uv[1]]);
    } else {
      attrs.uvs.push([0, 0]);
    }
    if (corner?.color) {
      attrs.hasColor = true;
      attrs.colors.push([corner.color[0], corner.color[1], corner.color[2], corner.color[3]]);
    } else {
      attrs.colors.push([1, 1, 1, 1]);
    }
  }
  return attrs;
}

function averageUv(uvs: readonly [number, number][]): [number, number] {
  let u = 0;
  let v = 0;
  for (const uv of uvs) {
    u += uv[0];
    v += uv[1];
  }
  return [u / uvs.length, v / uvs.length];
}

function averageColor(
  colors: readonly [number, number, number, number][],
): [number, number, number, number] {
  let r = 0;
  let g = 0;
  let b = 0;
  let a = 0;
  for (const c of colors) {
    r += c[0];
    g += c[1];
    b += c[2];
    a += c[3];
  }
  const n = colors.length;
  return [r / n, g / n, b / n, a / n];
}
