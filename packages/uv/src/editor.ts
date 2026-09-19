import {
  brand,
  ResourceLifecycleMachine,
  type FaceId,
  type MeshId,
  type OperationLifecycle,
  type ResourceLifecycle,
  type UVChannelId,
} from "@modeling-kit/core";
import type { HalfEdgeMesh } from "@modeling-kit/mesh";
import { DEFAULT_UV_CHANNEL, createDefaultUvChannel, type UVChannel } from "./channels";
import { UvTopologyCache, getOrBuildUvTopology } from "./cache";
import { UVPaintDirtyFlag } from "./dirty";
import { UVInteractionMachine, type UVInteractionState } from "./interaction";
import { normalizeUvBox, uvIdsInBox, uvIdsInPolygon } from "./marquee";
import {
  UVSelection,
  type UVSelectionHit,
  type UVSelectionMode,
  type UVSelectionOperation,
} from "./selection";
import { UvTransformSession, type UVTransformDelta, type UVTransformRequest } from "./session";
import type { UVTopology } from "./topology";
import { pickUv } from "./picking";
import { IDENTITY_UV_VIEW } from "./view-data";
import { UVViewAdapter, type UVViewAdapterOptions } from "./view-adapter";
import { themeForPreset, type UVEditorPreset, type UVVisualTheme } from "./visual";

export type UVEditorLifecycle = ResourceLifecycle;
export type UVPointerTool = "select" | "lasso";

export interface UVPointerModifiers {
  readonly add?: boolean;
  readonly toggle?: boolean;
}

export interface UVCornerPatch {
  readonly meshId: MeshId;
  readonly channelId: UVChannelId;
  readonly before: readonly { cornerId: string; uv: readonly [number, number] }[];
  readonly after: readonly { cornerId: string; uv: readonly [number, number] }[];
}

export interface CreateUvEditorOptions {
  readonly mesh: HalfEdgeMesh;
  readonly meshId?: MeshId;
  readonly channelId?: UVChannelId;
  readonly channels?: readonly UVChannel[];
  readonly textureResolution?: { readonly width: number; readonly height: number };
  readonly preset?: UVEditorPreset;
  readonly theme?: UVVisualTheme;
  readonly syncSelection?: boolean;
  readonly onCommit?: (patch: UVCornerPatch) => void;
  /** Observer after a successful commit. Does not restore UVs. */
  readonly onCommitted?: (patch: UVCornerPatch) => void;
  readonly onFacesSelected?: (faceIds: readonly FaceId[], activeFaceId: FaceId | null) => void;
}

const MARQUEE_EPSILON = 1e-5;

export function createUvEditor(options: CreateUvEditorOptions): UVEditor {
  return new UVEditor(options);
}

/**
 * Headless UV editor for interactive UV mapping.
 *
 * `UVEditor` manages the complete lifecycle of UV editing: selection, hover,
 * marquee/lasso, transform (move/rotate/scale), and channel switching — all
 * without any rendering dependency. Host applications connect via
 * {@link UVViewAdapter} instances that receive structured draw-data batches.
 *
 * ## Features
 *
 * - **Selection** — vertex, edge, face, island modes with replace/add/remove/toggle
 * - **Marquee/lasso** — box-select and freeform polygon select
 * - **Transform** — move, rotate, scale with pin-respect and preview-commit-cancel
 * - **Topology-aware** — linked selection, grow/shrink, invert, select-all
 * - **3D sync** — bidirectional selection sync with the 3D viewport
 * - **Multi-channel** — switch UV channels without recreating the editor
 * - **Lifecycle management** — proper `ResourceLifecycleMachine` with `dispose()`
 *
 * ## Usage
 *
 * ```ts
 * import { createUvEditor } from "@modeling-kit/uv";
 *
 * const editor = createUvEditor({
 *   mesh,
 *   textureResolution: { width: 1024, height: 1024 },
 *   onCommit: (patch) => executeCommand(new ProjectUvCommand(patch)),
 * });
 *
 * editor.pointerDown([0.5, 0.5], { mode: "face" });
 * editor.pointerUp([0.5, 0.5]);
 * editor.beginTransform({ operation: "move" });
 * editor.updateTransform({ translate: [0.1, 0] });
 * editor.commitTransform();
 * editor.dispose();
 * ```
 *
 * @see {@link UVViewAdapter} for rendering integration
 * @see {@link UvTransformSession} for the transform state machine
 */
