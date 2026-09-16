import type { MeshoptEncoder, MeshoptSimplifier } from "meshoptimizer";
import { applyFloatRemap, copyF32, copyU32, mappingFrom } from "./mapping";
import type { MeshoptLimits } from "./limits";
import type { MeshoptLodLevel, MeshoptRequest, OptimizedTriangles } from "./types";
import { resolveTargetIndexCount } from "./validate";

export interface OptimizeBackends {
  readonly encoder: typeof MeshoptEncoder;
  readonly simplifier: typeof MeshoptSimplifier;
}

export function optimizeDerived(
  request: MeshoptRequest,
  backends: OptimizeBackends,
  limits: MeshoptLimits,
): { readonly primary: OptimizedTriangles; readonly lod: MeshoptLodLevel[] } {
  if (request.mode === "simplify") {
    const primary = simplifyOnce(request, backends, resolveTargetIndexCount(request, limits));
    const lod: MeshoptLodLevel[] = [];
    for (const ratio of request.lodRatios ?? []) {
      const count = Math.max(limits.minTriangles * 3, Math.floor(request.indices.length * ratio));
      const level = simplifyOnce(request, backends, count - (count % 3));
      lod.push({ ...level, indexCount: level.indices.length, ratio });
    }
    return { primary, lod };
  }
  return { primary: reorderOnce(request, backends.encoder), lod: [] };
}

function reorderOnce(request: MeshoptRequest, encoder: typeof MeshoptEncoder): OptimizedTriangles {
  const indices = copyU32(request.indices);
  const original = copyU32(request.indices);
  const [remap, unique] = encoder.reorderMesh(indices, true, request.optsize === true);
  return assemble(request, indices, original, remap, unique, false);
}

function simplifyOnce(
  request: MeshoptRequest,
  backends: OptimizeBackends,
  targetIndexCount: number,
): OptimizedTriangles {
  const indices = copyU32(request.indices);
  const original = copyU32(request.indices);
  const positions = copyF32(request.positions);
  const [simplified, error] = backends.simplifier.simplify(
    indices,
    positions,
    3,
    targetIndexCount,
    request.targetError ?? 1e-2,
    ["Prune"],
  );
  const [remap, unique] = backends.simplifier.compactMesh(simplified);
  const assembled = assemble(request, simplified, original, remap, unique, true);
  return { ...assembled, error };
}

function assemble(
  request: MeshoptRequest,
  indices: Uint32Array,
  originalIndices: Uint32Array,
  remap: Uint32Array,
  unique: number,
  simplified: boolean,
): OptimizedTriangles {
  const positions = applyFloatRemap(request.positions, 3, remap, unique) ?? new Float32Array(0);
  const normals = applyFloatRemap(request.normals, 3, remap, unique);
  const uvs = applyFloatRemap(request.uvs, 2, remap, unique);
  return {
    positions,
    indices,
    ...(normals ? { normals } : {}),
    ...(uvs ? { uvs } : {}),
    mapping: mappingFrom(request, indices, remap, unique, originalIndices, simplified),
  };
}
