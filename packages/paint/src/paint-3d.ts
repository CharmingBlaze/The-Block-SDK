import type { FaceId } from "@modeling-kit/core";
import type { HalfEdgeMesh } from "@modeling-kit/mesh";
import { getCornerUv } from "@modeling-kit/uv";
import type { TextureBuffer } from "./texture-buffer";
import { uvToPixel } from "./uv-mapper";
import { drawBrushDab } from "./rasterizer";
import { dilateSeamTexels } from "./dilate";
import type { PaintEngine } from "./engine";
import type { BrushOptions } from "./types";

export interface SurfaceHit {
  readonly faceId: FaceId;
  readonly u: number;
  readonly v: number;
}

export function interpolateFaceUv(mesh: HalfEdgeMesh, faceId: FaceId, u: number, v: number): [number, number] {
  const corners = mesh.getFaceCorners(faceId);
  if (corners.length === 0) {
    return [0, 0];
  }
  const uv0 = getCornerUv(mesh, corners[0]!);
  if (corners.length === 1) {
    return uv0;
  }
  const uv1 = getCornerUv(mesh, corners[1]!);
  const uvLast = getCornerUv(mesh, corners[corners.length - 1]!);
  const w = 1 - u - v;
  return [uv0[0] * w + uv1[0] * u + uvLast[0] * v, uv0[1] * w + uv1[1] * u + uvLast[1] * v];
}

const DEFAULT_SEAM_DILATION = 2;

export function paintSurfaceHit(
  mesh: HalfEdgeMesh,
  hit: SurfaceHit,
  buffer: TextureBuffer,
  options: BrushOptions,
): void {
  const [px, py] = surfaceHitPixel(mesh, hit, buffer.width, buffer.height);
  drawBrushDab(buffer, px, py, options);
  const dilation = options.seamDilation ?? DEFAULT_SEAM_DILATION;
  if (dilation > 0) {
    dilateSeamTexels(buffer, dilation);
  }
}

export function paintSurfaceHitOnStroke(
  mesh: HalfEdgeMesh,
  hit: SurfaceHit,
  engine: PaintEngine,
  options: BrushOptions,
): void {
  const [px, py] = surfaceHitPixel(mesh, hit, engine.buffer.width, engine.buffer.height);
  engine.dab(px, py, options);
  const dilation = options.seamDilation ?? DEFAULT_SEAM_DILATION;
  if (dilation > 0) {
    engine.dilateSeams(dilation);
  }
}

function surfaceHitPixel(
  mesh: HalfEdgeMesh,
  hit: SurfaceHit,
  width: number,
  height: number,
): [number, number] {
  const [uu, vv] = interpolateFaceUv(mesh, hit.faceId, hit.u, hit.v);
  return uvToPixel(uu, vv, width, height, "repeat");
}

export function resolveHitMaterialSlot(
  mesh: HalfEdgeMesh,
  faceId: FaceId,
): { materialSlot: number; materialSlotId: string | null } {
  const face = mesh.faces.get(faceId);
  return {
    materialSlot: face?.materialSlot ?? 0,
    materialSlotId: face?.materialSlotId ?? null,
  };
}
