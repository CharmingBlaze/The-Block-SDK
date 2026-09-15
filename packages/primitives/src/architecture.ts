import type { VertexId } from "@modeling-kit/core";
import { MeshBuilder } from "@modeling-kit/mesh";
import {
  QUAD_UV,
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
  ArchParameters,
  ColumnParameters,
  PrimitiveGenerationContext,
  PrimitiveGenerator,
  PrimitiveResult,
  PrimitiveValidationResult,
  RampParameters,
  StairsParameters,
  WallParameters,
} from "./types";

export const rampDefaults: RampParameters = { width: 1, height: 1, depth: 1 };

export function validateRampParameters(parameters: RampParameters): PrimitiveValidationResult {
  const errors: string[] = [];
  positive("width", parameters.width, errors);
  positive("height", parameters.height, errors);
  positive("depth", parameters.depth, errors);
  return { ok: errors.length === 0, errors };
}

/** Closed triangular prism: bottom, vertical back, slope, two triangular sides. Pivot at centre. */
export function generateRamp(
  parameters: RampParameters = rampDefaults,
  context: PrimitiveGenerationContext = {},
): PrimitiveResult {
  requireValid(validateRampParameters(parameters), "ramp");
  const builder = new MeshBuilder(context.meshId);
  const hx = parameters.width / 2;
  const hy = parameters.height / 2;
  const hz = parameters.depth / 2;
  const l0 = builder.addVertex(-hx, -hy, hz);
  const l1 = builder.addVertex(-hx, -hy, -hz);
  const l2 = builder.addVertex(-hx, hy, -hz);
  const r0 = builder.addVertex(hx, -hy, hz);
  const r1 = builder.addVertex(hx, -hy, -hz);
  const r2 = builder.addVertex(hx, hy, -hz);
  const bottom = addFace(builder, [l1, r1, r0, l0], QUAD_UV);
  const back = addFace(builder, [l1, l2, r2, r1], QUAD_UV);
  const slope = addFace(builder, [l0, r0, r2, l2], QUAD_UV);
  const negX = addFace(builder, [l0, l2, l1], [
    [0, 0],
    [0.5, 1],
    [1, 0],
  ]);
  const posX = addFace(builder, [r0, r1, r2], [
    [0, 0],
    [1, 0],
    [0.5, 1],
  ]);
  return finalizePrimitive("ramp", builder, {
    ...emptyGroups(),
    top: [slope],
    bottom: [bottom],
    back: [back],
    sides: [negX, posX],
    caps: [bottom],
    posX,
    negX,
    negY: bottom,
    negZ: back,
  });
}

export const rampPrimitive: PrimitiveGenerator<RampParameters> = {
  type: "ramp",
  defaults: rampDefaults,
  validate: validateRampParameters,
  generate: generateRamp,
};

export const stairsDefaults: StairsParameters = {
  width: 1,
  height: 1,
  depth: 1,
  steps: 4,
};

export function validateStairsParameters(parameters: StairsParameters): PrimitiveValidationResult {
  const errors: string[] = [];
  positive("width", parameters.width, errors);
  positive("height", parameters.height, errors);
  positive("depth", parameters.depth, errors);
  integerAtLeast("steps", parameters.steps, 1, errors);
  return { ok: errors.length === 0, errors };
}

/** Closed stair hull (no internal faces). Origin at bottom centre; +Z is up-stair direction. */
export function generateStairs(
  parameters: StairsParameters = stairsDefaults,
  context: PrimitiveGenerationContext = {},
): PrimitiveResult {
  requireValid(validateStairsParameters(parameters), "stairs");
  const builder = new MeshBuilder(context.meshId);
  const n = parameters.steps;
  const w = parameters.width;
  const hx = w / 2;
  const stepH = parameters.height / n;
  const stepD = parameters.depth / n;
  const left: VertexId[] = [];
  const right: VertexId[] = [];
  const profile: [number, number][] = [[0, 0]];
  for (let i = 0; i < n; i++) {
    profile.push([i * stepD, (i + 1) * stepH]);
    profile.push([(i + 1) * stepD, (i + 1) * stepH]);
  }
  profile.push([parameters.depth, 0]);
  for (const [z, y] of profile) {
    left.push(builder.addVertex(-hx, y, z));
    right.push(builder.addVertex(hx, y, z));
  }
  const last = profile.length - 1;
  const leftReversed = [...left].reverse();
  const leftFace = addFace(
    builder,
    leftReversed,
    leftReversed.map((_, i) => [0, i / Math.max(1, last)] as [number, number]),
  );
  const rightFace = addFace(
    builder,
    right,
    right.map((_, i) => [1, i / Math.max(1, last)] as [number, number]),
  );
  const treads: ReturnType<MeshBuilder["addFace"]>[] = [];
  const risers: ReturnType<MeshBuilder["addFace"]>[] = [];
  let back: ReturnType<MeshBuilder["addFace"]> | undefined;
  let bottom: ReturnType<MeshBuilder["addFace"]> | undefined;
  for (let i = 0; i < profile.length; i++) {
    const i1 = (i + 1) % profile.length;
    const face = addFace(builder, [left[i]!, left[i1]!, right[i1]!, right[i]!], QUAD_UV);
    const [z0, y0] = profile[i]!;
    const [z1, y1] = profile[i1]!;
    if (Math.abs(y0 - y1) < 1e-9 && z1 > z0) {
      treads.push(face);
    } else if (Math.abs(z0 - z1) < 1e-9 && y1 > y0) {
      risers.push(face);
    } else if (Math.abs(z0 - z1) < 1e-9 && y1 < y0) {
      back = face;
    } else {
      bottom = face;
    }
  }
  return finalizePrimitive("stairs", builder, {
    ...emptyGroups(),
    top: treads,
    bottom: bottom ? [bottom] : [],
    front: risers,
    back: back ? [back] : [],
    sides: [leftFace, rightFace],
    caps: bottom ? [bottom] : [],
  });
}

