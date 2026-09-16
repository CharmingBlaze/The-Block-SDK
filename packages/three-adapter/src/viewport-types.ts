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
import type { PickDomain, PickResult } from "./picking";
import type { KnifeOverlayState } from "./overlays/knife-overlay";
import type {
  DeepPartial,
  PointerPhase,
  SubElementDisplayOptions,
  SubElementVisualTheme,
} from "./sub-element";

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
  readonly grid?: boolean;
  readonly lighting?: "studio" | "none";
  readonly lights?: boolean;
  readonly camera?: ThreeViewportCameraOptions;
  readonly orbitControls?: boolean;
  readonly damping?: boolean;
  readonly autoResize?: boolean;
  readonly background?: number;
  /** Left-click picking into the session. Defaults to true. `false` attaches no handlers. */
  readonly picking?: boolean | ThreeViewportPickingOptions;
  readonly pickDomain?: PickDomain;
  readonly onSelect?: (hit: PointPickResult | null) => void;
  readonly consumePick?: (hit: PointPickResult | null) => boolean | ToolPickResponse;
  readonly onHoverPick?: (hit: PickResult | null) => void;
  readonly resolvePickDomain?: () => PickDomain;
  readonly pickApplyMode?: PointPickApplyMode;
  readonly resolvePickApplyMode?: (event: PointerEvent) => PointPickApplyMode;
  readonly subElement?: {
    readonly theme?: DeepPartial<SubElementVisualTheme>;
    readonly display?: DeepPartial<SubElementDisplayOptions>;
  };
}

export type ThreeViewportHandle = {
  readonly scene: Scene;
  readonly camera: PerspectiveCamera;
  readonly renderer: WebGLRenderer;
  readonly adapter: ThreeViewportAdapter;
  readonly controls: OrbitControls | undefined;
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
