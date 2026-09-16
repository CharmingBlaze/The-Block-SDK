import { SchemaError } from "@modeling-kit/core";
import { strokePathToPolygon } from "./path-outline";
import type { ProfileDefinition, ProfileExtrudeParameters } from "./types";
import { toLibraryPolygon } from "./validate";

export interface LibraryExtrudeArrays {
  readonly positions: Float32Array;
  readonly normals: Float32Array | undefined;
  readonly uvs: Float32Array | undefined;
  readonly cells: Uint16Array | Uint32Array;
}

export interface GeometryExtrudeResult {
  readonly indices: Uint16Array | Uint32Array;
  readonly position: Float32Array;
  readonly normal: Float32Array;
  readonly uv: Float32Array;
}

export interface GeometryExtrudeApi {
  readonly extrudePolygon: (
    polygons: ArrayLike<ArrayLike<ArrayLike<ArrayLike<number>>>>,
    opts: Record<string, unknown>,
  ) => GeometryExtrudeResult;
}

export function resolveGeometryExtrude(mod: unknown): GeometryExtrudeApi {
  const record = mod as {
    readonly extrudePolygon?: unknown;
    readonly default?: { readonly extrudePolygon?: unknown };
  };
  const candidate = typeof record.extrudePolygon === "function" ? record : record.default;
  if (typeof candidate?.extrudePolygon !== "function") {
    throw new SchemaError("geometry-extrude export is missing extrudePolygon");
  }
  return candidate as GeometryExtrudeApi;
}

export function extrudeProfileArrays(
  api: GeometryExtrudeApi,
  profile: ProfileDefinition,
  parameters: ProfileExtrudeParameters,
): LibraryExtrudeArrays {
  const opts: Record<string, unknown> = {
    depth: parameters.depth,
    excludeBottom: parameters.caps === false,
  };
  if ((parameters.bevelSize ?? 0) > 0) {
    opts.bevelSize = parameters.bevelSize;
    opts.bevelSegments = parameters.bevelSegments ?? 2;
  }
  if (parameters.smoothSide === true) {
    opts.smoothSide = true;
  }
  try {
    const polygon =
      profile.kind === "path"
        ? { kind: "polygon" as const, outer: strokePathToPolygon(profile.outer, parameters.lineWidth ?? 0.1) }
        : profile;
    const result = api.extrudePolygon([toLibraryPolygon(polygon)], opts);
    return {
      positions: result.position,
      normals: finiteOrOmit(result.normal),
      uvs: finiteOrOmit(result.uv),
      cells: result.indices,
    };
  } catch (error) {
    if (error instanceof SchemaError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : "unknown error";
    throw new SchemaError(`geometry-extrude failed: ${message}`);
  }
}

function finiteOrOmit(values: Float32Array | undefined): Float32Array | undefined {
  if (!values || values.length === 0) {
    return undefined;
  }
  for (let i = 0; i < values.length; i++) {
    if (!Number.isFinite(values[i])) {
      return undefined;
    }
  }
  return values;
}
