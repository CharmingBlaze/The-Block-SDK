import { MeshBuilder, type CubeFaceIds } from "@modeling-kit/mesh";
import {
  QUAD_UV,
  addFace,
  emptyGroups,
  finalizePrimitive,
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
  };
  requireValid(validateBoxParameters(merged), "box");

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