export const stairsPrimitive: PrimitiveGenerator<StairsParameters> = {
  type: "stairs",
  defaults: stairsDefaults,
  validate: validateStairsParameters,
  generate: generateStairs,
};

export const archDefaults: ArchParameters = {
  innerRadius: 0.5,
  outerRadius: 1,
  depth: 0.5,
  segments: 12,
};

export function validateArchParameters(parameters: ArchParameters): PrimitiveValidationResult {
  const errors: string[] = [];
  positive("innerRadius", parameters.innerRadius, errors);
  positive("outerRadius", parameters.outerRadius, errors);
  positive("depth", parameters.depth, errors);
  integerAtLeast("segments", parameters.segments, 3, errors);
  if (parameters.outerRadius <= parameters.innerRadius) {
    errors.push("outerRadius must be greater than innerRadius");
  }
  return { ok: errors.length === 0, errors };
}

/** Closed semicircular arch sitting on y = 0, opening along X, thickness along Z. */
export function generateArch(
  parameters: ArchParameters = archDefaults,
  context: PrimitiveGenerationContext = {},
): PrimitiveResult {
  requireValid(validateArchParameters(parameters), "arch");
  const builder = new MeshBuilder(context.meshId);
  const n = parameters.segments;
  const hz = parameters.depth / 2;
  const profile: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const a = (Math.PI * i) / n;
    profile.push([Math.cos(a) * parameters.outerRadius, Math.sin(a) * parameters.outerRadius]);
  }
  for (let i = n; i >= 0; i--) {
    const a = (Math.PI * i) / n;
    profile.push([Math.cos(a) * parameters.innerRadius, Math.sin(a) * parameters.innerRadius]);
  }
  const front: VertexId[] = [];
  const back: VertexId[] = [];
  for (const [x, y] of profile) {
    front.push(builder.addVertex(x, y, hz));
    back.push(builder.addVertex(x, y, -hz));
  }
  const frontReversed = [...front].reverse();
  const frontFace = addFace(
    builder,
    frontReversed,
    frontReversed.map((_, i) => [i / Math.max(1, front.length - 1), 1] as [number, number]),
  );
  const backFace = addFace(
    builder,
    back,
    back.map((_, i) => [i / Math.max(1, back.length - 1), 0] as [number, number]),
  );
  const sides: ReturnType<MeshBuilder["addFace"]>[] = [];
  const feet: ReturnType<MeshBuilder["addFace"]>[] = [];
  for (let i = 0; i < profile.length; i++) {
    const i1 = (i + 1) % profile.length;
    const face = addFace(builder, [front[i]!, front[i1]!, back[i1]!, back[i]!], QUAD_UV);
    const [, y0] = profile[i]!;
    const [, y1] = profile[i1]!;
    if (y0 < 1e-6 && y1 < 1e-6) {
      feet.push(face);
    } else {
      sides.push(face);
    }
  }
  return finalizePrimitive("arch", builder, {
    ...emptyGroups(),
    front: [frontFace],
    back: [backFace],
    sides,
    bottom: feet,
    caps: feet,
    posZ: frontFace,
    negZ: backFace,
  });
}

export const archPrimitive: PrimitiveGenerator<ArchParameters> = {
  type: "arch",
  defaults: archDefaults,
  validate: validateArchParameters,
  generate: generateArch,
};

export const wallDefaults: WallParameters = { width: 2, height: 2, depth: 0.25 };

