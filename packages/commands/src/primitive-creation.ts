import { generatePrimitive, type PrimitiveCreateParams, type PrimitiveType } from "@modeling-kit/primitives";
import { Quaternion, Vector3, type Quat, type TransformData, type Vec3 } from "@modeling-kit/math";
import type { HalfEdgeMesh } from "@modeling-kit/mesh";
import { querySnap, type SnapQueryOptions, type SnapResult, type SnapTargetType } from "@modeling-kit/snapping";
import type { ModelingSession } from "./session";
import { CreatePrimitiveCommand, type CreatePrimitiveResult } from "./create-primitive";

export type PrimitiveCreationState =
  | "idle"
  | "defining-base"
  | "defining-height"
  | "previewing"
  | "committing"
  | "cancelled"
  | "completed";

export interface PrimitiveRay {
  readonly origin: Vec3;
  readonly direction: Vec3;
}

export interface PrimitivePointerInput {
  readonly point?: Vec3;
  readonly ray?: PrimitiveRay;
  /** Optional signed distance along the active extrusion axis for CAD height. */
  readonly extrusionDistance?: number;
}

export interface PrimitiveWorkPlane {
  readonly origin: Vec3;
  readonly xAxis: Vec3;
  readonly yAxis: Vec3;
  readonly normal: Vec3;
}

export interface PrimitiveSnapOptions {
  readonly enabled?: boolean;
  readonly surfacePlacement?: boolean;
  readonly snapRadius?: number;
  readonly gridSize?: number;
  readonly targets?: readonly SnapTargetType[];
  readonly hysteresis?: number;
  readonly offset?: number;
  readonly alignToSurface?: boolean;
  readonly preserveWorldUp?: boolean;
  readonly meshes?: readonly HalfEdgeMesh[];
  readonly resolveMeshes?: () => readonly HalfEdgeMesh[];
}

export interface PrimitiveCreationOptions {
  readonly primitive: PrimitiveType;
  readonly params?: PrimitiveCreateParams;
  readonly workPlane?: PrimitiveWorkPlane;
  readonly snap?: PrimitiveSnapOptions;
}

export interface PrimitivePreview {
  readonly state: PrimitiveCreationState;
  readonly primitive: PrimitiveType;
  readonly params: PrimitiveCreateParams;
  readonly transform: TransformData;
  readonly bounds: readonly Vec3[];
  readonly edges: readonly (readonly [Vec3, Vec3])[];
  readonly baseFootprint: readonly Vec3[];
  readonly width: number;
  readonly depth: number;
  readonly height: number;
  readonly workPlane: PrimitiveWorkPlane;
  readonly extrusionAxis: Vec3;
  readonly snap: SnapResult;
  readonly valid: boolean;
  /** The exact SDK-generated editable mesh used to describe this preview.
   * Consumers must treat it as read-only and must not add it to a session. */
  readonly mesh?: HalfEdgeMesh;
  readonly warning?: string;
}

const DEFAULT_PLANE: PrimitiveWorkPlane = {
  origin: { x: 0, y: 0, z: 0 },
  xAxis: { x: 1, y: 0, z: 0 },
  yAxis: { x: 0, y: 0, z: 1 },
  normal: { x: 0, y: 1, z: 0 },
};
const ZERO_SNAP: SnapResult = { matched: false };
const EPSILON = 1e-6;

export abstract class PrimitiveCreationSession {
  protected state: PrimitiveCreationState = "idle";
  protected pointer: Vec3 = { x: 0, y: 0, z: 0 };
  protected extrusionDistance: number | undefined;
  protected lastSnap: SnapResult = ZERO_SNAP;
  protected disposed = false;

  public constructor(
    protected readonly session: ModelingSession,
    protected readonly options: PrimitiveCreationOptions,
  ) {}

  get currentState(): PrimitiveCreationState {
    return this.state;
  }

  updatePointer(input: PrimitivePointerInput): PrimitivePreview {
    this.ensureLive();
    const point = resolvePlanePoint(input, this.workPlane());
    this.pointer = this.resolveSnap(point);
    this.extrusionDistance = input.extrusionDistance;
    this.state = this.state === "idle" ? "previewing" : this.state;
    return this.preview();
  }

