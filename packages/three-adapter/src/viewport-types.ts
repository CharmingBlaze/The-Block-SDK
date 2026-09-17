import type { ModelingSession } from "@modeling-kit/commands";
import {
  applyPointPickToSelection,
  type PointPickApplyMode,
  type PointPickRequest,
  type PointPickResult,
  type PickBackfaceMode,
  type ClickPickBackend,
  type HoverPickBackend,
  type SelectionIntent,
  type ToolPickResponse,
} from "@modeling-kit/selection";
import type { PerspectiveCamera, Scene, WebGLRenderer } from "three";
import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { ThreeViewportAdapter } from "./adapter";
import type { TexturePixelSource } from "./adapter-types";
import type { PickDomain, PickResult } from "./picking";
import type { KnifeOverlayState } from "./overlays/knife-overlay";
import type { ViewportDisplayController } from "./viewport-display-controller";
import type { ViewportRenderMode, ViewportRenderSettingsInput } from "./viewport-display-settings";
import type {
  DeepPartial,
  PointerPhase,
  SubElementDisplayOptions,
  SubElementVisualTheme,
} from "./sub-element";
import type {
  DeepPartialViewportNavigation,
  ViewportGestureController,
  ViewportGestureHooks,
} from "./viewport-gesture-types";

export interface ThreeViewportPickingOptions {
  readonly enabled?: boolean;
  readonly gpuPicking?: boolean;
  readonly xray?: boolean;
  readonly selectThrough?: boolean;
  readonly backfaceMode?: PickBackfaceMode;
  readonly clearOnEmptyReplace?: boolean;
  readonly refineSurfacePoint?: boolean;
  readonly clickBackend?: ClickPickBackend;
  readonly hoverBackend?: HoverPickBackend;
}

export interface ThreeViewportCameraOptions {
  readonly fov?: number;
  readonly near?: number;
  readonly far?: number;
  readonly position?: readonly [number, number, number];
}

export interface CreateThreeViewportOptions {
  readonly container: HTMLElement;
  readonly session: ModelingSession;
  readonly textureResolver?: (textureId: string) => TexturePixelSource | undefined;
  readonly grid?: boolean;
  readonly lighting?: "studio" | "none";
  readonly lights?: boolean;
  readonly camera?: ThreeViewportCameraOptions;
  readonly orbitControls?: boolean;
  readonly damping?: boolean;
  readonly autoResize?: boolean;
  readonly background?: number;
  /** Presentation-only shading/effect settings. Canonical document data is never changed. */
  readonly renderSettings?: ViewportRenderSettingsInput;
  /** @deprecated Use `renderSettings`. */
  readonly display?: ViewportRenderSettingsInput;
  /** Left-click picking into the session. Defaults to true. `false` attaches no handlers. */
  readonly picking?: boolean | ThreeViewportPickingOptions;
  readonly pickDomain?: PickDomain;
  readonly onSelect?: (hit: PointPickResult | null) => void;
  /**
   * Tools may swallow a click (`ToolPickResponse`). `{ consumed: true, beginDrag: true }`
   * captures via the gesture controller. Prefer `viewport.gestures.registerGizmo`.
   */
  readonly consumePick?: (hit: PointPickResult | null, pointer?: ViewportPointerLocation) => boolean | ToolPickResponse;
  /** Declarative OrbitControls button map. Defaults to left none, middle pan, right orbit. */
  readonly navigation?: DeepPartialViewportNavigation;
  /** Host pointer hooks. Run before the viewport assigns a gesture owner. */
  readonly gestureHooks?: ViewportGestureHooks;
  /**
   * Floor for OrbitControls.minDistance when picking is on. Default 2 (never below 0.5).
   */
  readonly minDistance?: number;
  /** When true, OrbitControls.zoomToCursor stays available. Default false. */
  readonly zoomToCursor?: boolean;
  /** Two-finger dolly/pan. Default false; touch never selects. */
  readonly touchNavigation?: boolean;
  readonly onHoverPick?: (hit: PickResult | null, pointer?: ViewportPointerLocation) => void;
  readonly resolvePickDomain?: () => PickDomain;
  readonly pickApplyMode?: PointPickApplyMode;
  readonly resolvePickApplyMode?: (event: PointerEvent) => PointPickApplyMode;
  readonly subElement?: {
    readonly theme?: DeepPartial<SubElementVisualTheme>;
    readonly display?: DeepPartial<SubElementDisplayOptions>;
  };
  /**
   * Own a revision-aware AABB BVH when `spatialQuery` is omitted.
   * Default true. See `ThreeViewportAdapterOptions.spatialAcceleration`.
   */
  readonly spatialAcceleration?: boolean;
}

export interface ViewportPointerLocation {
  readonly clientX: number;
  readonly clientY: number;
  readonly pointerId?: number;
}

export type ThreeViewportHandle = {
  readonly scene: Scene;
  readonly camera: PerspectiveCamera;
  readonly renderer: WebGLRenderer;
  readonly adapter: ThreeViewportAdapter;
  readonly controls: OrbitControls | undefined;
  readonly gestures: ViewportGestureController;
  readonly display: ViewportDisplayController;
  setRenderMode(mode: ViewportRenderMode): void;
  updateRenderSettings(settings: ViewportRenderSettingsInput): void;
  /** @deprecated Use `updateRenderSettings`. */
  setDisplaySettings(settings: ViewportRenderSettingsInput): void;
  /** Change cached component-overlay visibility without rebuilding topology. */
  setSubElementDisplay(settings: DeepPartial<SubElementDisplayOptions>): void;
  pickFromClient(clientX: number, clientY: number, domain?: PickDomain): PickResult | null;
  resolvePointPick(request: PointPickRequest): Promise<PointPickResult | undefined>;
  applyPointPick(result: PointPickResult | undefined, intent?: SelectionIntent): void;
  toMeshLocal(hit: PointPickResult | PickResult): [number, number, number] | undefined;
  setKnifePreview(state: KnifeOverlayState | null): void;
  pointerPhase(): PointerPhase;
  dispose(): void;
};

export type ThreeViewportController = ThreeViewportHandle;
export type ThreeViewportOptions = CreateThreeViewportOptions;

export function resolvedPickingOptions(
  picking: CreateThreeViewportOptions["picking"],
): ThreeViewportPickingOptions & { enabled: boolean } {
  if (picking === false) {
    return { enabled: false, hoverBackend: "cpu" };
  }
  if (picking === true || picking === undefined) {
    return { enabled: true, gpuPicking: true, hoverBackend: "cpu" };
  }
  return {
    enabled: picking.enabled !== false,
    gpuPicking: picking.gpuPicking !== false,
    hoverBackend: "cpu",
    ...(picking.xray !== undefined ? { xray: picking.xray } : {}),
    ...(picking.selectThrough !== undefined ? { selectThrough: picking.selectThrough } : {}),
    ...(picking.backfaceMode ? { backfaceMode: picking.backfaceMode } : {}),
    ...(picking.clearOnEmptyReplace !== undefined ? { clearOnEmptyReplace: picking.clearOnEmptyReplace } : {}),
    ...(picking.refineSurfacePoint !== undefined ? { refineSurfacePoint: picking.refineSurfacePoint } : {}),
    ...(picking.clickBackend ? { clickBackend: picking.clickBackend } : {}),
  };
}

export function applyViewportPointPick(
  session: ModelingSession,
  result: PointPickResult | undefined,
  intent: SelectionIntent = "replace",
): void {
  applyPointPickToSelection(session.selection, result, intent);
}
