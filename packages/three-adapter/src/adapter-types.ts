import type { ModelingSession } from "@modeling-kit/commands";
import type { BufferGeometry, Camera, Material, Object3D, Scene } from "three";
import type { DeepPartial, SubElementDisplayOptions, SubElementVisualTheme } from "./sub-element";
import type { SpatialQueryBackend } from "./spatial-query/types";
import type { GpuPickingReadback } from "./gpu-picking";
import type { RenderMapping } from "./geometry";

export interface ViewportRenderer {
  setSize(width: number, height: number, updateStyle?: boolean): void;
  setPixelRatio(value: number): void;
}

export interface ThreeViewportAdapterOptions {
  readonly session: ModelingSession;
  readonly scene: Scene;
  readonly camera: Camera;
  readonly renderer: ViewportRenderer;
  readonly viewportId?: string;
  readonly autoFlush?: boolean;
  /** Optional object-level accelerator. Canonical picking remains CPU `Raycaster`. */
  readonly spatialQuery?: SpatialQueryBackend;
  /** When true, `dispose()` also disposes the provided spatial backend. Default false. */
  readonly ownsSpatialQuery?: boolean;
  /**
   * When `spatialQuery` is omitted, own a revision-aware AABB BVH.
   * Pointer moves do not rebuild it. Default true.
   */
  readonly spatialAcceleration?: boolean;
  /**
   * GPU ID-buffer backend. `"webgl"` uses a picking render target when the
   * host provides a `WebGLRenderer`. `"software"` is for tests. `"off"` keeps
   * CPU raycasting only. Default `"webgl"`.
   */
  readonly gpuPicking?: GpuPickingReadback | "off";
  readonly subElement?: {
    readonly theme?: DeepPartial<SubElementVisualTheme>;
    readonly display?: DeepPartial<SubElementDisplayOptions>;
  };
}

export interface TrackedObject {
  object: Object3D;
  geometry?: BufferGeometry;
  material?: Material | Material[];
  mapping?: RenderMapping;
  meshRevision?: number;
  materialKey?: string;
  poseKey?: string;
}

export interface SharedGeometry {
  geometry: BufferGeometry;
  mapping: RenderMapping;
  revision: number;
  topologyRevision: number;
  uvRevision: number;
  refs: number;
}
