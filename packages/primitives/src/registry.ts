import type { PrimitiveType } from "./types";

export type PrimitiveTopologyKind = "triangles" | "quads" | "mixed" | "polygonal";
export type PrimitivePurpose = "editable" | "reference" | "preview";
export type PrimitiveGeneratorKind = "canonical" | "library";

export interface PrimitiveCatalogEntry {
  readonly id: PrimitiveType;
  readonly topology: PrimitiveTopologyKind;
  readonly purpose: PrimitivePurpose;
  readonly generator: PrimitiveGeneratorKind;
}

function entry(
  id: PrimitiveType,
  topology: PrimitiveTopologyKind,
  generator: PrimitiveGeneratorKind,
  purpose: PrimitivePurpose,
): PrimitiveCatalogEntry {
  return { id, topology, generator, purpose };
}

/** Catalog metadata. Generation still goes through `generatePrimitive` / `generateLibraryPrimitive`. */
export const PRIMITIVE_CATALOG: Record<PrimitiveType, PrimitiveCatalogEntry> = {
  box: entry("box", "quads", "canonical", "editable"),
  cube: entry("cube", "quads", "canonical", "editable"),
  plane: entry("plane", "quads", "canonical", "editable"),
  grid: entry("grid", "quads", "canonical", "editable"),
  disc: entry("disc", "polygonal", "canonical", "editable"),
  circle: entry("circle", "polygonal", "canonical", "editable"),
  cylinder: entry("cylinder", "mixed", "canonical", "editable"),
  cone: entry("cone", "mixed", "canonical", "editable"),
  pyramid: entry("pyramid", "mixed", "canonical", "editable"),
  uvSphere: entry("uvSphere", "mixed", "canonical", "editable"),
  quadSphere: entry("quadSphere", "quads", "canonical", "editable"),
  icosphere: entry("icosphere", "triangles", "canonical", "editable"),
  torus: entry("torus", "quads", "canonical", "editable"),
  capsule: entry("capsule", "mixed", "canonical", "editable"),
  ramp: entry("ramp", "quads", "canonical", "editable"),
  stairs: entry("stairs", "mixed", "canonical", "editable"),
  arch: entry("arch", "mixed", "canonical", "editable"),
  wall: entry("wall", "quads", "canonical", "editable"),
  column: entry("column", "mixed", "canonical", "editable"),
  quad: entry("quad", "quads", "canonical", "editable"),
  rectangle: entry("rectangle", "quads", "canonical", "editable"),
  roundedRectangle: entry("roundedRectangle", "triangles", "library", "reference"),
  stadium: entry("stadium", "triangles", "library", "reference"),
  ellipse: entry("ellipse", "triangles", "library", "reference"),
  annulus: entry("annulus", "triangles", "library", "reference"),
  superellipse: entry("superellipse", "triangles", "library", "reference"),
  squircle: entry("squircle", "triangles", "library", "reference"),
  reuleux: entry("reuleux", "triangles", "library", "reference"),
  roundedCube: entry("roundedCube", "quads", "canonical", "editable"),
  ellipsoid: entry("ellipsoid", "triangles", "library", "reference"),
  tetrahedron: entry("tetrahedron", "triangles", "library", "reference"),
  icosahedron: entry("icosahedron", "triangles", "library", "reference"),
};

export function getPrimitiveCatalogEntry(type: PrimitiveType): PrimitiveCatalogEntry {
  return PRIMITIVE_CATALOG[type];
}

export function isCanonicalEditablePrimitive(type: PrimitiveType): boolean {
  const item = PRIMITIVE_CATALOG[type];
  return item.generator === "canonical" && item.purpose === "editable";
}
