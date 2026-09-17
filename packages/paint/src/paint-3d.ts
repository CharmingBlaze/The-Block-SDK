import type { FaceId } from "@modeling-kit/core";
import { triangulateMesh, type HalfEdgeMesh } from "@modeling-kit/mesh";
import { getCornerUv } from "@modeling-kit/uv";
import type { TextureBuffer } from "./texture-buffer";
import { uvToPixel } from "./uv-mapper";
import { drawBrushDab } from "./rasterizer";
import { dilateSeamTexels } from "./dilate";
import type { PaintEngine } from "./engine";
import type { BrushOptions } from "./types";

export interface SurfaceHit {
  readonly faceId: FaceId;
  /** Full triangle weights in render-vertex order. Prefer this for viewport hits. */
  readonly barycentric?: { readonly x: number; readonly y: number; readonly z: number };
  /** @deprecated Pass `barycentric`; these are its second and third weights. */
  readonly u?: number;
  /** @deprecated Pass `barycentric`; these are its second and third weights. */
  readonly v?: number;
  /** Render-triangle index when the hit came from a triangulated viewport mesh. */
  readonly triangleIndex?: number;
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
  const [px, py] = resolveSurfaceHitPixel(mesh, hit, buffer.width, buffer.height);
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
  const [px, py] = resolveSurfaceHitPixel(mesh, hit, engine.buffer.width, engine.buffer.height);
  engine.dab(px, py, options);
  const dilation = options.seamDilation ?? DEFAULT_SEAM_DILATION;
  if (dilation > 0) {
    engine.dilateSeams(dilation);
  }
}

/** Resolve a viewport surface hit to the exact texture texel under the pointer. */
export function resolveSurfaceHitPixel(
  mesh: HalfEdgeMesh,
  hit: SurfaceHit,
  width: number,
  height: number,
): [number, number] {
  const weights = hit.barycentric
    ? [hit.barycentric.x, hit.barycentric.y, hit.barycentric.z] as const
    : [1 - (hit.u ?? 0) - (hit.v ?? 0), hit.u ?? 0, hit.v ?? 0] as const;
  if (hit.triangleIndex !== undefined) {
    const triangles = triangulateMesh(mesh);
    const offset = hit.triangleIndex * 3;
    const renderIndices = [
      triangles.indices[offset],
      triangles.indices[offset + 1],
      triangles.indices[offset + 2],
    ];
    const corners = renderIndices.map((index) =>
      index === undefined ? undefined : mesh.corners.get(triangles.cornerIdMap[index]!),
    );
    if (corners.every((corner) => corner?.uv)) {
      const hitU = corners.reduce((sum, corner, index) => sum + corner!.uv![0] * weights[index]!, 0);
      const hitV = corners.reduce((sum, corner, index) => sum + corner!.uv![1] * weights[index]!, 0);
      // Packed paint atlases occupy [0, 1]. Clamping preserves UV=1 at the
      // final texel instead of wrapping it to the opposite side of the image.
      return uvToPixel(hitU, hitV, width, height, "clamp");
    }
  }
  const [uu, vv] = interpolateFaceUv(mesh, hit.faceId, weights[1], weights[2]);
  return uvToPixel(uu, vv, width, height, "clamp");
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
