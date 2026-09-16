import type { ConvertSimplicialOptions, SimplicialComplexInput } from "./convert-types";

export const TAU = Math.PI * 2;

export interface LibraryCall {
  readonly geometry: SimplicialComplexInput;
  readonly convert: ConvertSimplicialOptions;
}

export const PLANAR_CONVERT: ConvertSimplicialOptions = {
  remapXyToXz: true,
  orientation: "positive-y",
  cellSize: 3,
  smooth: false,
  weld: { kind: "connected-coincident" },
};

export const SOLID_CONVERT: ConvertSimplicialOptions = {
  remapXyToXz: false,
  orientation: "preserve",
  cellSize: 3,
  weld: { kind: "solid" },
};