  cancel(): void {
    if (this.disposed) return;
    this.state = "cancelled";
  }

  dispose(): void {
    this.cancel();
    this.disposed = true;
  }

  protected commit(params: PrimitiveCreateParams, transform: TransformData): CreatePrimitiveResult {
    this.ensureLive();
    this.state = "committing";
    const result = this.session.execute(
      new CreatePrimitiveCommand(this.options.primitive, params, { localTransform: transform }),
    );
    this.state = "completed";
    return result;
  }

  protected resolveSnap(point: Vec3): Vec3 {
    const snap = this.options.snap ?? {};
    if (snap?.enabled === false || snap?.surfacePlacement === false) {
      this.lastSnap = ZERO_SNAP;
      return point;
    }
    let best: SnapResult = ZERO_SNAP;
    for (const mesh of snap.meshes ?? snap.resolveMeshes?.() ?? []) {
      const queryOptions: SnapQueryOptions = {
        ...(snap.snapRadius !== undefined ? { snapRadius: snap.snapRadius } : {}),
        ...(snap.gridSize !== undefined ? { gridSize: snap.gridSize } : {}),
        ...(snap.targets !== undefined ? { targets: snap.targets } : {}),
        ...(this.lastSnap.targetId ? { previousTargetId: this.lastSnap.targetId } : {}),
        hysteresis: snap.hysteresis ?? 1.25,
      };
      const result = querySnap(mesh, point, queryOptions);
      if (result.matched && (!best.matched || (result.score ?? 0) > (best.score ?? 0))) best = result;
    }
    if (!best.matched && snap?.gridSize && snap.gridSize > 0) {
      const grid = new Vector3(
        Math.round(point.x / snap.gridSize) * snap.gridSize,
        Math.round(point.y / snap.gridSize) * snap.gridSize,
        Math.round(point.z / snap.gridSize) * snap.gridSize,
      );
      best = { matched: true, targetType: "grid", worldPosition: grid };
    }
    if (best.matched && best.worldPosition) {
      this.lastSnap = best;
      return best.worldPosition;
    }
    this.lastSnap = ZERO_SNAP;
    return point;
  }

  protected workPlane(): PrimitiveWorkPlane {
    return this.options.workPlane ?? DEFAULT_PLANE;
  }

  protected ensureLive(): void {
    if (this.disposed) throw new Error("Primitive creation session is disposed");
    if (this.state === "cancelled") throw new Error("Primitive creation session is cancelled");
  }

  abstract preview(): PrimitivePreview;
}

export class CadPrimitiveDrawSession extends PrimitiveCreationSession {
  private start: Vec3 | null = null;
  private baseEnd: Vec3 | null = null;
  private numeric: Partial<Pick<PrimitivePreview, "width" | "depth" | "height">> = {};

  firstClick(input: PrimitivePointerInput): PrimitivePreview {
    this.ensureLive();
    this.start = this.resolveSnap(resolvePlanePoint(input, this.workPlane()));
    this.extrusionDistance = undefined;
    this.pointer = this.start;
    this.state = "defining-base";
    return this.preview();
  }

  secondClick(): PrimitivePreview {
    this.ensureLive();
    if (!this.start || !this.validBase()) throw new RangeError("CAD base must have non-zero width and depth");
    this.baseEnd = this.pointer;
    this.state = "defining-height";
    return this.preview();
  }

  thirdClick(): CreatePrimitiveResult {
    this.ensureLive();
    const view = this.preview();
    if (!view.valid) throw new RangeError(view.warning ?? "Primitive dimensions are below the SDK tolerance");
    return this.commit(view.params, view.transform);
  }

  setDimensions(dimensions: Partial<Pick<PrimitivePreview, "width" | "depth" | "height">>): PrimitivePreview {
    this.numeric = { ...this.numeric, ...dimensions };
    return this.preview();
  }

