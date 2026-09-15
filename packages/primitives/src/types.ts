import type { FaceId, MeshId } from "@modeling-kit/core";
import type { CubeFaceIds, HalfEdgeMesh } from "@modeling-kit/mesh";

export interface PrimitiveValidationResult {
  readonly ok: boolean;
  readonly errors: readonly string[];
}

export interface PrimitiveGenerationContext {
  readonly meshId?: MeshId;
  readonly faceIds?: CubeFaceIds;
}

/** Semantic face buckets. Cube-axis ids are only set on the box primitive. */
export interface PrimitiveFaceGroups {
  readonly top: readonly FaceId[];
  readonly bottom: readonly FaceId[];
  readonly front: readonly FaceId[];
  readonly back: readonly FaceId[];
  readonly sides: readonly FaceId[];
  readonly caps: readonly FaceId[];
  readonly posX?: FaceId;
  readonly negX?: FaceId;
  readonly posY?: FaceId;
  readonly negY?: FaceId;
  readonly posZ?: FaceId;
  readonly negZ?: FaceId;
}

export interface PrimitiveResult {
  readonly type: string;
  readonly mesh: HalfEdgeMesh;
  readonly groups: PrimitiveFaceGroups;
}

export interface PrimitiveGenerator<TParameters> {
  readonly type: string;
  readonly defaults: Readonly<TParameters>;
  validate(parameters: TParameters): PrimitiveValidationResult;
  generate(parameters: TParameters, context?: PrimitiveGenerationContext): PrimitiveResult;
}

export type PrimitiveType =
  | "box"
  | "cube"
  | "plane"
  | "grid"
  | "disc"
  | "circle"
  | "cylinder"
  | "cone"
  | "pyramid"
  | "uvSphere"
  | "icosphere"
  | "torus"
  | "capsule"
  | "ramp"
  | "stairs"
  | "arch"
  | "wall"
  | "column";

export interface BoxParameters {
  readonly width: number;
  readonly height: number;
  readonly depth: number;
}

export interface PlaneParameters {
  readonly width: number;
  readonly depth: number;
}

export interface GridParameters {
  readonly width: number;
  readonly depth: number;
  readonly segmentsX: number;
  readonly segmentsZ: number;
}

export interface DiscParameters {
  readonly radius: number;
  readonly segments: number;
}

export interface CylinderParameters {
  readonly radius: number;
  readonly height: number;
  readonly radialSegments: number;
  readonly heightSegments: number;
  readonly capTop: boolean;
  readonly capBottom: boolean;
}

export interface ConeParameters {
  readonly radius: number;
  readonly height: number;
  readonly radialSegments: number;
  readonly heightSegments: number;
  readonly capBottom: boolean;
}

export interface PyramidParameters {
  readonly width: number;
  readonly depth: number;
  readonly height: number;
}

export interface UvSphereParameters {
  readonly radius: number;
  readonly widthSegments: number;
  readonly heightSegments: number;
}

export interface IcosphereParameters {
  readonly radius: number;
  readonly subdivisions: number;
}

export interface TorusParameters {
  readonly radius: number;
  readonly tube: number;
  readonly radialSegments: number;
  readonly tubularSegments: number;
}

export interface CapsuleParameters {
  readonly radius: number;
  readonly height: number;
  readonly radialSegments: number;
  readonly capSegments: number;
  readonly heightSegments: number;
}

export interface RampParameters {
  readonly width: number;
  readonly height: number;
  readonly depth: number;
}

export interface StairsParameters {
  readonly width: number;
  readonly height: number;
  readonly depth: number;
  readonly steps: number;
}

export interface ArchParameters {
  readonly innerRadius: number;
  readonly outerRadius: number;
  readonly depth: number;
  readonly segments: number;
}

export interface WallParameters {
  readonly width: number;
  readonly height: number;
  readonly depth: number;
}

export interface ColumnParameters {
  readonly radius: number;
  readonly height: number;
  readonly radialSegments: number;
}
