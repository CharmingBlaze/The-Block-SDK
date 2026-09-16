import { SchemaError, type FaceId, type VertexId } from "@modeling-kit/core";

export type CubeFace = "+x" | "-x" | "+y" | "-y" | "+z" | "-z";

export interface CubeGridSpec {
  readonly nx: number;
  readonly ny: number;
  readonly nz: number;
}

export interface CubeGridCorner {
  readonly ix: number;
  readonly iy: number;
  readonly iz: number;
}

export interface CubeGridQuad {
  readonly face: CubeFace;
  readonly corners: readonly [CubeGridCorner, CubeGridCorner, CubeGridCorner, CubeGridCorner];
  readonly uvs: readonly [[number, number], [number, number], [number, number], [number, number]];
}

export function cubeGridKey(corner: CubeGridCorner): string {
  return `${corner.ix},${corner.iy},${corner.iz}`;
}

export function cubeGridPosition(
  corner: CubeGridCorner,
  spec: CubeGridSpec,
  hx: number,
  hy: number,
  hz: number,
): [number, number, number] {
  return [
    spec.nx === 0 ? 0 : -hx + (2 * hx * corner.ix) / spec.nx,
    spec.ny === 0 ? 0 : -hy + (2 * hy * corner.iy) / spec.ny,
    spec.nz === 0 ? 0 : -hz + (2 * hz * corner.iz) / spec.nz,
  ];
}

export function iterateCubeGridQuads(spec: CubeGridSpec): CubeGridQuad[] {
  const { nx, ny, nz } = spec;
  const quads: CubeGridQuad[] = [];
  const push = (
    face: CubeFace,
    a: CubeGridCorner,
    b: CubeGridCorner,
    c: CubeGridCorner,
    d: CubeGridCorner,
    u0: number,
    u1: number,
    v0: number,
    v1: number,
  ): void => {
    quads.push({
      face,
      corners: [a, b, c, d],
      uvs: [
        [u0, v0],
        [u1, v0],
        [u1, v1],
        [u0, v1],
      ],
    });
  };

  for (let y = 0; y < ny; y++) {
    const v0 = y / ny;
    const v1 = (y + 1) / ny;
    for (let z = 0; z < nz; z++) {
      const u0 = z / nz;
      const u1 = (z + 1) / nz;
      push(
        "+x",
        { ix: nx, iy: y, iz: z + 1 },
        { ix: nx, iy: y, iz: z },
        { ix: nx, iy: y + 1, iz: z },
        { ix: nx, iy: y + 1, iz: z + 1 },
        u1,
        u0,
        v0,
        v1,
      );
      push(
        "-x",
        { ix: 0, iy: y, iz: z },
        { ix: 0, iy: y, iz: z + 1 },
        { ix: 0, iy: y + 1, iz: z + 1 },
        { ix: 0, iy: y + 1, iz: z },
        u0,
        u1,
        v0,
        v1,
      );
    }
  }

  for (let z = 0; z < nz; z++) {
    const v0 = z / nz;
    const v1 = (z + 1) / nz;
    for (let x = 0; x < nx; x++) {
      const u0 = x / nx;
      const u1 = (x + 1) / nx;
      push(
        "+y",
        { ix: x, iy: ny, iz: z + 1 },
        { ix: x + 1, iy: ny, iz: z + 1 },
        { ix: x + 1, iy: ny, iz: z },
        { ix: x, iy: ny, iz: z },
        u0,
        u1,
        v1,
        v0,
      );
      push(
        "-y",
        { ix: x, iy: 0, iz: z },
        { ix: x + 1, iy: 0, iz: z },
        { ix: x + 1, iy: 0, iz: z + 1 },
        { ix: x, iy: 0, iz: z + 1 },
        u0,
        u1,
        v0,
        v1,
      );
    }
  }

  for (let y = 0; y < ny; y++) {
    const v0 = y / ny;
    const v1 = (y + 1) / ny;
    for (let x = 0; x < nx; x++) {
      const u0 = x / nx;
      const u1 = (x + 1) / nx;
      push(
        "+z",
        { ix: x, iy: y, iz: nz },
        { ix: x + 1, iy: y, iz: nz },
        { ix: x + 1, iy: y + 1, iz: nz },
        { ix: x, iy: y + 1, iz: nz },
        u0,
        u1,
        v0,
        v1,
      );
      push(
        "-z",
        { ix: x + 1, iy: y, iz: 0 },
        { ix: x, iy: y, iz: 0 },
        { ix: x, iy: y + 1, iz: 0 },
        { ix: x + 1, iy: y + 1, iz: 0 },
        1 - u1,
        1 - u0,
        v0,
        v1,
      );
    }
  }

  return quads;
}

export function uniqueCubeGridVertex<T>(
  corner: CubeGridCorner,
  cache: Map<string, T>,
  create: () => T,
): T {
  const key = cubeGridKey(corner);
  const existing = cache.get(key);
  if (existing !== undefined) {
    return existing;
  }
  const created = create();
  cache.set(key, created);
  return created;
}

export function assertQuadVertices(vertices: readonly VertexId[]): void {
  if (new Set(vertices).size !== 4) {
    throw new SchemaError("canonical quad face must contain exactly four unique vertices");
  }
}

/** Packed 3×2 cube net in UV [0,1]². Bottom row +Z/−Z/−Y, top row +X/−X/+Y. */
export const CUBE_ATLAS_CELLS: Record<CubeFace, readonly [col: number, row: number]> = {
  "+x": [0, 1],
  "-x": [1, 1],
  "+y": [2, 1],
  "+z": [0, 0],
  "-z": [1, 0],
  "-y": [2, 0],
};

export function cubeAtlasUv(face: CubeFace, u: number, v: number): [number, number] {
  const [col, row] = CUBE_ATLAS_CELLS[face];
  return [(col + u) / 3, (row + v) / 2];
}

export function cubeAtlasIsland(face: CubeFace): number {
  const [col, row] = CUBE_ATLAS_CELLS[face];
  return row * 3 + col;
}

export function bucketCubeFace(
  face: CubeFace,
  id: FaceId,
  top: FaceId[],
  bottom: FaceId[],
  front: FaceId[],
  back: FaceId[],
  sides: FaceId[],
): void {
  if (face === "+y") {
    top.push(id);
  } else if (face === "-y") {
    bottom.push(id);
  } else if (face === "+z") {
    front.push(id);
  } else if (face === "-z") {
    back.push(id);
  } else {
    sides.push(id);
  }
}

