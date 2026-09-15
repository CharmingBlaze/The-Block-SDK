import type { VertexId } from "@modeling-kit/core";
import { MeshBuilder } from "@modeling-kit/mesh";
import {
  addFace,
  emptyGroups,
  finalizePrimitive,
  integerAtLeast,
  markEdgeSeam,
  positive,
  requireValid,
  sphericalUv,
  unwrapSeamUvs,
} from "./shared";
import type {
  IcosphereParameters,
  PrimitiveGenerationContext,
  PrimitiveGenerator,
  PrimitiveResult,
  PrimitiveValidationResult,
  TorusParameters,
  UvSphereParameters,
} from "./types";

export const uvSphereDefaults: UvSphereParameters = {
  radius: 0.5,
  widthSegments: 16,
  heightSegments: 12,
};

export function validateUvSphereParameters(parameters: UvSphereParameters): PrimitiveValidationResult {
  const errors: string[] = [];
  positive("radius", parameters.radius, errors);
  integerAtLeast("widthSegments", parameters.widthSegments, 3, errors);
  integerAtLeast("heightSegments", parameters.heightSegments, 2, errors);
  return { ok: errors.length === 0, errors };
}

export function generateUvSphere(
  parameters: UvSphereParameters = uvSphereDefaults,
  context: PrimitiveGenerationContext = {},
): PrimitiveResult {
  requireValid(validateUvSphereParameters(parameters), "uvSphere");
  const builder = new MeshBuilder(context.meshId);
  const r = parameters.radius;
  const slices = parameters.widthSegments;
  const stacks = parameters.heightSegments;
  const north = builder.addVertex(0, r, 0);
  const rings: VertexId[][] = [];
  for (let s = 1; s < stacks; s++) {
    const phi = (Math.PI * s) / stacks;
    const y = Math.cos(phi) * r;
    const ringR = Math.sin(phi) * r;
    rings.push(
      Array.from({ length: slices }, (_, i) => {
        const theta = (2 * Math.PI * i) / slices;
        const x = Math.sin(theta) * ringR;
        const z = Math.cos(theta) * ringR;
        return builder.addVertex(x, y, z);
      }),
    );
  }
  const south = builder.addVertex(0, -r, 0);
  const sides: ReturnType<MeshBuilder["addFace"]>[] = [];
  const first = rings[0]!;
  for (let i = 0; i < slices; i++) {
    const i1 = (i + 1) % slices;
    sides.push(
      addFace(builder, [north, first[i1]!, first[i]!], sphereFaceUv(builder, [north, first[i1]!, first[i]!])),
    );
  }
  for (let s = 0; s < rings.length - 1; s++) {
    const a = rings[s]!;
    const b = rings[s + 1]!;
    for (let i = 0; i < slices; i++) {
      const i1 = (i + 1) % slices;
      const verts = [a[i]!, a[i1]!, b[i1]!, b[i]!];
      sides.push(addFace(builder, verts, sphereFaceUv(builder, verts)));
    }
  }
  const last = rings[rings.length - 1]!;
  for (let i = 0; i < slices; i++) {
    const i1 = (i + 1) % slices;
    sides.push(
      addFace(builder, [last[i]!, last[i1]!, south], sphereFaceUv(builder, [last[i]!, last[i1]!, south])),
    );
  }
  const result = finalizePrimitive("uvSphere", builder, { ...emptyGroups(), sides });
  for (const ring of rings) {
    markEdgeSeam(result.mesh, ring[0]!, ring[slices - 1]!);
  }
  return result;
}

export const uvSpherePrimitive: PrimitiveGenerator<UvSphereParameters> = {
  type: "uvSphere",
  defaults: uvSphereDefaults,
  validate: validateUvSphereParameters,
  generate: generateUvSphere,
};

export const icosphereDefaults: IcosphereParameters = { radius: 0.5, subdivisions: 1 };

export function validateIcosphereParameters(parameters: IcosphereParameters): PrimitiveValidationResult {
  const errors: string[] = [];
  positive("radius", parameters.radius, errors);
  integerAtLeast("subdivisions", parameters.subdivisions, 0, errors);
  if (parameters.subdivisions > 6) {
    errors.push("subdivisions must be <= 6");
  }
  return { ok: errors.length === 0, errors };
}

