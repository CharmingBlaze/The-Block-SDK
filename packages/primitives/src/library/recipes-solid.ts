import {
  capsule,
  cone,
  cube,
  cylinder,
  ellipsoid,
  icosahedron,
  icosphere,
  roundedCube,
  sphere,
  tetrahedron,
  torus,
} from "primitive-geometry";
import type { PrimitiveCreateParams } from "../types";
import type { SolidGeometryId } from "./ids";
import { SOLID_CONVERT, TAU, type LibraryCall } from "./recipe-types";
import type { WeldPolicy } from "./weld-policy";

export function solidRecipe(kind: SolidGeometryId, params: PrimitiveCreateParams): LibraryCall {
  const width = params.width ?? params.sx ?? 1;
  const height = params.height ?? params.sy ?? width;
  const depth = params.depth ?? params.sz ?? width;
  const radius = params.radius ?? 0.5;
  switch (kind) {
    case "cube":
      return {
        geometry: cube({
          sx: width,
          sy: height,
          sz: depth,
          nx: params.nx ?? 1,
          ny: params.ny ?? 1,
          nz: params.nz ?? 1,
        }),
        convert: {
          ...SOLID_CONVERT,
          smooth: false,
          orientation: "outward-from-origin",
        },
      };
    case "roundedCube":
      return {
        geometry: roundedCube({
          sx: width,
          sy: height,
          sz: depth,
          nx: params.nx ?? 1,
          ny: params.ny ?? 1,
          nz: params.nz ?? 1,
          radius: params.radius ?? Math.min(width, height, depth) * 0.25,
          roundSegments: params.roundSegments ?? 8,
          edgeSegments: params.edgeSegments ?? 1,
        }),
        convert: { ...SOLID_CONVERT, smooth: true },
      };
    case "sphere":
      return uvSphereRecipe(sphere, params, radius);
    case "icosphere":
      return {
        geometry: icosphere({
          radius,
          subdivisions: params.subdivisions ?? 2,
        }),
        convert: { ...SOLID_CONVERT, smooth: true },
      };
    case "ellipsoid":
      return uvSphereRecipe(ellipsoid, params, params.radius ?? 1, {
        rx: params.radiusX ?? params.rx ?? 0.5,
        ry: params.radiusY ?? params.ry ?? 0.25,
        rz: params.radiusZ ?? params.rz ?? 0.25,
      });
    case "cylinder":
      return {
        geometry: cylinder({
          height: params.height ?? 1,
          radius: params.radius ?? 0.25,
          nx: params.radialSegments ?? params.nx ?? params.segments ?? 16,
          ny: params.heightSegments ?? params.ny ?? 1,
          radiusApex: params.radiusApex ?? params.radius ?? 0.25,
          capSegments: params.capSegments ?? 1,
          capApex: params.capTop ?? true,
          capBase: params.capBottom ?? true,
          phi: params.phi ?? TAU,
        }),
        convert: { ...SOLID_CONVERT, smooth: true, orientation: "outward-from-origin" },
      };
    case "cone":
      return {
        geometry: cone({
          height: params.height ?? 1,
          radius: params.radius ?? 0.25,
          nx: params.radialSegments ?? params.nx ?? params.segments ?? 16,
          ny: params.heightSegments ?? params.ny ?? 1,
          capSegments: params.capSegments ?? 1,
          capBase: params.capBottom ?? true,
          phi: params.phi ?? TAU,
        }),
        convert: { ...SOLID_CONVERT, smooth: true, orientation: "outward-from-origin" },
      };
    case "capsule":
      return {
        geometry: capsule({
          height: params.height ?? 0.5,
          radius: params.radius ?? 0.25,
          nx: params.radialSegments ?? params.nx ?? params.segments ?? 16,
          ny: params.heightSegments ?? params.ny ?? 1,
          roundSegments: params.roundSegments ?? params.capSegments ?? 16,
          phi: params.phi ?? TAU,
        }),
        convert: {
          ...SOLID_CONVERT,
          smooth: true,
          weld: capsuleGridWeld(params),
        },
      };
    case "torus":
      return {
        geometry: torus({
          radius: params.radius ?? 0.4,
          segments: params.tubularSegments ?? params.segments ?? 32,
          minorRadius: params.tube ?? params.minorRadius ?? 0.1,
          minorSegments: params.radialSegments ?? 16,
          theta: params.theta ?? TAU,
          thetaOffset: params.thetaOffset ?? 0,
          phi: params.phi ?? TAU,
          phiOffset: params.phiOffset ?? 0,
        }),
        convert: { ...SOLID_CONVERT, smooth: true, weld: torusGridWeld(params) },
      };
    case "tetrahedron":
      return {
        geometry: tetrahedron({ radius }),
        convert: { ...SOLID_CONVERT, smooth: false, orientation: "outward-from-origin" },
      };
    case "icosahedron":
      return {
        geometry: icosahedron({ radius }),
        convert: { ...SOLID_CONVERT, smooth: false, orientation: "outward-from-origin" },
      };
  }
}

function uvSphereRecipe(
  build: typeof sphere | typeof ellipsoid,
  params: PrimitiveCreateParams,
  radius: number,
  radii?: { rx: number; ry: number; rz: number },
): LibraryCall {
  const nx = params.widthSegments ?? params.nx ?? 32;
  const ny = params.heightSegments ?? params.ny ?? 16;
  const theta = params.theta ?? Math.PI;
  const phi = params.phi ?? TAU;
  const geometry =
    build === ellipsoid
      ? ellipsoid({
          radius,
          nx,
          ny,
          rx: radii?.rx ?? 0.5,
          ry: radii?.ry ?? 0.25,
          rz: radii?.rz ?? 0.25,
          theta,
          thetaOffset: params.thetaOffset ?? 0,
          phi,
          phiOffset: params.phiOffset ?? 0,
        })
      : sphere({
          radius,
          nx,
          ny,
          theta,
          thetaOffset: params.thetaOffset ?? 0,
          phi,
          phiOffset: params.phiOffset ?? 0,
        });
  return {
    geometry,
    convert: {
      ...SOLID_CONVERT,
      smooth: true,
      weld: {
        kind: "uv-grid",
        columns: nx + 1,
        rows: ny + 1,
        wrapU: phi >= TAU - 1e-6,
        wrapV: false,
        collapsePoles: theta >= Math.PI - 1e-6,
      },
    },
  };
}

function torusGridWeld(params: PrimitiveCreateParams): WeldPolicy {
  const segments = params.tubularSegments ?? params.segments ?? 32;
  const minorSegments = params.radialSegments ?? 16;
  const theta = params.theta ?? TAU;
  const phi = params.phi ?? TAU;
  return {
    kind: "uv-grid",
    columns: segments + 1,
    rows: minorSegments + 1,
    wrapU: phi >= TAU - 1e-6,
    wrapV: theta >= TAU - 1e-6,
    collapsePoles: false,
  };
}

function capsuleGridWeld(params: PrimitiveCreateParams): WeldPolicy {
  const nx = params.radialSegments ?? params.nx ?? params.segments ?? 16;
  const ny = params.heightSegments ?? params.ny ?? 1;
  const roundSegments = params.roundSegments ?? params.capSegments ?? 16;
  const phi = params.phi ?? TAU;
  const ringsBody = ny + 1;
  const ringsCap = roundSegments * 2;
  return {
    kind: "uv-grid",
    columns: nx,
    rows: ringsCap + ringsBody,
    wrapU: phi >= TAU - 1e-6,
    wrapV: false,
    collapsePoles: true,
  };
}