  private validBase(): boolean {
    if (!this.start) return false;
    const plane = this.workPlane();
    return Math.abs(new Vector3(this.pointer.x - this.start.x, this.pointer.y - this.start.y, this.pointer.z - this.start.z).dot(plane.xAxis)) > EPSILON &&
      Math.abs(new Vector3(this.pointer.x - this.start.x, this.pointer.y - this.start.y, this.pointer.z - this.start.z).dot(plane.yAxis)) > EPSILON;
  }

  preview(): PrimitivePreview {
    const plane = this.workPlane();
    const start = this.start ?? this.pointer;
    const end = this.baseEnd ?? this.pointer;
    const delta = new Vector3(end.x - start.x, end.y - start.y, end.z - start.z);
    const width = this.numeric.width ?? Math.abs(delta.dot(plane.xAxis));
    const depth = this.numeric.depth ?? Math.abs(delta.dot(plane.yAxis));
    const rawHeight = this.numeric.height ?? (
      this.extrusionDistance !== undefined
        ? Math.abs(this.extrusionDistance)
        : Math.abs(new Vector3(this.pointer.x - end.x, this.pointer.y - end.y, this.pointer.z - end.z).dot(plane.normal))
    );
    const height = rawHeight || (this.state === "defining-base" ? 0 : 1);
    const center = new Vector3(
      (start.x + end.x) / 2 + plane.normal.x * height / 2,
      (start.y + end.y) / 2 + plane.normal.y * height / 2,
      (start.z + end.z) / 2 + plane.normal.z * height / 2,
    );
    return makePreview(this.state, this.options.primitive, this.params(width, depth, height), center, width, depth, height, plane, this.lastSnap);
  }

  private params(width: number, depth: number, height: number): PrimitiveCreateParams {
    return { ...this.options.params, width, depth, height };
  }
}

export class PrimitivePlacementSession extends PrimitiveCreationSession {
  private rotation: Quat = { x: 0, y: 0, z: 0, w: 1 };
  private scale = { x: 1, y: 1, z: 1 };

  setRotation(rotation: Quat): PrimitivePreview { this.rotation = { ...rotation }; return this.preview(); }
  setScale(scale: Vec3): PrimitivePreview { this.scale = { x: scale.x, y: scale.y, z: scale.z }; return this.preview(); }

  place(): CreatePrimitiveResult {
    const view = this.preview();
    if (!view.valid) throw new RangeError(view.warning ?? "Primitive dimensions are below the SDK tolerance");
    const result = this.commit(view.params, view.transform);
    this.state = "previewing";
    return result;
  }

  preview(): PrimitivePreview {
    const plane = this.workPlane();
    const params = { ...this.options.params };
    const width = Math.max(Number(params.width ?? 1), 0);
    const depth = Math.max(Number(params.depth ?? 1), 0);
    const height = Math.max(Number(params.height ?? 1), 0);
    const point = new Vector3(this.pointer.x, this.pointer.y, this.pointer.z);
    const offset = this.options.snap?.offset ?? 0;
    const position = point.add(new Vector3(plane.normal.x * offset, plane.normal.y * offset, plane.normal.z * offset));
    const align = this.options.snap?.alignToSurface !== false && !this.options.snap?.preserveWorldUp;
    const rotation = align && this.lastSnap.targetType && this.lastSnap.targetType !== "grid"
      ? Quaternion.fromTo(Vector3.unitY, plane.normal).toJSON()
      : this.rotation;
    return makePreview(this.state, this.options.primitive, params, position, width * this.scale.x, depth * this.scale.z, height * this.scale.y, plane, this.lastSnap, { ...rotation, }, this.scale);
  }
}

function resolvePlanePoint(input: PrimitivePointerInput, plane: PrimitiveWorkPlane): Vec3 {
  if (input.point) return input.point;
  if (!input.ray) return plane.origin;
  const origin = Vector3.from(input.ray.origin);
  const direction = Vector3.from(input.ray.direction);
  const denominator = direction.dot(plane.normal);
  if (Math.abs(denominator) < EPSILON) return plane.origin;
  const t = new Vector3(plane.origin.x - origin.x, plane.origin.y - origin.y, plane.origin.z - origin.z).dot(plane.normal) / denominator;
  return origin.add(direction.scale(Math.max(0, t)));
}

