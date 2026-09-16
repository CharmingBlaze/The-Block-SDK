import { SchemaError } from "@modeling-kit/core";
import { triangulatePolygonLoops } from "@modeling-kit/mesh";
import type { ProfileDefinition } from "./types";

/** Reject self-intersecting or non-projectable polygons before calling geometry-extrude. */
export function rejectUnusablePolygon(profile: ProfileDefinition): void {
  if (profile.kind !== "polygon") {
    return;
  }
  const outer = profile.outer.map((p) => [p[0], 0, p[1]] as const);
  const holes = (profile.holes ?? []).map((hole) => hole.map((p) => [p[0], 0, p[1]] as const));
  const result = triangulatePolygonLoops(outer, holes, { rejectSelfIntersecting: true });
  if (result.status !== "ok") {
    throw new SchemaError(`profile polygon cannot be extruded (${result.status})`);
  }
}
