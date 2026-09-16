import {
  annulus,
  disc,
  ellipse,
  plane,
  quad,
  reuleux,
  roundedRectangle,
  squircle,
  stadium,
  superellipse,
} from "primitive-geometry";
import type { PrimitiveCreateParams } from "../types";
import type { PlanarGeometryId } from "./ids";
import { PLANAR_CONVERT, TAU, type LibraryCall } from "./recipe-types";

export function planarRecipe(kind: PlanarGeometryId, params: PrimitiveCreateParams): LibraryCall {
  const width = params.width ?? params.sx ?? 1;
  const height = params.height ?? params.sy ?? width;
  const radius = params.radius ?? 0.5;
  switch (kind) {
    case "quad":
      return { geometry: quad({ scale: params.scale ?? radius }), convert: { ...PLANAR_CONVERT, cellSize: 3 } };
    case "rectangle":
      return {
        geometry: plane({
          sx: params.width ?? 1,
          sy: params.depth ?? params.height ?? 1,
          nx: params.segmentsX ?? params.nx ?? 1,
          ny: params.segmentsZ ?? params.ny ?? 1,
          direction: "y",
          quads: true,
        }),
        convert: { remapXyToXz: false, orientation: "positive-y", cellSize: 4, smooth: false, weld: { kind: "connected-coincident" } },
      };
    case "roundedRectangle":
      return {
        geometry: roundedRectangle({
          sx: width,
          sy: params.depth ?? height,
          nx: params.nx ?? 1,
          ny: params.ny ?? 1,
          radius: params.radius ?? width * 0.25,
          roundSegments: params.roundSegments ?? 8,
          edgeSegments: params.edgeSegments ?? 1,
        }),
        convert: PLANAR_CONVERT,
      };
    case "stadium":
      return {
        geometry: stadium({
          sx: params.width ?? 1,
          sy: params.depth ?? 0.5,
          nx: params.nx ?? 1,
          ny: params.ny ?? 1,
          roundSegments: params.roundSegments ?? 8,
          edgeSegments: params.edgeSegments ?? 1,
        }),
        convert: PLANAR_CONVERT,
      };
    case "ellipse":
      return {
        geometry: ellipse({
          sx: params.radiusX ?? params.rx ?? 1,
          sy: params.radiusZ ?? params.rz ?? 0.5,
          radius,
          segments: params.segments ?? 32,
          innerSegments: params.innerSegments ?? 16,
          theta: params.theta ?? TAU,
          thetaOffset: params.thetaOffset ?? 0,
          mergeCentroid: params.mergeCentroid ?? true,
        }),
        convert: PLANAR_CONVERT,
      };
    case "disc":
      return {
        geometry: disc({
          radius,
          segments: params.segments ?? 32,
          innerSegments: params.innerSegments ?? 16,
          theta: params.theta ?? TAU,
          thetaOffset: params.thetaOffset ?? 0,
          mergeCentroid: params.mergeCentroid ?? true,
        }),
        convert: PLANAR_CONVERT,
      };
    case "annulus":
      return {
        geometry: annulus({
          sx: params.radiusX ?? params.rx ?? 1,
          sy: params.radiusZ ?? params.rz ?? 1,
          radius,
          innerRadius: params.innerRadius ?? radius * 0.5,
          segments: params.segments ?? 32,
          innerSegments: params.innerSegments ?? 16,
          theta: params.theta ?? TAU,
          thetaOffset: params.thetaOffset ?? 0,
        }),
        convert: PLANAR_CONVERT,
      };
    case "superellipse":
      return {
        geometry: superellipse({
          sx: params.radiusX ?? params.rx ?? 1,
          sy: params.radiusZ ?? params.rz ?? 0.5,
          radius,
          segments: params.segments ?? 32,
          innerSegments: params.innerSegments ?? 16,
          theta: params.theta ?? TAU,
          thetaOffset: params.thetaOffset ?? 0,
          mergeCentroid: params.mergeCentroid ?? true,
          m: params.m ?? 2,
          n: params.n ?? 2,
        }),
        convert: PLANAR_CONVERT,
      };
    case "squircle":
      return {
        geometry: squircle({
          sx: params.radiusX ?? params.rx ?? 1,
          sy: params.radiusZ ?? params.rz ?? 1,
          radius,
          segments: params.segments ?? 64,
          innerSegments: params.innerSegments ?? 16,
          theta: params.theta ?? TAU,
          thetaOffset: params.thetaOffset ?? 0,
          mergeCentroid: params.mergeCentroid ?? true,
          squareness: params.squareness ?? 0.95,
        }),
        convert: PLANAR_CONVERT,
      };
    case "reuleux":
      return {
        geometry: reuleux({
          radius,
          segments: params.segments ?? 32,
          innerSegments: params.innerSegments ?? 16,
          theta: params.theta ?? TAU,
          thetaOffset: params.thetaOffset ?? 0,
          mergeCentroid: params.mergeCentroid ?? true,
          n: params.sides ?? params.n ?? 3,
        }),
        convert: PLANAR_CONVERT,
      };
  }
}