export function validateWallParameters(parameters: WallParameters): PrimitiveValidationResult {
  const errors: string[] = [];
  positive("width", parameters.width, errors);
  positive("height", parameters.height, errors);
  positive("depth", parameters.depth, errors);
  return { ok: errors.length === 0, errors };
}

/** Box with the floor at y = 0 (bottom centre pivot). */
export function generateWall(
  parameters: WallParameters = wallDefaults,
  context: PrimitiveGenerationContext = {},
): PrimitiveResult {
  requireValid(validateWallParameters(parameters), "wall");
  const builder = new MeshBuilder(context.meshId);
  const hx = parameters.width / 2;
  const h = parameters.height;
  const hz = parameters.depth / 2;
  const v0 = builder.addVertex(-hx, 0, hz);
  const v1 = builder.addVertex(hx, 0, hz);
  const v2 = builder.addVertex(hx, h, hz);
  const v3 = builder.addVertex(-hx, h, hz);
  const v4 = builder.addVertex(-hx, 0, -hz);
  const v5 = builder.addVertex(hx, 0, -hz);
  const v6 = builder.addVertex(hx, h, -hz);
  const v7 = builder.addVertex(-hx, h, -hz);
  const posZ = addFace(builder, [v0, v1, v2, v3], QUAD_UV);
  const negZ = addFace(builder, [v5, v4, v7, v6], QUAD_UV);
  const posY = addFace(builder, [v3, v2, v6, v7], QUAD_UV);
  const negY = addFace(builder, [v4, v5, v1, v0], QUAD_UV);
  const posX = addFace(builder, [v1, v5, v6, v2], QUAD_UV);
  const negX = addFace(builder, [v4, v0, v3, v7], QUAD_UV);
  return finalizePrimitive("wall", builder, {
    ...emptyGroups(),
    top: [posY],
    bottom: [negY],
    front: [posZ],
    back: [negZ],
    sides: [posX, negX, posZ, negZ],
    caps: [posY, negY],
    posX,
    negX,
    posY,
    negY,
    posZ,
    negZ,
  });
}

export const wallPrimitive: PrimitiveGenerator<WallParameters> = {
  type: "wall",
  defaults: wallDefaults,
  validate: validateWallParameters,
  generate: generateWall,
};

export const columnDefaults: ColumnParameters = {
  radius: 0.25,
  height: 2,
  radialSegments: 16,
};

export function validateColumnParameters(parameters: ColumnParameters): PrimitiveValidationResult {
  const errors: string[] = [];
  positive("radius", parameters.radius, errors);
  positive("height", parameters.height, errors);
  integerAtLeast("radialSegments", parameters.radialSegments, 3, errors);
  return { ok: errors.length === 0, errors };
}

/** Capped cylinder standing on y = 0. */
export function generateColumn(
  parameters: ColumnParameters = columnDefaults,
  context: PrimitiveGenerationContext = {},
): PrimitiveResult {
  requireValid(validateColumnParameters(parameters), "column");
  const builder = new MeshBuilder(context.meshId);
  const n = parameters.radialSegments;
  const h = parameters.height;
  const bottomRing = Array.from({ length: n }, (_, i) => {
    const [x, , z] = ringPoint(parameters.radius, i, n, 0);
    return builder.addVertex(x, 0, z);
  });
  const topRing = Array.from({ length: n }, (_, i) => {
    const [x, , z] = ringPoint(parameters.radius, i, n, h);
    return builder.addVertex(x, h, z);
  });
  const sides: ReturnType<MeshBuilder["addFace"]>[] = [];
  for (let i = 0; i < n; i++) {
    const i1 = (i + 1) % n;
    const u0 = i / n;
    const u1 = (i + 1) / n;
    sides.push(
      addFace(builder, [bottomRing[i]!, bottomRing[i1]!, topRing[i1]!, topRing[i]!], [
        [u0, 0],
        [u1, 0],
        [u1, 1],
        [u0, 1],
      ]),
    );
  }
  const top = addFace(
    builder,
    topRing,
    topRing.map((_, i) => polarUv(i, n)),
  );
  const bottomVerts = [...bottomRing].reverse();
  const bottom = addFace(
    builder,
    bottomVerts,
    bottomVerts.map((_, i) => polarUv((n - i) % n, n)),
  );
  return finalizePrimitive("column", builder, {
    ...emptyGroups(),
    top: [top],
    bottom: [bottom],
    sides,
    caps: [top, bottom],
  });
}

export const columnPrimitive: PrimitiveGenerator<ColumnParameters> = {
  type: "column",
  defaults: columnDefaults,
  validate: validateColumnParameters,
  generate: generateColumn,
};
