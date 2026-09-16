import type { VertexId } from "@modeling-kit/core";
import { MeshBuilder } from "@modeling-kit/mesh";
import {
  assertQuadVertices,
  bucketCubeFace,
  cubeAtlasUv,
  cubeGridPosition,
  iterateCubeGridQuads,
  uniqueCubeGridVertex,
} from "./cube-surface";
import { markUvSeams } from "./library/seams";
import { addFace, emptyGroups, finalizePrimitive, integerAtLeast, positive, requireValid } from "./shared";
import type {
  PrimitiveGenerationContext,
  PrimitiveGenerator,
  PrimitiveResult,
  PrimitiveValidationResult,
  QuadSphereParameters,
} from "./types";

export const quadSphereDefaults: QuadSphereParameters = {
  radius: 0.5,
  segments: 4,
};

export function validateQuadSphereParameters(parameters: QuadSphereParameters): PrimitiveValidationResult {
  const errors: string[] = [];
  positive("radius", parameters.radius, errors);
  integerAtLeast("segments", parameters.segments, 1, errors);
  return { ok: errors.length === 0, errors };
}

export function generateQuadSphere(
  parameters: QuadSphereParameters = quadSphereDefaults,
  context: PrimitiveGenerationContext = {},
): PrimitiveResult {
  requireValid(validateQuadSphereParameters(parameters), "quadSphere");
  const n = parameters.segments;
  const radius = parameters.radius;
  const spec = { nx: n, ny: n, nz: n };
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
        const cube = cubeGridPosition(corner, spec, 1, 1, 1);
        const len = Math.hypot(cube[0], cube[1], cube[2]) || 1;
        return builder.addVertex((cube[0] / len) * radius, (cube[1] / len) * radius, (cube[2] / len) * radius);
      }),
    );
    assertQuadVertices(verts);
    const normals = verts.map((id) => {
      const p = builder.getMesh().vertices.get(id)!.position;
      const len = Math.hypot(p[0], p[1], p[2]) || 1;
      return [p[0] / len, p[1] / len, p[2] / len] as [number, number, number];
    });
    const uvs = quad.uvs.map(([u, v]) => cubeAtlasUv(quad.face, u, v));
    const id = addFace(builder, verts, uvs, { normals, isSmooth: true });
    bucketCubeFace(quad.face, id, top, bottom, front, back, sides);
  }

  const result = finalizePrimitive("quadSphere", builder, {
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

export const quadSpherePrimitive: PrimitiveGenerator<QuadSphereParameters> = {
  type: "quadSphere",
  defaults: quadSphereDefaults,
  validate: validateQuadSphereParameters,
  generate: generateQuadSphere,
};
