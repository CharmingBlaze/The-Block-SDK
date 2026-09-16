import { SchemaError } from "@modeling-kit/core";
import type { ProfileDefinition, ProfileExtrudeParameters, ProfilePoint } from "./types";

export function validateProfile(profile: ProfileDefinition): void {
  if (profile.kind === "polygon") {
    requireLoop("outer", profile.outer, 3);
    for (const [index, hole] of (profile.holes ?? []).entries()) {
      requireLoop(`hole ${index}`, hole, 3);
    }
    return;
  }
  requireLoop("path", profile.outer, 2);
  if ((profile.holes?.length ?? 0) > 0) {
    throw new SchemaError("open paths cannot contain holes");
  }
}

export function validateExtrudeParameters(parameters: ProfileExtrudeParameters): void {
  validateProfile(parameters.profile);
  if (!(parameters.depth > 0) || !Number.isFinite(parameters.depth)) {
    throw new SchemaError("profile extrude depth must be a finite number greater than 0");
  }
  const bevelSize = parameters.bevelSize ?? 0;
  if (bevelSize < 0 || !Number.isFinite(bevelSize)) {
    throw new SchemaError("bevelSize must be a finite number >= 0");
  }
  const bevelSegments = parameters.bevelSegments ?? 2;
  if (!Number.isInteger(bevelSegments) || bevelSegments < 1) {
    throw new SchemaError("bevelSegments must be an integer >= 1");
  }
  if (parameters.profile.kind === "path") {
    const width = parameters.lineWidth ?? 0.1;
    if (!(width > 0) || !Number.isFinite(width)) {
      throw new SchemaError("path extrusion requires a positive lineWidth");
    }
  }
}

export function toLibraryPolygon(profile: ProfileDefinition): number[][][] {
  const rings = [profile.outer.map((p) => [p[0], p[1]])];
  for (const hole of profile.holes ?? []) {
    rings.push(hole.map((p) => [p[0], p[1]]));
  }
  return rings;
}

export function toLibraryPolyline(profile: ProfileDefinition): number[][] {
  return profile.outer.map((p) => [p[0], p[1]]);
}

function requireLoop(label: string, points: readonly ProfilePoint[], min: number): void {
  if (points.length < min) {
    throw new SchemaError(`${label} needs at least ${min} points`);
  }
  for (const point of points) {
    if (!Number.isFinite(point[0]) || !Number.isFinite(point[1])) {
      throw new SchemaError(`${label} requires finite coordinates`);
    }
  }
}
