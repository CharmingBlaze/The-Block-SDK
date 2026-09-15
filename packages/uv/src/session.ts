import {
  OperationLifecycleMachine,
  type CornerId,
  type OperationLifecycle,
  type UVChannelId,
} from "@modeling-kit/core";
import type { HalfEdgeMesh } from "@modeling-kit/mesh";
import { DEFAULT_UV_CHANNEL } from "./channels";
import { getCornerUv, isCornerPinned, setCornerUvs, type UvVec2 } from "./corners";

export type UVTransformOperation = "move" | "rotate" | "scale";
export type UVTransformPivot =
  | "selection-center"
  | "bounding-box-center"
  | "active-uv-vertex"
  | "custom";

export interface UVTransformRequest {
  readonly operation: UVTransformOperation;
  readonly pivot?: UVTransformPivot;
  readonly customPivot?: UvVec2;
  readonly activeUv?: UvVec2;
  /** When true (default), pinned corners stay at their baseline. */
  readonly respectPins?: boolean;
}

export interface UVTransformDelta {
  readonly translate?: UvVec2;
  readonly angleRadians?: number;
  readonly scale?: UvVec2 | number;
}

export interface UVCornerSnapshot {
  readonly cornerId: CornerId;
  readonly uv: UvVec2;
}

export interface UVOperationResult {
  readonly changedCornerIds: readonly CornerId[];
  readonly warnings: readonly string[];
  readonly before: readonly UVCornerSnapshot[];
  readonly after: readonly UVCornerSnapshot[];
  readonly committed: boolean;
}

export interface UVPreview {
  readonly operation: UVTransformOperation;
  readonly changedCornerIds: readonly CornerId[];
}

export interface UVTransformCommitHandler {
  (payload: {
    readonly channelId: UVChannelId;
    readonly before: readonly UVCornerSnapshot[];
    readonly after: readonly UVCornerSnapshot[];
  }): void;
}

const UV_EPSILON = 1e-9;

export class UvTransformSession {
  readonly lifecycle = new OperationLifecycleMachine();
  private baseline = new Map<CornerId, [number, number]>();
  private pinned = new Set<CornerId>();
  private request: UVTransformRequest | null = null;
  private lastDelta: UVTransformDelta = {};
  private disposed = false;

  constructor(
    private mesh: HalfEdgeMesh,
    private channelId: UVChannelId = DEFAULT_UV_CHANNEL,
    private readonly onCommit?: UVTransformCommitHandler,
  ) {}

  get state(): OperationLifecycle {
    return this.lifecycle.state;
  }

  get active(): boolean {
    return this.lifecycle.state === "beginning" || this.lifecycle.state === "active";
  }

  setMesh(mesh: HalfEdgeMesh): void {
    if (this.active) {
      this.cancel();
    }
    this.mesh = mesh;
  }

  setChannel(channelId: UVChannelId): void {
    if (this.active) {
      this.cancel();
    }
    this.channelId = channelId;
  }

  begin(request: UVTransformRequest, cornerIds: readonly CornerId[]): void {
    this.assertAlive();
    if (this.active) {
      this.cancel();
    }
    this.lifecycle.recycle();
    this.lifecycle.transition("beginning");
    this.request = request;
    this.lastDelta = {};
    this.baseline.clear();
    this.pinned.clear();
    const respectPins = request.respectPins !== false;
    for (const cornerId of cornerIds) {
      this.baseline.set(cornerId, getCornerUv(this.mesh, cornerId, this.channelId));
      if (respectPins && isCornerPinned(this.mesh, cornerId, this.channelId)) {
        this.pinned.add(cornerId);
      }
    }
    this.lifecycle.transition("active");
  }

  update(delta: UVTransformDelta): UVPreview {
    this.assertAlive();
    if (!this.request) {
      throw new Error("UvTransformSession.update requires an active transform");
    }
    this.lifecycle.transition("active");
    this.lastDelta = delta;
    this.restore();
    this.apply(delta);
    return {
      operation: this.request.operation,
      changedCornerIds: [...this.baseline.keys()],
    };
  }

