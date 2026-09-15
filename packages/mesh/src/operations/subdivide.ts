import type { EdgeId, FaceId, IdFactory, VertexId } from "@modeling-kit/core";
import { MeshBuilder } from "../builder";
import type { HalfEdgeMesh } from "../half-edge-mesh";
import { lerpColor, lerpUv } from "../internal/attribute-interpolation";
import { deleteFace } from "../internal/delete-face";
import { TopologyMappingBuilder } from "../internal/topology-mapping-builder";
import { cloneMesh } from "../serialize";
import {
  createMeshOperationContext,
  type MeshOperationContext,
  type MeshOperationResult,
  type MeshOperationWarning,
} from "./contract";
import { runTransactionalMeshOp } from "./contract";

export interface SubdivideFacesRequest {
  readonly faceIds: readonly FaceId[];
  readonly cuts?: number;
}

export interface SubdivideResult {
  readonly newFaceIds: FaceId[];
}

export interface SubdivideOpResult extends MeshOperationResult, SubdivideResult {}

export function subdivideFaces(
  mesh: HalfEdgeMesh,
  request: SubdivideFacesRequest,
  ctx: MeshOperationContext,
): SubdivideOpResult;
export function subdivideFaces(
  mesh: HalfEdgeMesh,
  faceIds: readonly FaceId[],
  ids: IdFactory,
): SubdivideResult;
export function subdivideFaces(
  mesh: HalfEdgeMesh,
  requestOrIds: SubdivideFacesRequest | readonly FaceId[],
  ctxOrIds: MeshOperationContext | IdFactory,
): SubdivideOpResult | SubdivideResult {
  if (isIdFactory(ctxOrIds)) {
    const result = subdivideFacesOp(
      mesh,
      { faceIds: requestOrIds as readonly FaceId[] },
      createMeshOperationContext(ctxOrIds),
    );
    return { newFaceIds: result.newFaceIds };
  }
  return subdivideFacesOp(mesh, requestOrIds as SubdivideFacesRequest, ctxOrIds);
}

function isIdFactory(value: MeshOperationContext | IdFactory): value is IdFactory {
  return typeof (value as IdFactory).vertex === "function" && !("idFactory" in value);
}

function subdivideFacesOp(
  mesh: HalfEdgeMesh,
  request: SubdivideFacesRequest,
  ctx: MeshOperationContext,
): SubdivideOpResult {
  return runTransactionalMeshOp(mesh, () => {
  if (request.faceIds.length === 0) {
    throw new RangeError("subdivideFaces requires at least one face");
  }

  const cuts = Math.max(1, Math.floor(request.cuts ?? 1));
  const selected = new Set(request.faceIds.filter((id) => mesh.faces.has(id)));
  if (selected.size === 0) {
    throw new RangeError("subdivideFaces requires at least one existing face");
  }

  const start = cloneMesh(mesh);
  const mapping = new TopologyMappingBuilder(mesh);
  const warnings: MeshOperationWarning[] = [];
  let current = selected;
  let newFaceIds: FaceId[] = [];
  for (let pass = 0; pass < cuts; pass += 1) {
    newFaceIds = subdividePass(mesh, current, ctx, mapping, warnings);
    current = new Set(newFaceIds);
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
  };
  });
}