export function generateIcosphere(
  parameters: IcosphereParameters = icosphereDefaults,
  context: PrimitiveGenerationContext = {},
): PrimitiveResult {
  requireValid(validateIcosphereParameters(parameters), "icosphere");
  const builder = new MeshBuilder(context.meshId);
  const r = parameters.radius;
  const t = (1 + Math.sqrt(5)) / 2;
  const raw: [number, number, number][] = [
    [-1, t, 0],
    [1, t, 0],
    [-1, -t, 0],
    [1, -t, 0],
    [0, -1, t],
    [0, 1, t],
    [0, -1, -t],
    [0, 1, -t],
    [t, 0, -1],
    [t, 0, 1],
    [-t, 0, -1],
    [-t, 0, 1],
  ];
  const verts = raw.map((p) => project(p, r));
  let faces: [number, number, number][] = [
    [0, 11, 5],
    [0, 5, 1],
    [0, 1, 7],
    [0, 7, 10],
    [0, 10, 11],
    [1, 5, 9],
    [5, 11, 4],
    [11, 10, 2],
    [10, 7, 6],
    [7, 1, 8],
    [3, 9, 4],
    [3, 4, 2],
    [3, 2, 6],
    [3, 6, 8],
    [3, 8, 9],
    [4, 9, 5],
    [2, 4, 11],
    [6, 2, 10],
    [8, 6, 7],
    [9, 8, 1],
  ];
  for (let i = 0; i < parameters.subdivisions; i++) {
    const next: [number, number, number][] = [];
    const cache = new Map<string, number>();
    const midpoint = (a: number, b: number): number => {
      const key = a < b ? `${a}:${b}` : `${b}:${a}`;
      const existing = cache.get(key);
      if (existing !== undefined) {
        return existing;
      }
      const pa = verts[a]!;
      const pb = verts[b]!;
      const index = verts.length;
      verts.push(project([(pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2, (pa[2] + pb[2]) / 2], r));
      cache.set(key, index);
      return index;
    };
    for (const [a, b, c] of faces) {
      const ab = midpoint(a, b);
      const bc = midpoint(b, c);
      const ca = midpoint(c, a);
      next.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]);
    }
    faces = next;
  }
  const ids = verts.map((p) => builder.addVertex(p[0], p[1], p[2]));
  const sides = faces.map(([a, b, c]) => {
    const tri = [ids[a]!, ids[b]!, ids[c]!];
    return addFace(builder, tri, sphereFaceUv(builder, tri));
  });
  return finalizePrimitive("icosphere", builder, { ...emptyGroups(), sides });
}

export const icospherePrimitive: PrimitiveGenerator<IcosphereParameters> = {
  type: "icosphere",
  defaults: icosphereDefaults,
  validate: validateIcosphereParameters,
  generate: generateIcosphere,
};

export const torusDefaults: TorusParameters = {
  radius: 0.5,
  tube: 0.2,
  radialSegments: 12,
  tubularSegments: 24,
};

export function validateTorusParameters(parameters: TorusParameters): PrimitiveValidationResult {
  const errors: string[] = [];
  positive("radius", parameters.radius, errors);
  positive("tube", parameters.tube, errors);
  integerAtLeast("radialSegments", parameters.radialSegments, 3, errors);
  integerAtLeast("tubularSegments", parameters.tubularSegments, 3, errors);
  return { ok: errors.length === 0, errors };
}

export function generateTorus(
  parameters: TorusParameters = torusDefaults,
  context: PrimitiveGenerationContext = {},
): PrimitiveResult {
  requireValid(validateTorusParameters(parameters), "torus");
  const builder = new MeshBuilder(context.meshId);
  const R = parameters.radius;
  const r = parameters.tube;
  const rs = parameters.radialSegments;
  const ts = parameters.tubularSegments;
  const grid: VertexId[][] = [];
  for (let j = 0; j < ts; j++) {
    const v = (2 * Math.PI * j) / ts;
    const row: VertexId[] = [];
    for (let i = 0; i < rs; i++) {
      const u = (2 * Math.PI * i) / rs;
      const x = (R + r * Math.cos(u)) * Math.cos(v);
      const y = r * Math.sin(u);
      const z = (R + r * Math.cos(u)) * Math.sin(v);
      row.push(builder.addVertex(x, y, z));
    }
    grid.push(row);
  }
  const sides: ReturnType<MeshBuilder["addFace"]>[] = [];
  for (let j = 0; j < ts; j++) {
    const j1 = (j + 1) % ts;
    const v0 = j / ts;
    const v1 = (j + 1) / ts;
    for (let i = 0; i < rs; i++) {
      const i1 = (i + 1) % rs;
      const u0 = i / rs;
      const u1 = (i + 1) / rs;
      sides.push(
        addFace(builder, [grid[j]![i]!, grid[j]![i1]!, grid[j1]![i1]!, grid[j1]![i]!], [
          [u0, v0],
          [u1, v0],
          [u1, v1],
          [u0, v1],
        ]),
      );
    }
  }
  return finalizePrimitive("torus", builder, { ...emptyGroups(), sides });
}

export const torusPrimitive: PrimitiveGenerator<TorusParameters> = {
  type: "torus",
  defaults: torusDefaults,
  validate: validateTorusParameters,
  generate: generateTorus,
};

function project(p: [number, number, number], radius: number): [number, number, number] {
  const len = Math.hypot(p[0], p[1], p[2]) || 1;
  return [(p[0] / len) * radius, (p[1] / len) * radius, (p[2] / len) * radius];
}

function sphereFaceUv(builder: MeshBuilder, verts: readonly VertexId[]): [number, number][] {
  const uvs = verts.map((id) => {
    const p = builder.getMesh().vertices.get(id)!.position;
    return sphericalUv(p[0], p[1], p[2]);
  });
  return unwrapSeamUvs(uvs);
}
