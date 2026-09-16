import type { VertexId } from "@modeling-kit/core";
import { MeshBuilder } from "@modeling-kit/mesh";
import {
  assertQuadVertices,
  bucketCubeFace,
  cubeGridPosition,
  iterateCubeGridQuads,
  uniqueCubeGridVertex,
} from "./cube-surface";
import { projectOntoRoundedBox, roundedBoxNormal } from "./rounded-cube-project";
import { markUvSeams } from "./library/seams";
import { addFace, emptyGroups, finalizePrimitive, integerAtLeast, positive, requireValid } from "./shared";
import type {
  PrimitiveGenerationContext,
  PrimitiveGenerator,
  PrimitiveResult,
  PrimitiveValidationResult,
  RoundedCubeParameters,
} from "./types";

export const roundedCubeDefaults: RoundedCubeParameters = {
  width: 1,
  height: 1,
  depth: 1,
  radius: 0.15,
  roundSegments: 4,
  edgeSegments: 1,
};

export function validateRoundedCubeParameters(parameters: RoundedCubeParameters): PrimitiveValidationResult {
  const errors: string[] = [];
  positive("width", parameters.width, errors);
  positive("height", parameters.height, errors);
  positive("depth", parameters.depth, errors);
  positive("radius", parameters.radius, errors);
  integerAtLeast("roundSegments", parameters.roundSegments, 1, errors);
  integerAtLeast("edgeSegments", parameters.edgeSegments, 1, errors);
  const maxR = Math.min(parameters.width, parameters.height, parameters.depth) / 2;
  if (parameters.radius >= maxR) {
    errors.push("radius must be smaller than half the shortest side");
  }
  return { ok: errors.length === 0, errors };
}

export function generateRoundedCube(
  parameters: RoundedCubeParameters = roundedCubeDefaults,
  context: PrimitiveGenerationContext = {},
): PrimitiveResult {
  requireValid(validateRoundedCubeParameters(parameters), "roundedCube");
  const hx = parameters.width / 2;
  const hy = parameters.height / 2;
  const hz = parameters.depth / 2;
  const radius = parameters.radius;
  const spec = {
    nx: parameters.edgeSegments + 2 * parameters.roundSegments,
    ny: parameters.edgeSegments + 2 * parameters.roundSegments,
    nz: parameters.edgeSegments + 2 * parameters.roundSegments,
  };
  const builder = new MeshBuilder(context.meshId);
  const cache = new Map<string, VertexId>();
  const top: ReturnType<MeshBuilder["addFace"]>[] = [];
  const bottom: ReturnType<MeshBuilder["addFace"]>[] = [];
  const front: ReturnType<MeshBuilder["addFace"]>[] = [];
  const back: ReturnType<MeshBuilder["addFace"]>[] = [];
  const sides: ReturnType<MeshBuilder["addFace"]>[] = [];

  for (const quad of iterateCubeGridQuads(spec)) {
    const verts = quad.corners.map((corner) =>
      uniqueCubeGridVertex(corner, cache, () => {
        const cube = cubeGridPosition(corner, spec, hx, hy, hz);
        const p = projectOntoRoundedBox(cube[0], cube[1], cube[2], hx, hy, hz, radius);
        return builder.addVertex(p[0], p[1], p[2]);
      }),
    );
    assertQuadVertices(verts);
    const normals = verts.map((id) => {
      const p = builder.getMesh().vertices.get(id)!.position;
      return roundedBoxNormal(p[0], p[1], p[2], hx, hy, hz, radius);
    });
    const id = addFace(builder, verts, [...quad.uvs], { normals, isSmooth: true });
    bucketCubeFace(quad.face, id, top, bottom, front, back, sides);
  }

  const result = finalizePrimitive("roundedCube", builder, {
    ...emptyGroups(),
    top,
    bottom,
    front,
    back,
    sides: [...sides, ...front, ...back],
    caps: [...top, ...bottom],
  });
  markUvSeams(result.mesh);
  return result;
}

export const roundedCubePrimitive: PrimitiveGenerator<RoundedCubeParameters> = {
  type: "roundedCube",
  defaults: roundedCubeDefaults,
  validate: validateRoundedCubeParameters,
  generate: generateRoundedCube,
};
