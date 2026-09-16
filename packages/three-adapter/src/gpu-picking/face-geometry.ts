import type { FaceId } from "@modeling-kit/core";
import { BufferAttribute, BufferGeometry } from "three";
import type { RenderMapping } from "../geometry";
import { pickIdToUnitRgb } from "./encode";
import type { GpuPickRecord } from "./registry";

export function createFacePickingGeometry(
  source: BufferGeometry,
  mapping: RenderMapping,
  allocate: (triangleIndex: number, faceId: FaceId) => number,
): BufferGeometry {
  const position = source.getAttribute("position");
  if (!position) {
    throw new Error("Derived geometry is missing position for GPU face picking");
  }
  const index = source.getIndex();
  const triangleCount = mapping.triangleToFace.length;
  const positions = new Float32Array(triangleCount * 9);
  const colors = new Float32Array(triangleCount * 9);

  for (let t = 0; t < triangleCount; t += 1) {
    const faceId = mapping.triangleToFace[t]!;
    const pickId = allocate(t, faceId);
    const rgb = pickIdToUnitRgb(pickId);
    const i0 = index ? index.getX(t * 3) : t * 3;
    const i1 = index ? index.getX(t * 3 + 1) : t * 3 + 1;
    const i2 = index ? index.getX(t * 3 + 2) : t * 3 + 2;
    const o = t * 9;
    writeVertex(position, i0, positions, o);
    writeVertex(position, i1, positions, o + 3);
    writeVertex(position, i2, positions, o + 6);
    for (let corner = 0; corner < 3; corner += 1) {
      const c = o + corner * 3;
      colors[c] = rgb.r;
      colors[c + 1] = rgb.g;
      colors[c + 2] = rgb.b;
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setAttribute("pickColor", new BufferAttribute(colors, 3));
  return geometry;
}

export function facePickRecord(
  objectId: GpuPickRecord["objectId"],
  meshId: GpuPickRecord["meshId"],
  faceId: FaceId,
  triangleIndex: number,
): GpuPickRecord {
  return {
    objectId,
    ...(meshId ? { meshId } : {}),
    domain: "face",
    faceId,
    triangleIndex,
  };
}

function writeVertex(
  attribute: { getX(index: number): number; getY(index: number): number; getZ(index: number): number },
  vertexIndex: number,
  target: Float32Array,
  offset: number,
): void {
  target[offset] = attribute.getX(vertexIndex);
  target[offset + 1] = attribute.getY(vertexIndex);
  target[offset + 2] = attribute.getZ(vertexIndex);
}
