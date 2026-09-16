import type { FaceId, MeshId, VertexId } from "@modeling-kit/core";
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

export interface PrimitiveLibraryConversion {
  readonly renderVertexCount: number;
  readonly cellSize: 3 | 4;
  readonly hadNormals: boolean;
  readonly hadUvs: boolean;
  readonly sourceIndexToVertex: readonly VertexId[];
}

export interface PrimitiveResult {
  readonly type: string;
  readonly mesh: HalfEdgeMesh;
  readonly groups: PrimitiveFaceGroups;
  readonly library?: PrimitiveLibraryConversion;
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
  | "quadSphere"
  | "icosphere"
  | "torus"
  | "capsule"
  | "ramp"
  | "stairs"
  | "arch"
  | "wall"
  | "column"
  | "quad"
  | "rectangle"
  | "roundedRectangle"
  | "stadium"
  | "ellipse"
  | "annulus"
  | "superellipse"
  | "squircle"
  | "reuleux"
  | "roundedCube"
  | "ellipsoid"
  | "tetrahedron"
  | "icosahedron";

export interface BoxParameters {
  readonly width: number;
  readonly height: number;
  readonly depth: number;
  readonly segmentsX?: number;
  readonly segmentsY?: number;
  readonly segmentsZ?: number;
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

export interface QuadSphereParameters {
  readonly radius: number;
  readonly segments: number;
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

export interface QuadParameters {
  readonly scale: number;
}

export interface RectangleParameters {
  readonly width: number;
  readonly depth: number;
  readonly segmentsX: number;
  readonly segmentsZ: number;
}

export interface RoundedRectangleParameters {
  readonly width: number;
  readonly depth: number;
  readonly radius: number;
  readonly roundSegments: number;
  readonly edgeSegments: number;
}

export interface StadiumParameters {
  readonly width: number;
  readonly depth: number;
  readonly roundSegments: number;
  readonly edgeSegments: number;
}

export interface EllipseParameters {
  readonly radius: number;
  readonly radiusX: number;
  readonly radiusZ: number;
  readonly segments: number;
  readonly innerSegments: number;
  readonly theta: number;
  readonly thetaOffset: number;
  readonly mergeCentroid: boolean;
}

export interface AnnulusParameters {
  readonly radius: number;
  readonly innerRadius: number;
  readonly segments: number;
  readonly innerSegments: number;
  readonly theta: number;
  readonly thetaOffset: number;
}

export interface SuperellipseParameters {
  readonly radius: number;
  readonly radiusX: number;
  readonly radiusZ: number;
  readonly segments: number;
  readonly innerSegments: number;
  readonly m: number;
  readonly n: number;
  readonly theta: number;
  readonly thetaOffset: number;
  readonly mergeCentroid: boolean;
}

export interface SquircleParameters {
  readonly radius: number;
  readonly radiusX: number;
  readonly radiusZ: number;
  readonly segments: number;
  readonly innerSegments: number;
  readonly squareness: number;
  readonly theta: number;
  readonly thetaOffset: number;
  readonly mergeCentroid: boolean;
}

export interface ReuleuxParameters {
  readonly radius: number;
  readonly segments: number;
  readonly innerSegments: number;
  readonly sides: number;
  readonly theta: number;
  readonly thetaOffset: number;
  readonly mergeCentroid: boolean;
}

export interface RoundedCubeParameters {
  readonly width: number;
  readonly height: number;
  readonly depth: number;
  readonly radius: number;
  readonly roundSegments: number;
  readonly edgeSegments: number;
}

export interface EllipsoidParameters {
  readonly radius: number;
  readonly radiusX: number;
  readonly radiusY: number;
  readonly radiusZ: number;
  readonly widthSegments: number;
  readonly heightSegments: number;
}

export interface TetrahedronParameters {
  readonly radius: number;
}

export interface IcosahedronParameters {
  readonly radius: number;
}

export interface PrimitiveCreateParams {
  readonly name?: string;
  readonly width?: number;
  readonly height?: number;
  readonly depth?: number;
  readonly radius?: number;
  readonly innerRadius?: number;
  readonly outerRadius?: number;
  readonly tube?: number;
  readonly minorRadius?: number;
  readonly segments?: number;
  readonly radialSegments?: number;
  readonly heightSegments?: number;
  readonly widthSegments?: number;
  readonly capSegments?: number;
  readonly segmentsX?: number;
  readonly segmentsY?: number;
  readonly segmentsZ?: number;
  readonly tubularSegments?: number;
  readonly subdivisions?: number;
  readonly steps?: number;
  readonly capTop?: boolean;
  readonly capBottom?: boolean;
  readonly scale?: number;
  readonly nx?: number;
  readonly ny?: number;
  readonly nz?: number;
  readonly sx?: number;
  readonly sy?: number;
  readonly sz?: number;
  readonly innerSegments?: number;
  readonly roundSegments?: number;
  readonly edgeSegments?: number;
  readonly theta?: number;
  readonly thetaOffset?: number;
  readonly phi?: number;
  readonly phiOffset?: number;
  readonly radiusX?: number;
  readonly radiusY?: number;
  readonly radiusZ?: number;
  readonly rx?: number;
  readonly ry?: number;
  readonly rz?: number;
  readonly m?: number;
  readonly n?: number;
  readonly sides?: number;
  readonly squareness?: number;
  readonly mergeCentroid?: boolean;
  readonly radiusApex?: number;
}
