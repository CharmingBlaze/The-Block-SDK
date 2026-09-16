import { BufferAttribute, BufferGeometry, DynamicDrawUsage, type Object3D } from "three";
import type { VisualizerView } from "./visualizer-types";

export function growFloats(buffer: Float32Array, needed: number): Float32Array {
  if (buffer.length >= needed) {
    return buffer as Float32Array;
  }
  const capacity = Math.max(needed, (buffer.length * 3) >> 1 || 32);
  const next = new Float32Array(new ArrayBuffer(capacity * 4));
  next.set(buffer);
  return next;
}

export function writeGrowAttribute(
  geometry: BufferGeometry,
  name: string,
  itemSize: number,
  source: Float32Array,
  used: number,
): void {
  let attribute = geometry.getAttribute(name) as BufferAttribute | undefined;
  if (!attribute || attribute.array.length < used) {
    const next = new Float32Array(Math.max(used, attribute ? attribute.array.length * 2 : 12));
    if (used > 0) {
      next.set(source.subarray(0, used));
    }
    geometry.setAttribute(name, new BufferAttribute(next, itemSize).setUsage(DynamicDrawUsage));
    attribute = geometry.getAttribute(name) as BufferAttribute;
  } else if (used > 0) {
    (attribute.array as Float32Array).set(source.subarray(0, used));
    attribute.needsUpdate = true;
  }
  geometry.setDrawRange(0, itemSize === 0 ? 0 : used / itemSize);
  if (name === "position") {
    geometry.computeBoundingSphere();
  }
}

export function hashView(view: VisualizerView, object: Object3D): number {
  const a = view.camera.matrixWorld.elements;
  const b = object.matrixWorld.elements;
  const scale =
    4096 *
    (view.width +
      view.height * 13 +
      a[12]! * 17 +
      a[13]! * 19 +
      a[14]! * 23 +
      a[0]! * 29 +
      a[5]! * 31 +
      a[10]! * 37 +
      b[12]! * 41 +
      b[13]! * 43 +
      b[14]! * 47 +
      b[0]! * 53 +
      b[5]! * 59 +
      b[10]! * 61);
  return scale | 0;
}
