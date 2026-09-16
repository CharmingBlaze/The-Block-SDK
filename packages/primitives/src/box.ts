import type { VertexId } from "@modeling-kit/core";
import { MeshBuilder, type CubeFaceIds } from "@modeling-kit/mesh";
import {
  assertQuadVertices,
  bucketCubeFace,
  cubeGridPosition,
  iterateCubeGridQuads,
  uniqueCubeGridVertex,
} from "./cube-surface";
import {
  QUAD_UV,
  addFace,
  emptyGroups,
  finalizePrimitive,
  integerAtLeast,
  positive,
  requireValid,
} from "./shared";
import type {
  BoxParameters,
  PrimitiveGenerationContext,
  PrimitiveGenerator,
  PrimitiveResult,
  PrimitiveValidationResult,
} from "./types";

export const boxDefaults: BoxParameters = {
  width: 1,
  height: 1,
  depth: 1,
};

export function validateBoxParameters(parameters: BoxParameters): PrimitiveValidationResult {
  const errors: string[] = [];
  positive("width", parameters.width, errors);
  positive("height", parameters.height, errors);
  positive("depth", parameters.depth, errors);
  integerAtLeast("segmentsX", parameters.segmentsX ?? 1, 1, errors);
  integerAtLeast("segmentsY", parameters.segmentsY ?? 1, 1, errors);
  integerAtLeast("segmentsZ", parameters.segmentsZ ?? 1, 1, errors);
  return { ok: errors.length === 0, errors };
}

/**
 * Canonical modeling box: 8 vertices, 12 edges, 6 quads, per-corner UVs.
 * Pivot is the geometric centre. Right-handed; +Y up; +Z front.
 */
export function generateBox(
  parameters: BoxParameters = boxDefaults,
  context: PrimitiveGenerationContext = {},
): PrimitiveResult {
  const merged: BoxParameters = {
    width: parameters.width,
    height: parameters.height,
    depth: parameters.depth,
    segmentsX: parameters.segmentsX ?? 1,
    segmentsY: parameters.segmentsY ?? 1,
    segmentsZ: parameters.segmentsZ ?? 1,
  };
  requireValid(validateBoxParameters(merged), "box");
  if ((merged.segmentsX ?? 1) !== 1 || (merged.segmentsY ?? 1) !== 1 || (merged.segmentsZ ?? 1) !== 1) {
    return generateSubdividedBox(merged, context);
  }

  const builder = new MeshBuilder(context.meshId);
  const hx = merged.width / 2;
  const hy = merged.height / 2;
  const hz = merged.depth / 2;
  const v0 = builder.addVertex(-hx, -hy, hz);
  const v1 = builder.addVertex(hx, -hy, hz);
  const v2 = builder.addVertex(hx, hy, hz);
  const v3 = builder.addVertex(-hx, hy, hz);
  const v4 = builder.addVertex(-hx, -hy, -hz);
  const v5 = builder.addVertex(hx, -hy, -hz);
  const v6 = builder.addVertex(hx, hy, -hz);
  const v7 = builder.addVertex(-hx, hy, -hz);

  const requested = context.faceIds;
  const posZ = addOriented(builder, [v0, v1, v2, v3], requested?.posZ);
  const negZ = addOriented(builder, [v5, v4, v7, v6], requested?.negZ);
  const posY = addOriented(builder, [v3, v2, v6, v7], requested?.posY);
  const negY = addOriented(builder, [v4, v5, v1, v0], requested?.negY);
  const posX = addOriented(builder, [v1, v5, v6, v2], requested?.posX);
  const negX = addOriented(builder, [v4, v0, v3, v7], requested?.negX);

  const faceIds: CubeFaceIds = { posX, negX, posY, negY, posZ, negZ };
  return finalizePrimitive("box", builder, {
    ...emptyGroups(),
    top: [posY],
    bottom: [negY],
    front: [posZ],
    back: [negZ],
    sides: [posX, negX, posZ, negZ],
    caps: [posY, negY],
    ...faceIds,
  });
}

export const boxPrimitive: PrimitiveGenerator<BoxParameters> = {
  type: "box",
  defaults: boxDefaults,
  validate: validateBoxParameters,
  generate: generateBox,
};

function addOriented(
  builder: MeshBuilder,
  vertices: Parameters<typeof addFace>[1],
  id: CubeFaceIds[keyof CubeFaceIds] | undefined,
): ReturnType<MeshBuilder["addFace"]> {
  return builder.addFace(vertices, {
    ...(id ? { id } : {}),
    uvs: QUAD_UV,
  });
}

export function generateSubdividedBox(
  parameters: BoxParameters,
  context: PrimitiveGenerationContext = {},
): PrimitiveResult {
  requireValid(validateBoxParameters(parameters), "box");
  const spec = {
    nx: parameters.segmentsX ?? 1,
    ny: parameters.segmentsY ?? 1,
    nz: parameters.segmentsZ ?? 1,
  };
  const builder = new MeshBuilder(context.meshId);
  const hx = parameters.width / 2;
  const hy = parameters.height / 2;
  const hz = parameters.depth / 2;
  const cache = new Map<string, VertexId>();
  const top: ReturnType<MeshBuilder["addFace"]>[] = [];
  const bottom: ReturnType<MeshBuilder["addFace"]>[] = [];
  const front: ReturnType<MeshBuilder["addFace"]>[] = [];
  const back: ReturnType<MeshBuilder["addFace"]>[] = [];
  const sides: ReturnType<MeshBuilder["addFace"]>[] = [];

  for (const quad of iterateCubeGridQuads(spec)) {
    const verts = quad.corners.map((corner) =>
      uniqueCubeGridVertex(corner, cache, () => {
        const p = cubeGridPosition(corner, spec, hx, hy, hz);
        return builder.addVertex(p[0], p[1], p[2]);
      }),
    );
    assertQuadVertices(verts);
    const id = addFace(builder, verts, [...quad.uvs]);
    bucketCubeFace(quad.face, id, top, bottom, front, back, sides);
  }

  return finalizePrimitive("box", builder, {
    ...emptyGroups(),
    top,
    bottom,
    front,
    back,
    sides: [...sides, ...front, ...back],
    caps: [...top, ...bottom],
  });
}
