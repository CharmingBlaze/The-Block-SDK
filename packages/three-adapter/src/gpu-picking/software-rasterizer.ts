import type { PickBackfaceMode } from "@modeling-kit/selection";
import { Vector3, type Camera } from "three";
import { GPU_PICK_BACKGROUND_ID } from "./encode";
import {
  barycentric,
  isInClipRange,
  matrixWorldDet,
  ndcToPixelX,
  ndcToPixelY,
  signedArea,
} from "./raster-math";
import type { GpuPickDrawable } from "./types";

const a = new Vector3();
const b = new Vector3();
const c = new Vector3();

export interface SoftwarePickHit {
  readonly pickId: number;
  readonly depth: number;
}

export type PickIdLookup = (drawable: GpuPickDrawable, triangleIndex: number) => number | undefined;

/**
 * Screen-space ID-buffer coverage. Uses the same camera projection and
 * triangle-to-face mapping as the GPU pass. Test/readback aid only — production
 * fallback is CPU raycasting when WebGL is unavailable.
 */
export function softwarePickAtPixel(
  drawables: readonly GpuPickDrawable[],
  lookup: PickIdLookup,
  camera: Camera,
  pixelX: number,
  pixelY: number,
  viewportWidth: number,
  viewportHeight: number,
  backfaceMode: PickBackfaceMode,
): SoftwarePickHit | undefined {
  const sampleX = pixelX + 0.5;
  const sampleY = pixelY + 0.5;
  let best: SoftwarePickHit | undefined;

  for (const drawable of drawables) {
    if (!drawable.visible || !drawable.selectable) {
      continue;
    }
    const position = drawable.geometry.getAttribute("position");
    const index = drawable.geometry.getIndex();
    if (!position) {
      continue;
    }
    const triangleCount = drawable.mapping.triangleToFace.length;
    const det = matrixWorldDet(drawable.matrixWorld);

    for (let t = 0; t < triangleCount; t += 1) {
      const pickId = lookup(drawable, t);
      if (pickId === undefined || pickId === GPU_PICK_BACKGROUND_ID) {
        continue;
      }
      const i0 = index ? index.getX(t * 3) : t * 3;
      const i1 = index ? index.getX(t * 3 + 1) : t * 3 + 1;
      const i2 = index ? index.getX(t * 3 + 2) : t * 3 + 2;
      a.fromBufferAttribute(position, i0).applyMatrix4(drawable.matrixWorld).project(camera);
      b.fromBufferAttribute(position, i1).applyMatrix4(drawable.matrixWorld).project(camera);
      c.fromBufferAttribute(position, i2).applyMatrix4(drawable.matrixWorld).project(camera);
      if (!isInClipRange(a) && !isInClipRange(b) && !isInClipRange(c)) {
        continue;
      }

      const ax = ndcToPixelX(a.x, viewportWidth);
      const ay = ndcToPixelY(a.y, viewportHeight);
      const bx = ndcToPixelX(b.x, viewportWidth);
      const by = ndcToPixelY(b.y, viewportHeight);
      const cx = ndcToPixelX(c.x, viewportWidth);
      const cy = ndcToPixelY(c.y, viewportHeight);
      const area = signedArea(ax, ay, bx, by, cx, cy);
      const front = area * det >= 0;
      if (backfaceMode === "front-only" && !front) {
        continue;
      }

      const bary = barycentric(sampleX, sampleY, ax, ay, bx, by, cx, cy);
      if (!bary) {
        continue;
      }
      const depth = a.z * bary.u + b.z * bary.v + c.z * bary.w;
      if (depth < -1 || depth > 1) {
        continue;
      }
      if (best && depth >= best.depth) {
        continue;
      }
      best = { pickId, depth };
    }
  }

  return best;
}
