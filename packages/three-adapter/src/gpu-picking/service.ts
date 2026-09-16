import type { Camera, WebGLRenderer } from "three";
import { GPU_PICK_BACKGROUND_ID, type PickIdCodec } from "./encode";
import { GpuPickIdTable } from "./pick-id-table";
import { GpuPickScene } from "./pick-scene";
import { softwarePickAtPixel } from "./software-rasterizer";
import type {
  GpuPickDrawable,
  GpuPickRequest,
  GpuPickingBackend,
  GpuPickingDiagnostics,
  GpuPickingService,
  GpuPointPickResult,
  PickingInvalidation,
} from "./types";
import { WebGLPickReadback } from "./webgl-readback";

export type GpuPickingReadback = "webgl" | "software";

export interface CreateGpuPickingServiceOptions {
  readonly camera: Camera;
  readonly getDrawables: () => readonly GpuPickDrawable[];
  readonly renderer?: WebGLRenderer;
  readonly readback?: GpuPickingReadback;
  readonly codec?: PickIdCodec;
}

function sortDrawables(drawables: readonly GpuPickDrawable[]): GpuPickDrawable[] {
  return drawables.slice().sort((left, right) => {
    if (left.objectId < right.objectId) {
      return -1;
    }
    if (left.objectId > right.objectId) {
      return 1;
    }
    return 0;
  });
}

export class DefaultGpuPickingService implements GpuPickingService {
  private readonly camera: Camera;
  private readonly getDrawables: () => readonly GpuPickDrawable[];
  private readonly requestedReadback: GpuPickingReadback;
  private readonly ids: GpuPickIdTable;
  private readonly pickScene = new GpuPickScene();
  private readonly readback: WebGLPickReadback | undefined;
  private readonly pending: Array<(value: GpuPointPickResult | undefined) => void> = [];
  private disposed = false;
  private lastInvalidation: PickingInvalidation | null = null;
  private lastBackend: GpuPickingBackend = "unavailable";
  private pickRenders = 0;

  constructor(options: CreateGpuPickingServiceOptions) {
    this.camera = options.camera;
    this.getDrawables = options.getDrawables;
    this.requestedReadback = options.readback ?? "webgl";
    this.ids = new GpuPickIdTable(options.codec);
    this.readback = options.renderer ? new WebGLPickReadback(options.renderer) : undefined;
  }

  diagnostics(): GpuPickingDiagnostics {
    return {
      backend: this.resolveBackend(),
      lastBackend: this.lastBackend,
      registrySize: this.ids.size,
      lastInvalidation: this.lastInvalidation,
      disposed: this.disposed,
      pendingRequests: this.pending.length,
      geometryBuilds: this.ids.builds,
      pickRenders: this.pickRenders,
      idOverflow: this.ids.overflowed,
      uniqueFaceIds: this.ids.uniqueFaceIds,
      triangleSlots: this.ids.triangleSlots,
      hasReadback: this.readback !== undefined,
      contextLost: this.readback?.contextLost === true,
      ...(this.readback?.lastReadError ? { lastReadError: this.readback.lastReadError } : {}),
    };
  }

  invalidate(reason: PickingInvalidation): void {
    if (this.disposed) {
      return;
    }
    this.lastInvalidation = reason;
    if (reason === "camera" || reason === "transform" || reason === "visibility" || reason === "resize") {
      return;
    }
    this.ids.dirty = true;
  }

  resize(_width: number, _height: number): void {
    if (this.disposed) {
      return;
    }
    this.lastInvalidation = "resize";
  }

  async pick(request: GpuPickRequest): Promise<GpuPointPickResult | undefined> {
    if (this.disposed) {
      return undefined;
    }
    return await new Promise((resolve) => {
      this.pending.push(resolve);
      try {
        this.settle(resolve, this.pickSync(request));
      } catch {
        this.settle(resolve, undefined);
      }
    });
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.pickScene.dispose();
    this.ids.clear();
    this.readback?.dispose();
    const waiting = this.pending.splice(0, this.pending.length);
    for (const resolve of waiting) {
      resolve(undefined);
    }
    this.lastInvalidation = "dispose";
  }

  private pickSync(request: GpuPickRequest): GpuPointPickResult | undefined {
    const drawables = sortDrawables(this.getDrawables());
    this.ids.rebuild(drawables, request.domain);
    if (this.ids.overflowed) {
      this.lastBackend = "unavailable";
      return undefined;
    }
    const visible = drawables.filter((item) => item.visible && item.selectable);
    const backend = this.resolveBackend();
    this.lastBackend = backend;
    this.pickRenders += 1;

    if (backend === "software-id-buffer") {
      const hit = softwarePickAtPixel(
        visible,
        (drawable, triangleIndex) => this.ids.lookup(drawable.objectId, request.domain, triangleIndex),
        this.camera,
        request.pixelX,
        request.pixelY,
        request.viewportWidth,
        request.viewportHeight,
        request.backfaceMode,
      );
      return hit ? this.ids.resultFromPickId(hit.pickId, hit.depth) : undefined;
    }

    if (backend !== "gpu-id-buffer" || !this.readback) {
      return undefined;
    }

    this.pickScene.sync(visible, request.domain, request.backfaceMode, (objectId, triangleIndex) =>
      this.ids.lookup(objectId, request.domain, triangleIndex),
    );
    const pickId = this.readback.read(this.camera, this.pickScene.scene, request);
    if (pickId === undefined || pickId === GPU_PICK_BACKGROUND_ID) {
      return undefined;
    }
    return this.ids.resultFromPickId(pickId);
  }

  private resolveBackend(): GpuPickingBackend {
    if (this.disposed) {
      return "unavailable";
    }
    if (this.requestedReadback === "software") {
      return "software-id-buffer";
    }
    if (this.readback && !this.readback.contextLost) {
      return "gpu-id-buffer";
    }
    return "unavailable";
  }

  private settle(
    resolve: (value: GpuPointPickResult | undefined) => void,
    value: GpuPointPickResult | undefined,
  ): void {
    const index = this.pending.indexOf(resolve);
    if (index >= 0) {
      this.pending.splice(index, 1);
    }
    resolve(value);
  }
}

export { asWebGLRenderer, drawingBufferSize } from "./webgl-detect";