export class UVEditor {
  readonly meshId: MeshId;
  channelId: UVChannelId;
  channels: UVChannel[];
  textureResolution: { width: number; height: number };
  theme: UVVisualTheme;
  readonly selection: UVSelection;
  readonly cache = new UvTopologyCache();
  readonly resources = new ResourceLifecycleMachine();
  readonly interaction = new UVInteractionMachine();
  private readonly transformSession: UvTransformSession;
  readonly transform: {
    readonly state: OperationLifecycle;
    readonly active: boolean;
    begin: (request: UVTransformRequest) => void;
    update: (delta: UVTransformDelta) => void;
    commit: () => ReturnType<UvTransformSession["commit"]>;
    cancel: () => void;
  };
  private mesh: HalfEdgeMesh;
  private readonly views = new Set<UVViewAdapter>();
  private readonly unsubscribers: Array<() => void> = [];
  private pressUv: readonly [number, number] | null = null;
  private lassoPath: Array<readonly [number, number]> = [];
  private pointerTool: UVPointerTool = "select";
  private pointerOp: UVSelectionOperation = "replace";

  constructor(options: CreateUvEditorOptions) {
    this.resources.transition("initializing");
    this.mesh = options.mesh;
    this.meshId = options.meshId ?? options.mesh.id;
    this.channelId = options.channelId ?? DEFAULT_UV_CHANNEL;
    this.channels = [...(options.channels ?? [createDefaultUvChannel()])];
    this.textureResolution = options.textureResolution ?? { width: 512, height: 512 };
    this.theme = options.theme ?? themeForPreset(options.preset ?? "professional");
    this.selection = new UVSelection({
      enabled: options.syncSelection === true,
      ...(options.onFacesSelected ? { onFacesSelected: options.onFacesSelected } : {}),
    });
    const session = new UvTransformSession(
      this.mesh,
      this.channelId,
      options.onCommit
        ? (payload) => {
            options.onCommit?.({
              meshId: this.meshId,
              channelId: payload.channelId,
              before: payload.before,
              after: payload.after,
            });
          }
        : undefined,
      options.onCommitted
        ? (payload) => {
            options.onCommitted?.({
              meshId: this.meshId,
              channelId: payload.channelId,
              before: payload.before,
              after: payload.after,
            });
          }
        : undefined,
    );
    this.transformSession = session;
    this.transform = {
      get state() {
        return session.state;
      },
      get active() {
        return session.active;
      },
      begin: (request) => this.beginTransform(request),
      update: (delta) => this.updateTransform(delta),
      commit: () => this.commitTransform(),
      cancel: () => this.cancelTransform(),
    };
    this.resources.transition("ready");
  }

  get lifecycle(): UVEditorLifecycle {
    return this.resources.state;
  }

  get interactionState(): UVInteractionState {
    return this.interaction.state;
  }

  get disposed(): boolean {
    return this.resources.disposed;
  }

  get topologyBuilds(): number {
    return this.cache.connectivityBuilds;
  }

  setMesh(mesh: HalfEdgeMesh): void {
    this.assertReady();
    this.mesh = mesh;
    this.transformSession.setMesh(mesh);
    this.cache.invalidateMesh(this.meshId);
    this.markViews(UVPaintDirtyFlag.UVTopology | UVPaintDirtyFlag.UVPositions | UVPaintDirtyFlag.Picking);
  }

  topology(): UVTopology {
    this.assertReady();
    this.resources.transition("updating");
    try {
      return getOrBuildUvTopology(this.mesh, this.cache, this.channelId).topology;
    } finally {
      if (!this.resources.isDisposed && this.resources.state === "updating") {
        this.resources.transition("ready");
      }
    }
  }

  select(request: {
    readonly mode: UVSelectionMode;
    readonly operation: UVSelectionOperation;
    readonly hit?: UVSelectionHit;
    readonly ids?: readonly UVSelectionHit["id"][];
  }): void {
    this.assertReady();
    const ids = request.ids ?? (request.hit ? [request.hit.id] : []);
    this.selection.apply(this.topology(), {
      mode: request.mode,
      operation: request.operation,
      ids,
    });
    this.markViews(UVPaintDirtyFlag.UVSelection | UVPaintDirtyFlag.UVVisuals);
  }

