import {
  BufferAttribute,
  BufferGeometry,
  Group,
  LineBasicMaterial,
  LineSegments,
  Points,
  PointsMaterial,
} from "three";

export type KnifeOverlayVec3 = readonly [number, number, number] | { x: number; y: number; z: number };

export interface KnifeOverlayState {
  readonly cursor?: KnifeOverlayVec3;
  readonly vertices?: readonly KnifeOverlayVec3[];
  readonly segments?: readonly (readonly [KnifeOverlayVec3, KnifeOverlayVec3])[];
  readonly active?: boolean;
  readonly perforated?: boolean;
  readonly lineColor?: number;
  readonly vertexColor?: number;
  readonly cursorColor?: number;
}

const DASH = 0.08;
const GAP = 0.045;

export function createKnifeOverlay(): Group {
  const group = new Group();
  group.name = "knife-overlay";
  group.userData.isOverlay = true;
  group.userData.overlayKind = "knife";
  group.renderOrder = 1000;
  group.frustumCulled = false;
  group.raycast = () => {};

  const lines = new LineSegments(
    new BufferGeometry(),
    new LineBasicMaterial({
      color: 0x7cf0ff,
      depthTest: false,
      depthWrite: false,
      transparent: true,
    }),
  );
  lines.name = "knife-guides";
  lines.renderOrder = 1001;
  lines.frustumCulled = false;
  lines.raycast = () => {};

  const vertices = new Points(
    new BufferGeometry(),
    new PointsMaterial({
      color: 0xffffff,
      size: 12,
      sizeAttenuation: false,
      depthTest: false,
      depthWrite: false,
    }),
  );
  vertices.name = "knife-vertices";
  vertices.renderOrder = 1002;
  vertices.frustumCulled = false;
  vertices.raycast = () => {};

  const cursor = new Points(
    new BufferGeometry(),
    new PointsMaterial({
      color: 0xffee55,
      size: 16,
      sizeAttenuation: false,
      depthTest: false,
      depthWrite: false,
    }),
  );
  cursor.name = "knife-cursor";
  cursor.renderOrder = 1003;
  cursor.frustumCulled = false;
  cursor.raycast = () => {};

  group.add(lines, vertices, cursor);
  group.visible = false;
  return group;
}

export function updateKnifeOverlay(group: Group, state: KnifeOverlayState | null): void {
  const lines = group.getObjectByName("knife-guides") as LineSegments | undefined;
  const vertexPoints = group.getObjectByName("knife-vertices") as Points | undefined;
  const cursorPoints = group.getObjectByName("knife-cursor") as Points | undefined;
  if (!lines || !vertexPoints || !cursorPoints) {
    return;
  }

  const segments = state?.segments ?? [];
  const vertices = state?.vertices ?? [];
  const cursor = state?.cursor;
  const hasGeometry = segments.length > 0 || vertices.length > 0 || Boolean(cursor);
  if (!state || (!state.active && !hasGeometry)) {
    group.visible = false;
    return;
  }

  group.visible = true;

  const lineMaterial = lines.material as LineBasicMaterial;
  const vertexMaterial = vertexPoints.material as PointsMaterial;
  const cursorMaterial = cursorPoints.material as PointsMaterial;
  lineMaterial.color.setHex(state.lineColor ?? 0x7cf0ff);
  vertexMaterial.color.setHex(state.vertexColor ?? 0xffffff);
  cursorMaterial.color.setHex(state.cursorColor ?? 0xffee55);

  const dashed: number[] = [];
  const perforated = state.perforated !== false;
  for (const segment of segments) {
    if (perforated) {
      appendDashed(toXYZ(segment[0]), toXYZ(segment[1]), dashed);
    } else {
      const a = toXYZ(segment[0]);
      const b = toXYZ(segment[1]);
      dashed.push(a[0], a[1], a[2], b[0], b[1], b[2]);
    }
  }
  replacePositions(lines, dashed);

  const committed: number[] = [];
  for (const vertex of vertices) {
    const p = toXYZ(vertex);
    committed.push(p[0], p[1], p[2]);
  }
  replacePositions(vertexPoints, committed);

  const cursorPos: number[] = [];
  if (cursor) {
    const p = toXYZ(cursor);
    cursorPos.push(p[0], p[1], p[2]);
  }
  replacePositions(cursorPoints, cursorPos);
}

export function dashSegmentPositions(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
  dash = DASH,
  gap = GAP,
): number[] {
  const out: number[] = [];
  appendDashed(a, b, out, dash, gap);
  return out;
}

function appendDashed(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
  out: number[],
  dash = DASH,
  gap = GAP,
): void {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const dz = b[2] - a[2];
  const length = Math.hypot(dx, dy, dz);
  if (length < 1e-8) {
    return;
  }
  const ux = dx / length;
  const uy = dy / length;
  const uz = dz / length;
  let offset = 0;
  let drawing = true;
  while (offset < length) {
    const span = drawing ? dash : gap;
    const next = Math.min(length, offset + span);
    if (drawing) {
      out.push(
        a[0] + ux * offset,
        a[1] + uy * offset,
        a[2] + uz * offset,
        a[0] + ux * next,
        a[1] + uy * next,
        a[2] + uz * next,
      );
    }
    drawing = !drawing;
    offset = next;
  }
}

function replacePositions(object: LineSegments | Points, positions: number[]): void {
  object.geometry.dispose();
  const geometry = new BufferGeometry();
  if (positions.length > 0) {
    geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
  }
  object.geometry = geometry;
}

function toXYZ(value: KnifeOverlayVec3): readonly [number, number, number] {
  if ("x" in value) {
    return [value.x, value.y, value.z];
  }
  return [value[0], value[1], value[2]];
}
