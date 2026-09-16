import { integerAtLeast, positive } from "../shared";
import type { PrimitiveCreateParams, PrimitiveValidationResult } from "../types";
import type { LibraryGeometryId } from "./ids";

function finitePositive(name: string, value: number | undefined, errors: string[]): void {
  if (value === undefined) {
    return;
  }
  positive(name, value, errors);
}

function finiteInteger(name: string, value: number | undefined, min: number, errors: string[]): void {
  if (value === undefined) {
    return;
  }
  integerAtLeast(name, value, min, errors);
}

function finiteNumber(name: string, value: number | undefined, errors: string[]): void {
  if (value === undefined) {
    return;
  }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    errors.push(`${name} must be a finite number`);
  }
}

export function validateLibraryParameters(
  kind: LibraryGeometryId,
  params: PrimitiveCreateParams,
): PrimitiveValidationResult {
  const errors: string[] = [];
  finitePositive("width", params.width, errors);
  finitePositive("height", params.height, errors);
  finitePositive("depth", params.depth, errors);
  finitePositive("radius", params.radius, errors);
  finitePositive("innerRadius", params.innerRadius, errors);
  finitePositive("tube", params.tube, errors);
  finitePositive("scale", params.scale, errors);
  finitePositive("radiusX", params.radiusX ?? params.rx, errors);
  finitePositive("radiusY", params.radiusY ?? params.ry, errors);
  finitePositive("radiusZ", params.radiusZ ?? params.rz, errors);
  finiteInteger("segments", params.segments, 3, errors);
  finiteInteger("radialSegments", params.radialSegments, 3, errors);
  finiteInteger("widthSegments", params.widthSegments, 3, errors);
  finiteInteger("heightSegments", params.heightSegments, 1, errors);
  finiteInteger("innerSegments", params.innerSegments, 1, errors);
  finiteInteger("roundSegments", params.roundSegments, 1, errors);
  finiteInteger("edgeSegments", params.edgeSegments, 1, errors);
  finiteInteger("subdivisions", params.subdivisions, 0, errors);
  finiteInteger("nx", params.nx, 1, errors);
  finiteInteger("ny", params.ny, 1, errors);
  finiteInteger("nz", params.nz, 1, errors);
  finiteInteger("segmentsX", params.segmentsX, 1, errors);
  finiteInteger("segmentsZ", params.segmentsZ, 1, errors);
  finiteInteger("tubularSegments", params.tubularSegments, 3, errors);
  finiteInteger("capSegments", params.capSegments, 1, errors);
  finiteInteger("sides", params.sides, 3, errors);
  finiteNumber("theta", params.theta, errors);
  finiteNumber("thetaOffset", params.thetaOffset, errors);
  finiteNumber("phi", params.phi, errors);
  finiteNumber("phiOffset", params.phiOffset, errors);
  finitePositive("m", params.m, errors);
  finitePositive("n", params.n, errors);
  finitePositive("squareness", params.squareness, errors);
  if (params.theta !== undefined && params.theta <= 0) {
    errors.push("theta must be greater than 0");
  }
  if (params.phi !== undefined && params.phi <= 0) {
    errors.push("phi must be greater than 0");
  }
  if (params.squareness !== undefined && params.squareness > 1) {
    errors.push("squareness must be <= 1");
  }
  if (kind === "annulus") {
    const outer = params.radius ?? 0.5;
    const inner = params.innerRadius ?? outer * 0.5;
    if (inner >= outer) {
      errors.push("innerRadius must be less than radius");
    }
  }
  if (kind === "roundedCube" || kind === "roundedRectangle") {
    const width = params.width ?? 1;
    const height = params.height ?? params.depth ?? width;
    const radius = params.radius ?? width * 0.25;
    if (radius >= Math.min(width, height) / 2) {
      errors.push("radius must be smaller than half the shortest side");
    }
  }
  return { ok: errors.length === 0, errors };
}