  selectAll(mode?: UVSelectionMode): void {
    this.assertReady();
    this.selection.selectAll(this.topology(), mode);
    this.markViews(UVPaintDirtyFlag.UVSelection);
  }

  clearSelection(): void {
    this.assertReady();
    this.selection.clear();
    this.markViews(UVPaintDirtyFlag.UVSelection);
  }

  invertSelection(): void {
    this.assertReady();
    this.selection.invert(this.topology());
    this.markViews(UVPaintDirtyFlag.UVSelection);
  }

  selectLinked(): void {
    this.assertReady();
    this.selection.selectLinked(this.topology());
    this.markViews(UVPaintDirtyFlag.UVSelection);
  }

  growSelection(): void {
    this.assertReady();
    this.selection.grow(this.topology());
    this.markViews(UVPaintDirtyFlag.UVSelection);
  }

  shrinkSelection(): void {
    this.assertReady();
    this.selection.shrink(this.topology());
    this.markViews(UVPaintDirtyFlag.UVSelection);
  }

  selectFrom3DFaces(faceIds: readonly FaceId[]): void {
    this.assertReady();
    this.selection.selectFrom3DFaces(this.topology(), faceIds);
    this.markViews(UVPaintDirtyFlag.UVSelection);
  }

  hoverAt(uv: readonly [number, number] | null, mode: UVSelectionMode = this.selection.mode): UVSelectionHit | null {
    this.assertReady();
    if (this.interaction.state === "transforming" || this.interaction.state === "box-selecting" || this.interaction.state === "lasso-selecting") {
      return null;
    }
    const view = this.primaryView();
    if (!uv) {
      this.interaction.transition("idle");
      view?.setHover(null);
      return null;
    }
    const hit = this.pickAt(uv, mode);
    this.interaction.transition(hit ? "hovering" : "idle");
    view?.setHover(hit);
    return hit;
  }

  pointerDown(
    uv: readonly [number, number],
    options: { readonly tool?: UVPointerTool; readonly modifiers?: UVPointerModifiers; readonly mode?: UVSelectionMode } = {},
  ): void {
    this.assertReady();
    if (this.transform.active) {
      this.cancelTransform();
    }
    this.cancelPointer();
    this.pointerTool = options.tool ?? "select";
    this.pointerOp = options.modifiers?.toggle ? "toggle" : options.modifiers?.add ? "add" : "replace";
    if (options.mode) {
      this.selection.mode = options.mode;
    }
    this.pressUv = uv;
    this.lassoPath = [uv];
    this.interaction.transition("pressed");
  }

  pointerMove(uv: readonly [number, number]): void {
    this.assertReady();
    if (this.interaction.state === "pressed" && this.pressUv) {
      const du = uv[0] - this.pressUv[0];
      const dv = uv[1] - this.pressUv[1];
      if (du * du + dv * dv > MARQUEE_EPSILON * MARQUEE_EPSILON) {
        this.interaction.transition(this.pointerTool === "lasso" ? "lasso-selecting" : "box-selecting");
      }
    }
    if (this.interaction.state === "lasso-selecting") {
      this.lassoPath.push(uv);
    }
    if (this.interaction.state === "box-selecting") {
      this.pressUv = this.pressUv ?? uv;
    }
  }

  pointerUp(uv: readonly [number, number]): void {
    this.assertReady();
    const mode = this.selection.mode;
    if (this.interaction.state === "box-selecting" && this.pressUv) {
      const ids = uvIdsInBox(this.topology(), mode, normalizeUvBox(this.pressUv, uv));
      this.interaction.transition("committing");
      this.selection.apply(this.topology(), { mode, operation: this.pointerOp, ids });
      this.finishPointer();
      return;
    }
    if (this.interaction.state === "lasso-selecting") {
      this.lassoPath.push(uv);
      const ids = uvIdsInPolygon(this.topology(), mode, this.lassoPath);
      this.interaction.transition("committing");
      this.selection.apply(this.topology(), { mode, operation: this.pointerOp, ids });
      this.finishPointer();
      return;
    }
    if (this.interaction.state === "pressed") {
      const hit = this.pickAt(uv, mode);
      this.interaction.transition("committing");
      if (hit) {
        this.selection.apply(this.topology(), { mode, operation: this.pointerOp, ids: [hit.id] });
      } else if (this.pointerOp === "replace") {
        this.selection.clear();
      }
      this.finishPointer();
      return;
    }
    this.cancelPointer();
  }

