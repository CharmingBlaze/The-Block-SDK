import { SchemaError } from "@modeling-kit/core";
import type { PrimitiveGenerationContext, PrimitiveResult } from "../types";
import { convertSimplicialComplex } from "../library/convert";
import { geometryExtrudeApi } from "./import-api";
import { extrudeProfileArrays } from "./library";
import { strokePathToPolygon } from "./path-outline";
import type { ProfileDefinition, ProfileExtrudeParameters } from "./types";
import { rejectUnusablePolygon } from "./usable";
import { validateExtrudeParameters } from "./validate";

export function generateProfileExtrude(
  parameters: ProfileExtrudeParameters,
  context: PrimitiveGenerationContext = {},
): PrimitiveResult {
  validateExtrudeParameters(parameters);
  const polygon = polygonFromProfile(parameters);
  rejectUnusablePolygon(polygon);

  const arrays = extrudeProfileArrays(geometryExtrudeApi(), polygon, parameters);
  if (arrays.cells.length < 3 || arrays.positions.length < 9) {
    throw new SchemaError("profile extrude produced no geometry");
  }
  return convertSimplicialComplex(
    {
      positions: arrays.positions,
      cells: arrays.cells,
      ...(arrays.normals ? { normals: arrays.normals } : {}),
      ...(arrays.uvs ? { uvs: arrays.uvs } : {}),
    },
    {
      type: parameters.profile.kind === "path" ? "profile-path" : "profile-polygon",
      cellSize: 3,
      remapXyToXz: true,
      orientation: "preserve",
      weld: { kind: "solid" },
      ...(context.meshId ? { meshId: context.meshId } : {}),
    },
  );
}

function polygonFromProfile(parameters: ProfileExtrudeParameters): ProfileDefinition {
  if (parameters.profile.kind !== "path") {
    return parameters.profile;
  }
  return {
    kind: "polygon",
    outer: strokePathToPolygon(parameters.profile.outer, parameters.lineWidth ?? 0.1),
  };
}
