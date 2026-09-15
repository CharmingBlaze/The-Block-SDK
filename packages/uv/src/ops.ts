import type { CornerId, FaceId, VertexId } from "@modeling-kit/core";
import type { HalfEdgeMesh } from "@modeling-kit/mesh";
import { getCornerUv, setCornerUv } from "./corners";
import { findUvIslands } from "./islands";

export interface UvTransform {
  readonly translate?: readonly [number, number];
  readonly scale?: readonly [number, number];
  readonly rotateTurns?: number;
  readonly pivot?: readonly [number, number];
  readonly flipU?: boolean;
  readonly flipV?: boolean;
}

function targetCorners(mesh: HalfEdgeMesh, faceIds?: readonly FaceId[]) {
  const faces = faceIds ?? [...mesh.faces.keys()];
  return faces.flatMap((id) => mesh.getFaceCorners(id));
}

export function transformUvs(
  mesh: HalfEdgeMesh,
  transform: UvTransform,
  faceIds?: readonly FaceId[],
): void {
  const corners = targetCorners(mesh, faceIds);
  if (corners.length === 0) {
    return;
  }
  let pivotU = transform.pivot?.[0];
  let pivotV = transform.pivot?.[1];
  if (pivotU === undefined || pivotV === undefined) {
    let su = 0;
    let sv = 0;
    for (const id of corners) {
      const uv = getCornerUv(mesh, id);
      su += uv[0];
      sv += uv[1];
    }
    pivotU = su / corners.length;
    pivotV = sv / corners.length;
  }
  const angle = (transform.rotateTurns ?? 0) * Math.PI * 2;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const sx = transform.scale?.[0] ?? 1;
  const sy = transform.scale?.[1] ?? 1;
  const tx = transform.translate?.[0] ?? 0;
  const ty = transform.translate?.[1] ?? 0;
  for (const id of corners) {
    let [u, v] = getCornerUv(mesh, id);
    u -= pivotU;
    v -= pivotV;
    const ru = u * cos - v * sin;
    const rv = u * sin + v * cos;
    u = ru * sx + pivotU + tx;
    v = rv * sy + pivotV + ty;
    if (transform.flipU) {
      u = 1 - u;
    }
    if (transform.flipV) {
      v = 1 - v;
    }
    setCornerUv(mesh, id, [u, v]);
  }
}

export function resetUvs(mesh: HalfEdgeMesh, faceIds?: readonly FaceId[]): void {
  for (const id of targetCorners(mesh, faceIds)) {
    setCornerUv(mesh, id, [0, 0]);
  }
}

export function snapUvsToPixels(
  mesh: HalfEdgeMesh,
  width: number,
  height: number,
  faceIds?: readonly FaceId[],
): void {
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  for (const id of targetCorners(mesh, faceIds)) {
    const [u, v] = getCornerUv(mesh, id);
    setCornerUv(mesh, id, [Math.round(u * w) / w, Math.round(v * h) / h]);
  }
}

export function weldUvs(mesh: HalfEdgeMesh): void {
  const islands = findUvIslands(mesh);
  const faceIsland = new Map<string, number>();
  islands.forEach((island, index) => {
    for (const faceId of island.faceIds) {
      faceIsland.set(faceId, index);
    }
  });
  const groups = new Map<string, Array<{ cornerId: CornerId; u: number; v: number }>>();
  for (const corner of mesh.corners.values()) {
    const island = faceIsland.get(corner.faceId) ?? 0;
    const key = `${corner.vertexId}:${island}`;
    const uv = corner.uv ?? [0, 0];
    const list = groups.get(key) ?? [];
    list.push({ cornerId: corner.id, u: uv[0], v: uv[1] });
    groups.set(key, list);
  }
  for (const list of groups.values()) {
    if (list.length < 2) {
      continue;
    }
    const u = list.reduce((s, c) => s + c.u, 0) / list.length;
    const v = list.reduce((s, c) => s + c.v, 0) / list.length;
    for (const item of list) {
      setCornerUv(mesh, item.cornerId, [u, v]);
    }
  }
}

export function splitUvsAtVertex(mesh: HalfEdgeMesh, vertexId: VertexId): void {
  const corners = [...mesh.corners.values()].filter((c) => c.vertexId === vertexId);
  corners.forEach((corner, index) => {
    const uv = corner.uv ?? [0, 0];
    setCornerUv(mesh, corner.id, [uv[0] + index * 1e-4, uv[1]]);
  });
}

export function texelDensity(
  mesh: HalfEdgeMesh,
  textureWidth: number,
  textureHeight: number,
): number {
  let world = 0;
  let uvlen = 0;
  for (const faceId of mesh.faces.keys()) {
    const verts = mesh.getFaceVertices(faceId);
    const corners = mesh.getFaceCorners(faceId);
    const n = verts.length;
    for (let i = 0; i < n; i++) {
      const a = mesh.vertices.get(verts[i]!)!.position;
      const b = mesh.vertices.get(verts[(i + 1) % n]!)!.position;
      const uvA = getCornerUv(mesh, corners[i]!);
      const uvB = getCornerUv(mesh, corners[(i + 1) % n]!);
      world += Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
      uvlen += Math.hypot((uvA[0] - uvB[0]) * textureWidth, (uvA[1] - uvB[1]) * textureHeight);
    }
  }
  return world < 1e-8 ? 0 : uvlen / world;
}