  cancelPointer(): void {
    if (this.disposed) {
      return;
    }
    const state = this.interaction.state;
    if (state === "pressed" || state === "box-selecting" || state === "lasso-selecting" || state === "hovering") {
      if (state === "box-selecting" || state === "lasso-selecting" || state === "pressed") {
        this.interaction.transition("cancelling");
      }
      this.interaction.reset();
    }
    this.pressUv = null;
    this.lassoPath = [];
  }

  beginTransform(request: UVTransformRequest): void {
    this.assertReady();
    this.cancelPointer();
    const corners = this.selection.selectedCornerIds(this.topology());
    this.interaction.transition("transforming");
    try {
      this.transformSession.begin(request, corners);
    } catch (error) {
      this.interaction.reset();
      throw error;
    }
  }

  updateTransform(delta: UVTransformDelta): void {
    this.assertReady();
    this.transformSession.update(delta);
    this.markViews(UVPaintDirtyFlag.UVPositions);
  }

  commitTransform() {
    this.assertReady();
    const result = this.transformSession.commit();
    this.interaction.reset();
    this.markViews(UVPaintDirtyFlag.UVPositions);
    return result;
  }

  cancelTransform(): void {
    if (this.disposed) {
      return;
    }
    this.transformSession.cancel();
    this.interaction.reset();
    this.markViews(UVPaintDirtyFlag.UVPositions);
  }

  setChannel(channelId: UVChannelId): void {
    this.assertReady();
    if (this.channelId === channelId) {
      return;
    }
    this.cancelTransform();
    this.channelId = channelId;
    this.transformSession.setChannel(channelId);
    this.markViews(UVPaintDirtyFlag.UVTopology | UVPaintDirtyFlag.UVPositions);
  }

  createViewAdapter(options: UVViewAdapterOptions = {}): UVViewAdapter {
    this.assertReady();
    const view = new UVViewAdapter(
      () => this.topology(),
      () => this.selection.snapshot(),
      this.textureResolution,
      {
        theme: this.theme,
        ...options,
        onDispose: () => {
          options.onDispose?.();
          this.views.delete(view);
        },
      },
    );
    this.views.add(view);
    return view;
  }

  addDisposable(unsubscribe: () => void): void {
    this.unsubscribers.push(unsubscribe);
  }

  notifyExternalMeshChange(): void {
    if (this.disposed || this.transform.active) {
      return;
    }
    this.cache.invalidateMesh(this.meshId);
    this.markViews(UVPaintDirtyFlag.UVTopology | UVPaintDirtyFlag.UVPositions | UVPaintDirtyFlag.Picking);
  }

  dispose(): void {
    if (this.resources.disposed) {
      return;
    }
    this.resources.dispose();
    this.transformSession.dispose();
    this.interaction.reset();
    for (const view of [...this.views]) {
      view.dispose();
    }
    this.views.clear();
    for (const unsubscribe of this.unsubscribers) {
      unsubscribe();
    }
    this.unsubscribers.length = 0;
    this.cache.dispose();
    this.pressUv = null;
    this.lassoPath = [];
  }

  private finishPointer(): void {
    this.markViews(UVPaintDirtyFlag.UVSelection | UVPaintDirtyFlag.UVVisuals);
    this.pressUv = null;
    this.lassoPath = [];
    this.interaction.reset();
  }

  private pickAt(uv: readonly [number, number], mode: UVSelectionMode): UVSelectionHit | null {
    const view = this.primaryView();
    if (view) {
      return view.pick(uv, mode);
    }
    return pickUv(this.topology(), uv, mode, this.theme, IDENTITY_UV_VIEW);
  }

  private primaryView(): UVViewAdapter | undefined {
    return this.views.values().next().value;
  }

  private markViews(flags: UVPaintDirtyFlag): void {
    for (const view of this.views) {
      view.mark(flags);
    }
  }

  private assertReady(): void {
    if (this.resources.isDisposed) {
      throw new Error("UVEditor is disposed");
    }
  }
}

export function asMeshId(id: string): MeshId {
  return brand(id);
}
