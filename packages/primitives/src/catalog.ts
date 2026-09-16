import { SchemaError } from "@modeling-kit/core";
import {
  generateArch,
  generateColumn,
  generateRamp,
  generateStairs,
  generateWall,
} from "./architecture";
import { generateBox } from "./box";
import { generateDisc, generateGrid, generatePlane, generateQuad } from "./planar";
import { generateCapsule, generateCone, generateCylinder, generatePyramid } from "./solids";
import { generateIcosphere, generateTorus, generateUvSphere } from "./spheres";
import { generateQuadSphere } from "./quad-sphere";
import { canonicalizePrimitiveType } from "./aliases";
import { generateCatalogLibraryPrimitive } from "./catalog-library";
import { generateRoundedCube } from "./rounded-cube";
import type { PrimitiveCreateParams, PrimitiveGenerationContext, PrimitiveResult, PrimitiveType } from "./types";

export type { PrimitiveCreateParams } from "./types";

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
  quadSphere: "Quad Sphere",
  icosphere: "Icosphere",
  torus: "Torus",
  capsule: "Capsule",
  ramp: "Ramp",
  stairs: "Stairs",
  arch: "Arch",
  wall: "Wall",
  column: "Column",
  quad: "Quad",
  rectangle: "Rectangle",
  roundedRectangle: "Rounded Rectangle",
  stadium: "Stadium",
  ellipse: "Ellipse",
  annulus: "Annulus",
  superellipse: "Superellipse",
  squircle: "Squircle",
  reuleux: "Reuleaux",
  roundedCube: "Rounded Cube",
  ellipsoid: "Ellipsoid",
  tetrahedron: "Tetrahedron",
  icosahedron: "Icosahedron",
};

export function generatePrimitive(
  type: PrimitiveType | string,
  params: PrimitiveCreateParams = {},
  context: PrimitiveGenerationContext = {},
): PrimitiveResult {
  const kind = canonicalizePrimitiveType(type);
  switch (kind) {
    case "cube":
    case "box":
      return generateBox(
        {
          width: params.width ?? 1,
          height: params.height ?? 1,
          depth: params.depth ?? 1,
          segmentsX: params.segmentsX ?? params.nx ?? 1,
          segmentsY: params.segmentsY ?? params.ny ?? 1,
          segmentsZ: params.segmentsZ ?? params.nz ?? 1,
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
    case "quadSphere":
      return generateQuadSphere(
        {
          radius: params.radius ?? 0.5,
          segments: params.segments ?? params.widthSegments ?? params.nx ?? 4,
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
    case "quad":
      return generateQuad({ scale: params.scale ?? params.width ?? 1 }, context);
    case "rectangle":
      return generateGrid(
        {
          width: params.width ?? 1,
          depth: params.depth ?? params.height ?? 1,
          segmentsX: params.segmentsX ?? params.nx ?? 1,
          segmentsZ: params.segmentsZ ?? params.nz ?? 1,
        },
        context,
      );
    case "roundedCube":
      return generateRoundedCube(
        {
          width: params.width ?? 1,
          height: params.height ?? 1,
          depth: params.depth ?? 1,
          radius: params.radius ?? Math.min(params.width ?? 1, params.height ?? 1, params.depth ?? 1) * 0.15,
          roundSegments: params.roundSegments ?? 4,
          edgeSegments: params.edgeSegments ?? 1,
        },
        context,
      );
    default: {
      const fromLibrary = generateCatalogLibraryPrimitive(kind, params, context);
      if (fromLibrary) {
        return fromLibrary;
      }
      throw new SchemaError(`Unknown primitive type: ${String(type)}`);
    }
  }
}
