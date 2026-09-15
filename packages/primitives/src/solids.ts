import type { VertexId } from "@modeling-kit/core";
import { MeshBuilder } from "@modeling-kit/mesh";
import {
  QUAD_UV,
  addFace,
  emptyGroups,
  finalizePrimitive,
  integerAtLeast,
  markEdgeSeam,
  polarUv,
  positive,
  requireValid,
  ringPoint,
} from "./shared";
import type {
  CapsuleParameters,
  ConeParameters,
  CylinderParameters,
  PrimitiveFaceGroups,
  PrimitiveGenerationContext,
  PrimitiveGenerator,
  PrimitiveResult,
  PrimitiveValidationResult,
  PyramidParameters,
} from "./types";

export const cylinderDefaults: CylinderParameters = {
  radius: 0.5,
  height: 1,
  radialSegments: 16,
  heightSegments: 1,
  capTop: true,
  capBottom: true,
};

export function validateCylinderParameters(parameters: CylinderParameters): PrimitiveValidationResult {
  const errors: string[] = [];
  positive("radius", parameters.radius, errors);
  positive("height", parameters.height, errors);
  integerAtLeast("radialSegments", parameters.radialSegments, 3, errors);
  integerAtLeast("heightSegments", parameters.heightSegments, 1, errors);
  return { ok: errors.length === 0, errors };
}

export function generateCylinder(
  parameters: CylinderParameters = cylinderDefaults,
  context: PrimitiveGenerationContext = {},
): PrimitiveResult {
  requireValid(validateCylinderParameters(parameters), "cylinder");
  const builder = new MeshBuilder(context.meshId);
  const n = parameters.radialSegments;
  const stacks = parameters.heightSegments;
  const hy = parameters.height / 2;
  const rings: VertexId[][] = [];
  for (let s = 0; s <= stacks; s++) {
    const y = -hy + (parameters.height * s) / stacks;
    rings.push(
      Array.from({ length: n }, (_, i) => {
        const [x, , z] = ringPoint(parameters.radius, i, n, y);
        return builder.addVertex(x, y, z);
      }),
    );
  }
  const sides = addTubeSides(builder, rings, true);
  const caps: ReturnType<MeshBuilder["addFace"]>[] = [];
  const top: ReturnType<MeshBuilder["addFace"]>[] = [];
  const bottom: ReturnType<MeshBuilder["addFace"]>[] = [];
  const topRing = rings[stacks]!;
  const bottomRing = rings[0]!;
  if (parameters.capTop) {
    const face = addFace(
      builder,
      topRing,
      topRing.map((_, i) => polarUv(i, n)),
    );
    caps.push(face);
    top.push(face);
  }
  if (parameters.capBottom) {
    const verts = [...bottomRing].reverse();
    const uvs = verts.map((_, i) => polarUv((n - i) % n, n));
    const face = addFace(builder, verts, uvs);
    caps.push(face);
    bottom.push(face);
  }
  const result = finalizePrimitive("cylinder", builder, {
    ...emptyGroups(),
    top,
    bottom,
    sides,
    caps,
  });
  for (let s = 0; s <= stacks; s++) {
    markEdgeSeam(result.mesh, rings[s]![0]!, rings[s]![n - 1]!);
  }
  return result;
}

export const cylinderPrimitive: PrimitiveGenerator<CylinderParameters> = {
  type: "cylinder",
  defaults: cylinderDefaults,
  validate: validateCylinderParameters,
  generate: generateCylinder,
};

export const coneDefaults: ConeParameters = {
  radius: 0.5,
  height: 1,
  radialSegments: 16,
  heightSegments: 1,
  capBottom: true,
};

export function validateConeParameters(parameters: ConeParameters): PrimitiveValidationResult {
  const errors: string[] = [];
  positive("radius", parameters.radius, errors);
  positive("height", parameters.height, errors);
  integerAtLeast("radialSegments", parameters.radialSegments, 3, errors);
  integerAtLeast("heightSegments", parameters.heightSegments, 1, errors);
  return { ok: errors.length === 0, errors };
}