  commit(): UVOperationResult {
    this.assertAlive();
    if (!this.active) {
      throw new Error("UvTransformSession.commit requires an active transform");
    }
    const before = [...this.baseline.entries()].map(([cornerId, uv]) => ({
      cornerId,
      uv: [uv[0], uv[1]] as const,
    }));
    const after = [...this.baseline.keys()].map((cornerId) => {
      const uv = getCornerUv(this.mesh, cornerId, this.channelId);
      return { cornerId, uv: [uv[0], uv[1]] as const };
    });
    const changed = after.filter((item, index) => {
      const start = before[index]!;
      return (
        Math.abs(item.uv[0] - start.uv[0]) > UV_EPSILON ||
        Math.abs(item.uv[1] - start.uv[1]) > UV_EPSILON
      );
    });
    if (changed.length === 0) {
      this.cancel();
      return {
        changedCornerIds: [],
        warnings: [],
        before,
        after: before,
        committed: false,
      };
    }
    this.lifecycle.transition("committing");
    try {
      if (this.onCommit) {
        this.restore();
        this.onCommit({ channelId: this.channelId, before, after });
      }
      this.lifecycle.transition("completed");
    } catch (error) {
      this.restore();
      this.lifecycle.fail();
      this.clearGesture();
      this.lifecycle.recycle();
      throw error;
    }
    const warnings = this.pinned.size > 0 ? ["Pinned UV corners were held in place"] : [];
    this.clearGesture();
    this.lifecycle.recycle();
    return {
      changedCornerIds: changed.map((item) => item.cornerId),
      warnings,
      before,
      after,
      committed: true,
    };
  }

  cancel(): void {
    if (this.disposed) {
      return;
    }
    if (!this.active && this.lifecycle.state !== "committing") {
      this.lifecycle.recycle();
      return;
    }
    this.lifecycle.transition("cancelling");
    this.restore();
    this.finish("cancelled");
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.cancel();
    this.disposed = true;
    this.baseline.clear();
    this.pinned.clear();
  }

  private finish(terminal: "cancelled"): void {
    this.clearGesture();
    this.lifecycle.transition(terminal);
    this.lifecycle.recycle();
  }

  private clearGesture(): void {
    this.baseline.clear();
    this.pinned.clear();
    this.request = null;
    this.lastDelta = {};
  }

  private apply(delta: UVTransformDelta): void {
    const request = this.request;
    if (!request || this.baseline.size === 0) {
      return;
    }
    const pivot = this.pivotOf(request);
    const updates: { cornerId: CornerId; uv: UvVec2 }[] = [];
    const angle = delta.angleRadians ?? 0;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const scalePair: [number, number] =
      typeof delta.scale === "number"
        ? [delta.scale, delta.scale]
        : [delta.scale?.[0] ?? 1, delta.scale?.[1] ?? 1];
    const translate = delta.translate ?? [0, 0];
    for (const [cornerId, start] of this.baseline) {
      if (this.pinned.has(cornerId)) {
        continue;
      }
      let u = start[0] - pivot[0];
      let v = start[1] - pivot[1];
      if (request.operation === "rotate" || angle !== 0) {
        const ru = u * cos - v * sin;
        const rv = u * sin + v * cos;
        u = ru;
        v = rv;
      }
      if (request.operation === "scale" || delta.scale !== undefined) {
        u *= scalePair[0];
        v *= scalePair[1];
      }
      u += pivot[0] + (request.operation === "move" || delta.translate ? translate[0] : 0);
      v += pivot[1] + (request.operation === "move" || delta.translate ? translate[1] : 0);
      updates.push({ cornerId, uv: [u, v] });
    }
    setCornerUvs(this.mesh, updates, this.channelId);
  }

  private pivotOf(request: UVTransformRequest): [number, number] {
    if (request.pivot === "custom" && request.customPivot) {
      return [request.customPivot[0], request.customPivot[1]];
    }
    if (request.pivot === "active-uv-vertex" && request.activeUv) {
      return [request.activeUv[0], request.activeUv[1]];
    }
    let minU = Infinity;
    let minV = Infinity;
    let maxU = -Infinity;
    let maxV = -Infinity;
    let su = 0;
    let sv = 0;
    let n = 0;
    for (const [cornerId, uv] of this.baseline) {
      if (this.pinned.has(cornerId)) {
        continue;
      }
      su += uv[0];
      sv += uv[1];
      n += 1;
      minU = Math.min(minU, uv[0]);
      minV = Math.min(minV, uv[1]);
      maxU = Math.max(maxU, uv[0]);
      maxV = Math.max(maxV, uv[1]);
    }
    if (n === 0) {
      return [0, 0];
    }
    if (request.pivot === "bounding-box-center") {
      return [(minU + maxU) / 2, (minV + maxV) / 2];
    }
    return [su / n, sv / n];
  }

  private restore(): void {
    if (this.baseline.size === 0) {
      return;
    }
    setCornerUvs(
      this.mesh,
      [...this.baseline.entries()].map(([cornerId, uv]) => ({ cornerId, uv })),
      this.channelId,
    );
  }

  private assertAlive(): void {
    if (this.disposed) {
      throw new Error("UvTransformSession is disposed");
    }
  }
}
