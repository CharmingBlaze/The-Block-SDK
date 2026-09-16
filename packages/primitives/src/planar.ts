import { MeshBuilder } from "@modeling-kit/mesh";
import {
  addFace,
  emptyGroups,
  finalizePrimitive,
  integerAtLeast,
  polarUv,
  positive,
  requireValid,
  ringPoint,
} from "./shared";
import type {
  DiscParameters,
  GridParameters,
  PlaneParameters,
  PrimitiveGenerationContext,
  PrimitiveGenerator,
  PrimitiveResult,
  PrimitiveValidationResult,
  QuadParameters,
} from "./types";

export const planeDefaults: PlaneParameters = { width: 1, depth: 1 };

export function validatePlaneParameters(parameters: PlaneParameters): PrimitiveValidationResult {
  const errors: string[] = [];
  positive("width", parameters.width, errors);
  positive("depth", parameters.depth, errors);
  return { ok: errors.length === 0, errors };
}

/** Single quad in the XZ plane, normal +Y, pivot at centre. */
export function generatePlane(
  parameters: PlaneParameters = planeDefaults,
  context: PrimitiveGenerationContext = {},
): PrimitiveResult {
  requireValid(validatePlaneParameters(parameters), "plane");
  const builder = new MeshBuilder(context.meshId);
  const hx = parameters.width / 2;
  const hz = parameters.depth / 2;
  const a = builder.addVertex(-hx, 0, -hz);
  const b = builder.addVertex(hx, 0, -hz);
  const c = builder.addVertex(hx, 0, hz);
  const d = builder.addVertex(-hx, 0, hz);
  const top = addFace(builder, [a, d, c, b], [
    [0, 0],
    [0, 1],
    [1, 1],
    [1, 0],
  ]);
  return finalizePrimitive("plane", builder, {
    ...emptyGroups(),
    top: [top],
  });
}

export const quadDefaults: QuadParameters = { scale: 1 };

export function validateQuadParameters(parameters: QuadParameters): PrimitiveValidationResult {
  const errors: string[] = [];
  positive("scale", parameters.scale, errors);
  return { ok: errors.length === 0, errors };
}

export function generateQuad(
  parameters: QuadParameters = quadDefaults,
  context: PrimitiveGenerationContext = {},
): PrimitiveResult {
  requireValid(validateQuadParameters(parameters), "quad");
  const result = generatePlane({ width: parameters.scale, depth: parameters.scale }, context);
  return { ...result, type: "quad" };
}

export const quadPrimitive: PrimitiveGenerator<QuadParameters> = {
  type: "quad",
  defaults: quadDefaults,
  validate: validateQuadParameters,
  generate: generateQuad,
};

export const planePrimitive: PrimitiveGenerator<PlaneParameters> = {
  type: "plane",
  defaults: planeDefaults,
  validate: validatePlaneParameters,
  generate: generatePlane,
};

export const gridDefaults: GridParameters = {
  width: 1,
  depth: 1,
  segmentsX: 2,
  segmentsZ: 2,
};

export function validateGridParameters(parameters: GridParameters): PrimitiveValidationResult {
  const errors: string[] = [];
  positive("width", parameters.width, errors);
  positive("depth", parameters.depth, errors);
  integerAtLeast("segmentsX", parameters.segmentsX, 1, errors);
  integerAtLeast("segmentsZ", parameters.segmentsZ, 1, errors);
  return { ok: errors.length === 0, errors };
}

/** Quad grid in the XZ plane, normal +Y, shared vertices, pivot at centre. */
export function generateGrid(
  parameters: GridParameters = gridDefaults,
  context: PrimitiveGenerationContext = {},
): PrimitiveResult {
  requireValid(validateGridParameters(parameters), "grid");
  const builder = new MeshBuilder(context.meshId);
  const hx = parameters.width / 2;
  const hz = parameters.depth / 2;
  const nx = parameters.segmentsX;
  const nz = parameters.segmentsZ;
  const verts: ReturnType<MeshBuilder["addVertex"]>[][] = [];
  for (let iz = 0; iz <= nz; iz++) {
    const row: ReturnType<MeshBuilder["addVertex"]>[] = [];
    const v = iz / nz;
    const z = -hz + parameters.depth * v;
    for (let ix = 0; ix <= nx; ix++) {
      const u = ix / nx;
      const x = -hx + parameters.width * u;
      row.push(builder.addVertex(x, 0, z));
    }
    verts.push(row);
  }
  const top: ReturnType<MeshBuilder["addFace"]>[] = [];
  for (let iz = 0; iz < nz; iz++) {
    for (let ix = 0; ix < nx; ix++) {
      const u0 = ix / nx;
      const u1 = (ix + 1) / nx;
      const v0 = iz / nz;
      const v1 = (iz + 1) / nz;
      top.push(
        addFace(
          builder,
          [verts[iz]![ix]!, verts[iz + 1]![ix]!, verts[iz + 1]![ix + 1]!, verts[iz]![ix + 1]!],
          [
            [u0, v0],
            [u0, v1],
            [u1, v1],
            [u1, v0],
          ],
        ),
      );
    }
  }
  return finalizePrimitive("grid", builder, { ...emptyGroups(), top });
}

export const gridPrimitive: PrimitiveGenerator<GridParameters> = {
  type: "grid",
  defaults: gridDefaults,
  validate: validateGridParameters,
  generate: generateGrid,
};

export const discDefaults: DiscParameters = { radius: 0.5, segments: 16 };

export function validateDiscParameters(parameters: DiscParameters): PrimitiveValidationResult {
  const errors: string[] = [];
  positive("radius", parameters.radius, errors);
  integerAtLeast("segments", parameters.segments, 3, errors);
  return { ok: errors.length === 0, errors };
}

/** Filled disc in XZ, normal +Y. Triangle fan from the centre so every face is planar and oriented. */
export function generateDisc(
  parameters: DiscParameters = discDefaults,
  context: PrimitiveGenerationContext = {},
): PrimitiveResult {
  requireValid(validateDiscParameters(parameters), "disc");
  const builder = new MeshBuilder(context.meshId);
  const n = parameters.segments;
  const center = builder.addVertex(0, 0, 0);
  const verts = Array.from({ length: n }, (_, i) => {
    const [x, y, z] = ringPoint(parameters.radius, i, n, 0);
    return builder.addVertex(x, y, z);
  });
  const top: ReturnType<MeshBuilder["addFace"]>[] = [];
  for (let i = 0; i < n; i++) {
    const i1 = (i + 1) % n;
    top.push(
      addFace(builder, [center, verts[i]!, verts[i1]!], [
        [0.5, 0.5],
        polarUv(i, n),
        polarUv(i1, n),
      ]),
    );
  }
  return finalizePrimitive("disc", builder, { ...emptyGroups(), top });
}

export const discPrimitive: PrimitiveGenerator<DiscParameters> = {
  type: "disc",
  defaults: discDefaults,
  validate: validateDiscParameters,
  generate: generateDisc,
};

/** Catalog alias of `generateDisc` for the `circle` primitive name. */
export const generateCircle = generateDisc;
export const circlePrimitive: PrimitiveGenerator<DiscParameters> = {
  type: "circle",
  defaults: discDefaults,
  validate: validateDiscParameters,
  generate: generateDisc,
};