export function generateCone(
  parameters: ConeParameters = coneDefaults,
  context: PrimitiveGenerationContext = {},
): PrimitiveResult {
  requireValid(validateConeParameters(parameters), "cone");
  const builder = new MeshBuilder(context.meshId);
  const n = parameters.radialSegments;
  const stacks = parameters.heightSegments;
  const hy = parameters.height / 2;
  const apex = builder.addVertex(0, hy, 0);
  const rings: VertexId[][] = [];
  for (let s = 1; s <= stacks; s++) {
    const t = s / stacks;
    const y = hy - parameters.height * t;
    const radius = parameters.radius * t;
    rings.push(
      Array.from({ length: n }, (_, i) => {
        const [x, , z] = ringPoint(radius, i, n, y);
        return builder.addVertex(x, y, z);
      }),
    );
  }
  const sides: ReturnType<MeshBuilder["addFace"]>[] = [];
  const first = rings[0]!;
  for (let i = 0; i < n; i++) {
    const i1 = (i + 1) % n;
    const u0 = i / n;
    const u1 = (i + 1) / n;
    sides.push(
      addFace(builder, [apex, first[i]!, first[i1]!], [
        [0.5, 1],
        [u0, 1 - 1 / stacks],
        [u1, 1 - 1 / stacks],
      ]),
    );
  }
  if (rings.length > 1) {
    sides.push(...addTubeSides(builder, rings, true));
  }
  const caps: ReturnType<MeshBuilder["addFace"]>[] = [];
  const bottom: ReturnType<MeshBuilder["addFace"]>[] = [];
  if (parameters.capBottom) {
    const base = rings[rings.length - 1]!;
    const verts = [...base].reverse();
    const face = addFace(
      builder,
      verts,
      verts.map((_, i) => polarUv((n - i) % n, n)),
    );
    caps.push(face);
    bottom.push(face);
  }
  const result = finalizePrimitive("cone", builder, {
    ...emptyGroups(),
    bottom,
    sides,
    caps,
  });
  for (const ring of rings) {
    markEdgeSeam(result.mesh, ring[0]!, ring[n - 1]!);
  }
  return result;
}

export const conePrimitive: PrimitiveGenerator<ConeParameters> = {
  type: "cone",
  defaults: coneDefaults,
  validate: validateConeParameters,
  generate: generateCone,
};

export const pyramidDefaults: PyramidParameters = { width: 1, depth: 1, height: 1 };

export function validatePyramidParameters(parameters: PyramidParameters): PrimitiveValidationResult {
  const errors: string[] = [];
  positive("width", parameters.width, errors);
  positive("depth", parameters.depth, errors);
  positive("height", parameters.height, errors);
  return { ok: errors.length === 0, errors };
}

export function generatePyramid(
  parameters: PyramidParameters = pyramidDefaults,
  context: PrimitiveGenerationContext = {},
): PrimitiveResult {
  requireValid(validatePyramidParameters(parameters), "pyramid");
  const builder = new MeshBuilder(context.meshId);
  const hx = parameters.width / 2;
  const hy = parameters.height / 2;
  const hz = parameters.depth / 2;
  const apex = builder.addVertex(0, hy, 0);
  const b0 = builder.addVertex(-hx, -hy, hz);
  const b1 = builder.addVertex(hx, -hy, hz);
  const b2 = builder.addVertex(hx, -hy, -hz);
  const b3 = builder.addVertex(-hx, -hy, -hz);
  const front = addFace(builder, [apex, b0, b1], [
    [0.5, 1],
    [0, 0],
    [1, 0],
  ]);
  const posX = addFace(builder, [apex, b1, b2], [
    [0.5, 1],
    [0, 0],
    [1, 0],
  ]);
  const back = addFace(builder, [apex, b2, b3], [
    [0.5, 1],
    [0, 0],
    [1, 0],
  ]);
  const negX = addFace(builder, [apex, b3, b0], [
    [0.5, 1],
    [0, 0],
    [1, 0],
  ]);
  const bottom = addFace(builder, [b3, b2, b1, b0], QUAD_UV);
  return finalizePrimitive("pyramid", builder, {
    ...emptyGroups(),
    bottom: [bottom],
    front: [front],
    back: [back],
    sides: [front, posX, back, negX],
    caps: [bottom],
    posX,
    negX,
    posZ: front,
    negZ: back,
    negY: bottom,
  });
}

export const pyramidPrimitive: PrimitiveGenerator<PyramidParameters> = {
  type: "pyramid",
  defaults: pyramidDefaults,
  validate: validatePyramidParameters,
  generate: generatePyramid,
};

export const capsuleDefaults: CapsuleParameters = {
  radius: 0.5,
  height: 1,
  radialSegments: 16,
  capSegments: 8,
  heightSegments: 1,
};

export function validateCapsuleParameters(parameters: CapsuleParameters): PrimitiveValidationResult {
  const errors: string[] = [];
  positive("radius", parameters.radius, errors);
  positive("height", parameters.height, errors);
  integerAtLeast("radialSegments", parameters.radialSegments, 3, errors);
  integerAtLeast("capSegments", parameters.capSegments, 1, errors);
  integerAtLeast("heightSegments", parameters.heightSegments, 1, errors);
  return { ok: errors.length === 0, errors };
}

