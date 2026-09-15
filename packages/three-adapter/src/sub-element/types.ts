import type { EdgeId, FaceId, ObjectId, VertexId } from "@modeling-kit/core";
import type { BufferGeometry, Material } from "three";

export type ElementVisualState =
  | "default"
  | "hovered"
  | "selected"
  | "active"
  | "disabled"
  | "locked"
  | "hidden";

export type ElementDomain = "vertex" | "edge" | "face";

export type VertexMarkerStyle =
  | "cube"
  | "sphere"
  | "square-sprite"
  | "circle-sprite"
  | "custom"
  | "hidden";

export type EdgeLineStyle = "solid" | "screen-space" | "dashed" | "hidden";

export type FaceOverlayStyle =
  | "fill"
  | "solid"
  | "tint"
  | "outline"
  | "fill-outline"
  | "wireframe"
  | "hidden";

export type EdgeRole = "interior" | "boundary" | "seam" | "sharp" | "crease";

export interface ColorOpacity {
  readonly color: number;
  readonly opacity: number;
}

export interface VertexStateStyle extends ColorOpacity {
  readonly outlineColor?: number;
  readonly outlineWidth?: number;
  readonly scale?: number;
}

export interface EdgeStateStyle extends ColorOpacity {
  readonly width?: number;
  readonly dashSize?: number;
  readonly gapSize?: number;
}

export interface FaceStateStyle extends ColorOpacity {
  readonly outlineColor?: number;
  readonly outlineWidth?: number;
}

export interface VertexVisualTheme {
  readonly style: VertexMarkerStyle;
  readonly pixelSize: number;
  readonly minPixelSize: number;
  readonly maxPixelSize: number;
  readonly depthTest: boolean;
  readonly xray: boolean;
  readonly outline: boolean;
  readonly pickPixelPadding: number;
  readonly states: Record<ElementVisualState, VertexStateStyle>;
}

export interface EdgeVisualTheme {
  readonly style: EdgeLineStyle;
  readonly width: number;
  readonly pickWidth: number;
  readonly depthTest: boolean;
  readonly xray: boolean;
  readonly roles: Record<EdgeRole, ColorOpacity>;
  readonly states: Record<ElementVisualState, EdgeStateStyle>;
}

export interface FaceVisualTheme {
  readonly style: FaceOverlayStyle;
  readonly depthTest: boolean;
  readonly xray: boolean;
  readonly frontFaceOnly: boolean;
  readonly states: Record<ElementVisualState, FaceStateStyle>;
}

export interface SubElementVisualTheme {
  readonly vertices: VertexVisualTheme;
  readonly edges: EdgeVisualTheme;
  readonly faces: FaceVisualTheme;
}

export interface SubElementLodOptions {
  readonly maxVertices: number;
  readonly maxEdges: number;
  readonly maxFaces: number;
  readonly strategy: "all" | "stride" | "selection-only";
}

export interface SubElementLODPolicy {
  readonly fullDetailVertexLimit: number;
  readonly fullDetailEdgeLimit: number;
  readonly selectionOnlyVertexLimit: number;
  readonly selectionOnlyEdgeLimit: number;
  readonly distantVertexMode: "all" | "selected-only" | "hovered-and-selected" | "hidden";
  readonly distantEdgeMode: "all" | "boundary-and-selected" | "selected-only" | "hidden";
}

export interface SubElementDisplayOptions {
  readonly enabled: boolean;
  readonly editMode: boolean;
  readonly showVertices: boolean | "domain";
  readonly showEdges: boolean | "domain";
  readonly showFaces: boolean | "states";
  readonly lod: SubElementLodOptions;
}

export interface CustomVertexMarker {
  readonly geometry: BufferGeometry;
  readonly material: Material;
}

export interface ElementIdSets {
  readonly hovered?: string | null;
  readonly selected: ReadonlySet<string>;
  readonly active?: string | null;
  readonly disabled: ReadonlySet<string>;
  readonly locked: ReadonlySet<string>;
  readonly hidden: ReadonlySet<string>;
}

export interface SubElementHover {
  readonly objectId: ObjectId;
  readonly domain: ElementDomain;
  readonly elementId: VertexId | EdgeId | FaceId;
}

export interface ScreenSpaceCamera {
  readonly isPerspectiveCamera?: boolean;
  readonly isOrthographicCamera?: boolean;
  readonly fov?: number;
  readonly zoom?: number;
  readonly top?: number;
  readonly bottom?: number;
}

export type DeepPartial<T> = {
  readonly [K in keyof T]?: T[K] extends readonly (infer U)[]
    ? readonly U[]
    : T[K] extends object
      ? DeepPartial<T[K]>
      : T[K];
};
