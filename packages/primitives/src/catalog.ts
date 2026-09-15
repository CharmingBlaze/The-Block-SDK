import { SchemaError } from "@modeling-kit/core";
import {
  generateArch,
  generateColumn,
  generateRamp,
  generateStairs,
  generateWall,
} from "./architecture";
import { generateBox } from "./box";
import { generateDisc, generateGrid, generatePlane } from "./planar";
import { generateCapsule, generateCone, generateCylinder, generatePyramid } from "./solids";
import { generateIcosphere, generateTorus, generateUvSphere } from "./spheres";
import { canonicalizePrimitiveType } from "./aliases";
import type { PrimitiveGenerationContext, PrimitiveResult, PrimitiveType } from "./types";

export interface PrimitiveCreateParams {
  readonly name?: string;
  readonly width?: number;
  readonly height?: number;
  readonly depth?: number;
  readonly radius?: number;
  readonly innerRadius?: number;
  readonly outerRadius?: number;
  readonly tube?: number;
  readonly segments?: number;
  readonly radialSegments?: number;
  readonly heightSegments?: number;
  readonly widthSegments?: number;
  readonly capSegments?: number;
  readonly segmentsX?: number;
  readonly segmentsZ?: number;
  readonly tubularSegments?: number;
  readonly subdivisions?: number;
  readonly steps?: number;
  readonly capTop?: boolean;
  readonly capBottom?: boolean;
}

export const primitiveDisplayNames: Record<PrimitiveType, string> = {
  box: "Cube",
  cube: "Cube",
  plane: "Plane",
  grid: "Grid",
  disc: "Disc",
  circle: "Circle",
  cylinder: "Cylinder",
  cone: "Cone",
  pyramid: "Pyramid",
  uvSphere: "UV Sphere",
  icosphere: "Icosphere",
  torus: "Torus",
  capsule: "Capsule",
  ramp: "Ramp",
  stairs: "Stairs",
  arch: "Arch",
  wall: "Wall",
  column: "Column",
};

export function generatePrimitive(
  type: PrimitiveType | string,
  params: PrimitiveCreateParams = {},
  context: PrimitiveGenerationContext = {},
): PrimitiveResult {
  switch (canonicalizePrimitiveType(type)) {
    case "cube":
    case "box":
      return generateBox(
        {
          width: params.width ?? 1,
          height: params.height ?? 1,
          depth: params.depth ?? 1,
        },
        context,
      );
    case "plane":
      return generatePlane({ width: params.width ?? 1, depth: params.depth ?? params.height ?? 1 }, context);
    case "grid":
      return generateGrid(
        {
          width: params.width ?? 1,
          depth: params.depth ?? 1,
          segmentsX: params.segmentsX ?? params.segments ?? 2,
          segmentsZ: params.segmentsZ ?? params.segments ?? 2,
        },
        context,
      );
    case "disc":
    case "circle":
      return generateDisc(
        { radius: params.radius ?? 0.5, segments: params.segments ?? params.radialSegments ?? 16 },
        context,
      );
    case "cylinder":
      return generateCylinder(
        {
          radius: params.radius ?? 0.5,
          height: params.height ?? 1,
          radialSegments: params.radialSegments ?? params.segments ?? 16,
          heightSegments: params.heightSegments ?? 1,
          capTop: params.capTop ?? true,
          capBottom: params.capBottom ?? true,
        },
        context,
      );
    case "cone":
      return generateCone(
        {
          radius: params.radius ?? 0.5,
          height: params.height ?? 1,
          radialSegments: params.radialSegments ?? params.segments ?? 16,
          heightSegments: params.heightSegments ?? 1,
          capBottom: params.capBottom ?? true,
        },
        context,
      );
    case "pyramid":
      return generatePyramid(
        {
          width: params.width ?? 1,
          depth: params.depth ?? 1,
          height: params.height ?? 1,
        },
        context,
      );
    case "uvSphere":
      return generateUvSphere(
        {
          radius: params.radius ?? 0.5,
          widthSegments: params.widthSegments ?? params.radialSegments ?? params.segments ?? 16,
          heightSegments: params.heightSegments ?? 12,
        },
        context,
      );
    case "icosphere":
      return generateIcosphere(
        { radius: params.radius ?? 0.5, subdivisions: params.subdivisions ?? 1 },
        context,
      );
    case "torus":
      return generateTorus(
        {
          radius: params.radius ?? 0.5,
          tube: params.tube ?? 0.2,
          radialSegments: params.radialSegments ?? 12,
          tubularSegments: params.tubularSegments ?? params.segments ?? 24,
        },
        context,
      );
    case "capsule":
      return generateCapsule(
        {
          radius: params.radius ?? 0.5,
          height: params.height ?? 1,
          radialSegments: params.radialSegments ?? params.segments ?? 16,
          capSegments: params.capSegments ?? 8,
          heightSegments: params.heightSegments ?? 1,
        },
        context,
      );
    case "ramp":
      return generateRamp(
        {
          width: params.width ?? 1,
          height: params.height ?? 1,
          depth: params.depth ?? 1,
        },
        context,
      );
    case "stairs":
      return generateStairs(
        {
          width: params.width ?? 1,
          height: params.height ?? 1,
          depth: params.depth ?? 1,
          steps: params.steps ?? 4,
        },
        context,
      );
    case "arch":
      return generateArch(
        {
          innerRadius: params.innerRadius ?? 0.5,
          outerRadius: params.outerRadius ?? 1,
          depth: params.depth ?? 0.5,
          segments: params.segments ?? 12,
        },
        context,
      );
    case "wall":
      return generateWall(
        {
          width: params.width ?? 2,
          height: params.height ?? 2,
          depth: params.depth ?? 0.25,
        },
        context,
      );
    case "column":
      return generateColumn(
        {
          radius: params.radius ?? 0.25,
          height: params.height ?? 2,
          radialSegments: params.radialSegments ?? params.segments ?? 16,
        },
        context,
      );
    default:
      throw new SchemaError(`Unknown primitive type: ${String(type)}`);
  }
}