/**
 * Capsule: cylindrical mid-section of `height` plus hemispherical caps of `radius`.
 * Total Y extent is height + 2 * radius. Pivot at centre. Shared vertices, corner UVs.
 */
export function generateCapsule(
  parameters: CapsuleParameters = capsuleDefaults,
  context: PrimitiveGenerationContext = {},
): PrimitiveResult {
  requireValid(validateCapsuleParameters(parameters), "capsule");
  const builder = new MeshBuilder(context.meshId);
  const n = parameters.radialSegments;
  const r = parameters.radius;
  const half = parameters.height / 2;
  const rings: VertexId[][] = [];
  const north = builder.addVertex(0, half + r, 0);
  for (let s = 1; s <= parameters.capSegments; s++) {
    const phi = (Math.PI / 2) * (s / parameters.capSegments);
    const ringR = Math.sin(phi) * r;
    const y = half + Math.cos(phi) * r;
    rings.push(addYRing(builder, ringR, n, y));
  }
  for (let s = 1; s < parameters.heightSegments; s++) {
    const y = half - (parameters.height * s) / parameters.heightSegments;
    rings.push(addYRing(builder, r, n, y));
  }
  const equatorBottom = addYRing(builder, r, n, -half);
  rings.push(equatorBottom);
  for (let s = 1; s < parameters.capSegments; s++) {
    const phi = Math.PI / 2 + (Math.PI / 2) * (s / parameters.capSegments);
    const ringR = Math.sin(phi) * r;
    const y = -half + Math.cos(phi) * r;
    rings.push(addYRing(builder, ringR, n, y));
  }
  const south = builder.addVertex(0, -(half + r), 0);

  const sides: ReturnType<MeshBuilder["addFace"]>[] = [];
  const firstRing = rings[0]!;
  const vSpan = rings.length + 1;
  for (let i = 0; i < n; i++) {
    const i1 = (i + 1) % n;
    const u0 = i / n;
    const u1 = (i + 1) / n;
    sides.push(
      addFace(builder, [north, firstRing[i1]!, firstRing[i]!], [
        [0.5, 1],
        [u1, 1 - 1 / vSpan],
        [u0, 1 - 1 / vSpan],
      ]),
    );
  }
  sides.push(...addTubeSides(builder, rings, true));
  const last = rings[rings.length - 1]!;
  for (let i = 0; i < n; i++) {
    const i1 = (i + 1) % n;
    const u0 = i / n;
    const u1 = (i + 1) / n;
    sides.push(
      addFace(builder, [last[i]!, last[i1]!, south], [
        [u0, 1 / vSpan],
        [u1, 1 / vSpan],
        [0.5, 0],
      ]),
    );
  }

  const groups: PrimitiveFaceGroups = { ...emptyGroups(), sides };
  const result = finalizePrimitive("capsule", builder, groups);
  for (const ring of rings) {
    markEdgeSeam(result.mesh, ring[0]!, ring[n - 1]!);
  }
  return result;
}

export const capsulePrimitive: PrimitiveGenerator<CapsuleParameters> = {
  type: "capsule",
  defaults: capsuleDefaults,
  validate: validateCapsuleParameters,
  generate: generateCapsule,
};

function addYRing(builder: MeshBuilder, radius: number, count: number, y: number): VertexId[] {
  return Array.from({ length: count }, (_, i) => {
    const [x, , z] = ringPoint(radius, i, count, y);
    return builder.addVertex(x, y, z);
  });
}

function addTubeSides(
  builder: MeshBuilder,
  rings: readonly VertexId[][],
  seamUv: boolean,
): ReturnType<MeshBuilder["addFace"]>[] {
  const faces: ReturnType<MeshBuilder["addFace"]>[] = [];
  const n = rings[0]?.length ?? 0;
  for (let s = 0; s < rings.length - 1; s++) {
    const lower = rings[s]!;
    const upper = rings[s + 1]!;
    const v0 = s / (rings.length - 1);
    const v1 = (s + 1) / (rings.length - 1);
    for (let i = 0; i < n; i++) {
      const i1 = (i + 1) % n;
      const u0 = i / n;
      const u1 = seamUv ? (i + 1) / n : i1 / n;
      faces.push(
        addFace(builder, [lower[i]!, lower[i1]!, upper[i1]!, upper[i]!], [
          [u0, v0],
          [u1, v0],
          [u1, v1],
          [u0, v1],
        ]),
      );
    }
  }
  return faces;
}
