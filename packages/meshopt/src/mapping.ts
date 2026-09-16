import type { CornerId, FaceId, VertexId } from "@modeling-kit/core";
import type { DerivedTriangleBuffers, TriangleMapping } from "./types";

const UNUSED = 0xffffffff;

export function copyU32(source: Uint32Array): Uint32Array {
  return new Uint32Array(source);
}

export function copyF32(source: Float32Array): Float32Array {
  return new Float32Array(source);
}

export function applyFloatRemap(
  source: Float32Array | undefined,
  stride: number,
  remap: Uint32Array,
  unique: number,
): Float32Array | undefined {
  if (!source) {
    return undefined;
  }
  const out = new Float32Array(unique * stride);
  const count = source.length / stride;
  for (let i = 0; i < count; i++) {
    const dest = remap[i];
    if (dest === undefined || dest === UNUSED) {
      continue;
    }
    const from = i * stride;
    const to = dest * stride;
    for (let k = 0; k < stride; k++) {
      out[to + k] = source[from + k]!;
    }
  }
  return out;
}

export function applyIdRemap<T>(
  source: readonly T[] | undefined,
  remap: Uint32Array,
  unique: number,
): T[] | undefined {
  if (!source) {
    return undefined;
  }
  const out: Array<T | undefined> = new Array(unique);
  for (let i = 0; i < source.length; i++) {
    const dest = remap[i];
    if (dest === undefined || dest === UNUSED) {
      continue;
    }
    out[dest] = source[i];
  }
  return out.filter((value): value is T => value !== undefined);
}

export function remapTriangles(
  originalIndices: Uint32Array,
  newIndices: Uint32Array,
  triangleFaceIds: readonly FaceId[] | undefined,
  inverseRemap?: Uint32Array,
): { readonly ids: FaceId[] | undefined; readonly dropped: number } {
  if (!triangleFaceIds) {
    return { ids: undefined, dropped: 0 };
  }
  const buckets = new Map<string, FaceId[]>();
  const originalCount = originalIndices.length / 3;
  for (let t = 0; t < originalCount; t++) {
    const key = triangleKey(originalIndices, t);
    const list = buckets.get(key) ?? [];
    const faceId = triangleFaceIds[t];
    if (faceId) {
      list.push(faceId);
    }
    buckets.set(key, list);
  }
  const next: FaceId[] = [];
  let dropped = 0;
  const newCount = newIndices.length / 3;
  for (let t = 0; t < newCount; t++) {
    const key = triangleKey(newIndices, t, inverseRemap);
    const list = buckets.get(key);
    const faceId = list?.shift();
    if (faceId) {
      next.push(faceId);
    } else {
      dropped += 1;
    }
  }
  return { ids: next, dropped };
}

export function invertRemap(remap: Uint32Array, unique: number): Uint32Array {
  const inverse = new Uint32Array(unique);
  for (let i = 0; i < remap.length; i++) {
    const dest = remap[i];
    if (dest === undefined || dest === UNUSED) {
      continue;
    }
    inverse[dest] = i;
  }
  return inverse;
}

export function mappingFrom(
  buffers: DerivedTriangleBuffers,
  indices: Uint32Array,
  remap: Uint32Array | undefined,
  unique: number | undefined,
  originalIndices: Uint32Array,
  simplified: boolean,
): TriangleMapping {
  const inverse = remap && unique !== undefined ? invertRemap(remap, unique) : undefined;
  const faces = remapTriangles(originalIndices, indices, buffers.triangleFaceIds, inverse);
  const vertexIdMap = remap
    ? applyIdRemap(buffers.vertexIdMap, remap, unique ?? 0)
    : buffers.vertexIdMap
      ? [...buffers.vertexIdMap]
      : undefined;
  const cornerIdMap = remap
    ? applyIdRemap(buffers.cornerIdMap, remap, unique ?? 0)
    : buffers.cornerIdMap
      ? [...buffers.cornerIdMap]
      : undefined;
  if (simplified) {
    return {
      status: "partial",
      ...(faces.ids ? { triangleFaceIds: faces.ids } : {}),
      ...(vertexIdMap ? { vertexIdMap: vertexIdMap as VertexId[] } : {}),
      ...(cornerIdMap ? { cornerIdMap: cornerIdMap as CornerId[] } : {}),
      limitation: "simplification-dropped-triangles",
    };
  }
  if (faces.dropped > 0 || !faces.ids) {
    return {
      status: faces.ids ? "partial" : "none",
      ...(faces.ids ? { triangleFaceIds: faces.ids } : {}),
      ...(vertexIdMap ? { vertexIdMap: vertexIdMap as VertexId[] } : {}),
      ...(cornerIdMap ? { cornerIdMap: cornerIdMap as CornerId[] } : {}),
      ...(faces.ids ? {} : { limitation: "source-mapping-unavailable" }),
    };
  }
  return {
    status: "exact",
    triangleFaceIds: faces.ids,
    ...(vertexIdMap ? { vertexIdMap: vertexIdMap as VertexId[] } : {}),
    ...(cornerIdMap ? { cornerIdMap: cornerIdMap as CornerId[] } : {}),
  };
}

function triangleKey(indices: Uint32Array, triangle: number, inverse?: Uint32Array): string {
  const n0 = indices[triangle * 3] ?? 0;
  const n1 = indices[triangle * 3 + 1] ?? 0;
  const n2 = indices[triangle * 3 + 2] ?? 0;
  const a = inverse ? (inverse[n0] ?? n0) : n0;
  const b = inverse ? (inverse[n1] ?? n1) : n1;
  const c = inverse ? (inverse[n2] ?? n2) : n2;
  return [a, b, c].sort((left, right) => left - right).join(",");
}