function subdividePass(
  mesh: HalfEdgeMesh,
  selectedIn: ReadonlySet<FaceId>,
  ctx: MeshOperationContext,
  mapping: TopologyMappingBuilder,
  warnings: MeshOperationWarning[],
): FaceId[] {
  const selected = new Set(selectedIn);
  const midByEdge = new Map<EdgeId, VertexId>();
  let builder = MeshBuilder.fromMesh(mesh);

  for (const faceId of selected) {
    const loop = mesh.getFaceVertices(faceId);
    if (loop.length < 3) {
      warnings.push({
        code: "degenerate-face",
        message: `Face ${faceId} skipped because it has fewer than 3 vertices`,
        elementIds: [faceId],
      });
      selected.delete(faceId);
      continue;
    }
    const edges = mesh.getFaceEdges(faceId);
    for (let i = 0; i < loop.length; i++) {
      const edgeId = edges[i]!;
      if (midByEdge.has(edgeId)) {
        continue;
      }
      const a = loop[i]!;
      const b = loop[(i + 1) % loop.length]!;
      const posA = mesh.vertices.get(a)!.position;
      const posB = mesh.vertices.get(b)!.position;
      const midId = ctx.idFactory.vertex();
      builder.addVertex(
        (posA[0] + posB[0]) * 0.5,
        (posA[1] + posB[1]) * 0.5,
        (posA[2] + posB[2]) * 0.5,
        midId,
      );
      mapping.createVertex(midId, [a, b]);
      midByEdge.set(edgeId, midId);
    }
  }

  const affected = new Set<FaceId>();
  for (const edgeId of midByEdge.keys()) {
    const [f1, f2] = mesh.getEdgeFaces(edgeId);
    if (f1) affected.add(f1);
    if (f2) affected.add(f2);
  }

  type RebuildPlan = {
    sourceFaceId: FaceId;
    materialSlot: number;
    isSmooth: boolean;
    selected: boolean;
    loop: VertexId[];
    expanded: VertexId[];
    midpoints: VertexId[];
    center?: VertexId;
    attrs: LoopAttrs;
    expandedUvs?: [number, number][];
    expandedColors?: [number, number, number, number][];
  };

  const plans: RebuildPlan[] = [];
  for (const faceId of affected) {
    const face = mesh.faces.get(faceId);
    if (!face) {
      continue;
    }
    const loop = mesh.getFaceVertices(faceId);
    const edges = mesh.getFaceEdges(faceId);
    const attrs = faceLoopAttributes(mesh, faceId);
    const expanded: VertexId[] = [];
    const expandedUvs: [number, number][] = [];
    const expandedColors: [number, number, number, number][] = [];
    const midpoints: VertexId[] = [];
    for (let i = 0; i < loop.length; i++) {
      expanded.push(loop[i]!);
      if (attrs.hasUv) {
        expandedUvs.push(attrs.uvs[i]!);
      }
      if (attrs.hasColor) {
        expandedColors.push(attrs.colors[i]!);
      }
      const mid = midByEdge.get(edges[i]!);
      const next = (i + 1) % loop.length;
      if (mid) {
        expanded.push(mid);
        midpoints.push(mid);
        if (attrs.hasUv) {
          expandedUvs.push(lerpUv(attrs.uvs[i]!, attrs.uvs[next]!, 0.5));
        }
        if (attrs.hasColor) {
          expandedColors.push(lerpColor(attrs.colors[i]!, attrs.colors[next]!, 0.5));
        }
      }
    }

    let center: VertexId | undefined;
    if (selected.has(faceId)) {
      let cx = 0;
      let cy = 0;
      let cz = 0;
      for (const vId of loop) {
        const p = mesh.vertices.get(vId)!.position;
        cx += p[0];
        cy += p[1];
        cz += p[2];
      }
      center = ctx.idFactory.vertex();
      builder.addVertex(cx / loop.length, cy / loop.length, cz / loop.length, center);
      mapping.createVertex(center, [...loop]);
    }

    plans.push({
      sourceFaceId: faceId,
      materialSlot: face.materialSlot,
      isSmooth: face.isSmooth,
      selected: selected.has(faceId),
      loop,
      expanded,
      midpoints,
      attrs,
      ...(center ? { center } : {}),
      ...(attrs.hasUv ? { expandedUvs } : {}),
      ...(attrs.hasColor ? { expandedColors } : {}),
    });
  }

  for (const plan of plans) {
    deleteFace(mesh, plan.sourceFaceId);
  }
  builder = MeshBuilder.fromMesh(mesh);

  const newFaceIds: FaceId[] = [];
  for (const plan of plans) {
    if (!plan.selected || !plan.center) {
      builder.addFace(plan.expanded, {
        id: plan.sourceFaceId,
        materialSlot: plan.materialSlot,
        isSmooth: plan.isSmooth,
        ...(plan.expandedUvs ? { uvs: plan.expandedUvs } : {}),
        ...(plan.expandedColors ? { colors: plan.expandedColors } : {}),
      });
      continue;
    }

    const n = plan.loop.length;
    const created: FaceId[] = [];
    const centerUv = plan.attrs.hasUv ? averageUv(plan.attrs.uvs) : undefined;
    const centerColor = plan.attrs.hasColor ? averageColor(plan.attrs.colors) : undefined;
    for (let i = 0; i < n; i++) {
      const childId = i === 0 ? plan.sourceFaceId : ctx.idFactory.face();
      const prev = (i - 1 + n) % n;
      const uvs =
        plan.attrs.hasUv && centerUv
          ? [
              plan.attrs.uvs[i]!,
              lerpUv(plan.attrs.uvs[i]!, plan.attrs.uvs[(i + 1) % n]!, 0.5),
              centerUv,
              lerpUv(plan.attrs.uvs[prev]!, plan.attrs.uvs[i]!, 0.5),
            ]
          : undefined;
      const colors =
        plan.attrs.hasColor && centerColor
          ? [
              plan.attrs.colors[i]!,
              lerpColor(plan.attrs.colors[i]!, plan.attrs.colors[(i + 1) % n]!, 0.5),
              centerColor,
              lerpColor(plan.attrs.colors[prev]!, plan.attrs.colors[i]!, 0.5),
            ]
          : undefined;
      builder.addFace([plan.loop[i]!, plan.midpoints[i]!, plan.center, plan.midpoints[prev]!], {
        id: childId,
        materialSlot: plan.materialSlot,
        isSmooth: plan.isSmooth,
        ...(uvs ? { uvs } : {}),
        ...(colors ? { colors } : {}),
      });
      if (childId !== plan.sourceFaceId) {
        mapping.createFace(childId, [plan.sourceFaceId]);
      }
      created.push(childId);
      newFaceIds.push(childId);
    }
    mapping.replaceFace(plan.sourceFaceId, created);
  }

  return newFaceIds;
}

interface LoopAttrs {
  hasUv: boolean;
  hasColor: boolean;
  uvs: [number, number][];
  colors: [number, number, number, number][];
}

function faceLoopAttributes(mesh: HalfEdgeMesh, faceId: FaceId): LoopAttrs {
  const attrs: LoopAttrs = { hasUv: false, hasColor: false, uvs: [], colors: [] };
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
