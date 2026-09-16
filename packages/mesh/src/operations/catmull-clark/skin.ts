import type { EdgeId, FaceId, VertexId } from "@modeling-kit/core";
import { interpolateSkinWeights, type SkinInfluence } from "../../internal/attribute-interpolation";
import type { MeshOperationContext, MeshOperationWarning } from "../contract";

export function subdivideSkinWeights(input: {
  original: ReadonlyMap<VertexId, readonly SkinInfluence[]> | undefined;
  faceLoops: ReadonlyMap<FaceId, readonly VertexId[]>;
  facePointId: ReadonlyMap<FaceId, VertexId>;
  edgeEnds: ReadonlyMap<EdgeId, readonly [VertexId, VertexId]>;
  edgePointId: ReadonlyMap<EdgeId, VertexId>;
  ctx: MeshOperationContext;
  warnings: MeshOperationWarning[];
}): Map<VertexId, readonly SkinInfluence[]> | undefined {
  if (!input.original) {
    return undefined;
  }
  const next = new Map<VertexId, readonly SkinInfluence[]>(input.original);
  const normalize = input.ctx.attributes.normalizeWeights;

  for (const [faceId, loop] of input.faceLoops) {
    const id = input.facePointId.get(faceId);
    if (!id) {
      continue;
    }
    let acc: SkinInfluence[] = [];
    let missing = false;
    for (let i = 0; i < loop.length; i += 1) {
      const weights = input.original.get(loop[i]!) ?? [];
      if (weights.length === 0) {
        missing = true;
      }
      acc = interpolateSkinWeights(acc, weights, 1 / (i + 1), false);
    }
    if (missing) {
      input.warnings.push({
        code: "missing-skin-weights",
        message: `Face ${faceId} is missing skin weights on one or more vertices`,
        elementIds: [...loop],
      });
    }
    next.set(id, normalize ? interpolateSkinWeights(acc, [], 0, true) : acc);
  }

  for (const [edgeId, ends] of input.edgeEnds) {
    const id = input.edgePointId.get(edgeId);
    if (!id) {
      continue;
    }
    const a = input.original.get(ends[0]) ?? [];
    const b = input.original.get(ends[1]) ?? [];
    if (a.length === 0 && b.length === 0) {
      input.warnings.push({
        code: "missing-skin-weights",
        message: `Edge ${edgeId} is missing skin weights on both endpoints`,
        elementIds: [edgeId, ends[0], ends[1]],
      });
    }
    next.set(id, interpolateSkinWeights(a, b, 0.5, normalize));
  }

  return next;
}