function makePreview(
  state: PrimitiveCreationState,
  primitive: PrimitiveType,
  params: PrimitiveCreateParams,
  center: Vec3,
  width: number,
  depth: number,
  height: number,
  plane: PrimitiveWorkPlane,
  snap: SnapResult,
  rotation: Quat = Quaternion.fromTo(Vector3.unitY, plane.normal).toJSON(),
  scale = { x: 1, y: 1, z: 1 },
): PrimitivePreview {
  const x = Vector3.from(plane.xAxis).normalize().scale(width / 2);
  const z = Vector3.from(plane.yAxis).normalize().scale(depth / 2);
  const y = Vector3.from(plane.normal).normalize().scale(height / 2);
  const corners = [
    new Vector3(center.x - x.x - y.x - z.x, center.y - x.y - y.y - z.y, center.z - x.z - y.z - z.z),
    new Vector3(center.x + x.x - y.x - z.x, center.y + x.y - y.y - z.y, center.z + x.z - y.z - z.z),
    new Vector3(center.x + x.x - y.x + z.x, center.y + x.y - y.y + z.y, center.z + x.z - y.z + z.z),
    new Vector3(center.x - x.x - y.x + z.x, center.y - x.y - y.y + z.y, center.z - x.z - y.z + z.z),
    new Vector3(center.x - x.x + y.x - z.x, center.y - x.y + y.y - z.y, center.z - x.z + y.z - z.z),
    new Vector3(center.x + x.x + y.x - z.x, center.y + x.y + y.y - z.y, center.z + x.z + y.z - z.z),
    new Vector3(center.x + x.x + y.x + z.x, center.y + x.y + y.y + z.y, center.z + x.z + y.z + z.z),
    new Vector3(center.x - x.x + y.x + z.x, center.y - x.y + y.y + z.y, center.z - x.z + y.z + z.z),
  ];
  const edgePairs: readonly (readonly [number, number])[] = [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]];
  const valid = width > EPSILON && depth > EPSILON && height > EPSILON;
  let mesh: HalfEdgeMesh | undefined;
  try {
    // Preview generation deliberately uses the same primitive catalogue and
    // library conversion as CreatePrimitiveCommand, without touching the
    // document, selection, or history. This preserves UV seams, normals,
    // winding, segment topology, and primitive-specific data exactly.
    mesh = generatePrimitive(primitive, params).mesh;
  } catch {
    mesh = undefined;
  }
  const resolvedScale = { ...scale };
  if (mesh && valid) {
    let minX = Infinity; let minY = Infinity; let minZ = Infinity;
    let maxX = -Infinity; let maxY = -Infinity; let maxZ = -Infinity;
    for (const vertex of mesh.vertices.values()) {
      minX = Math.min(minX, vertex.position[0]); maxX = Math.max(maxX, vertex.position[0]);
      minY = Math.min(minY, vertex.position[1]); maxY = Math.max(maxY, vertex.position[1]);
      minZ = Math.min(minZ, vertex.position[2]); maxZ = Math.max(maxZ, vertex.position[2]);
    }
    const intrinsic = [maxX - minX, maxY - minY, maxZ - minZ];
    if (intrinsic[0]! > EPSILON) resolvedScale.x *= width / intrinsic[0]!;
    if (intrinsic[1]! > EPSILON) resolvedScale.y *= height / intrinsic[1]!;
    if (intrinsic[2]! > EPSILON) resolvedScale.z *= depth / intrinsic[2]!;
  }
  const result: PrimitivePreview = {
    state,
    primitive,
    params: Object.freeze({ ...params }),
    transform: { position: center, rotation, scale: resolvedScale },
    bounds: Object.freeze(corners),
    edges: Object.freeze(edgePairs.map(([a, b]) => [corners[a]!, corners[b]!] as const)),
    baseFootprint: Object.freeze([corners[0]!, corners[1]!, corners[2]!, corners[3]!]),
    width,
    depth,
    height,
    workPlane: plane,
    extrusionAxis: plane.normal,
    snap,
    valid,
    ...(mesh ? { mesh } : {}),
    ...(valid ? {} : { warning: "Primitive dimensions must be greater than the SDK tolerance" }),
  };
  return Object.freeze(result);
}
