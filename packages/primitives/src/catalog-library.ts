import { generateLibraryPrimitive } from "./library";
import type { PrimitiveCreateParams, PrimitiveGenerationContext, PrimitiveResult, PrimitiveType } from "./types";

const CATALOG_LIBRARY_TYPES = [
  "roundedRectangle",
  "stadium",
  "ellipse",
  "annulus",
  "superellipse",
  "squircle",
  "reuleux",
  "ellipsoid",
  "tetrahedron",
  "icosahedron",
] as const satisfies readonly PrimitiveType[];

type CatalogLibraryType = (typeof CATALOG_LIBRARY_TYPES)[number];

export function generateCatalogLibraryPrimitive(
  type: PrimitiveType,
  params: PrimitiveCreateParams,
  context: PrimitiveGenerationContext,
): PrimitiveResult | undefined {
  if (!isCatalogLibraryType(type)) {
    return undefined;
  }
  return generateLibraryPrimitive(type, params, context);
}

function isCatalogLibraryType(type: PrimitiveType): type is CatalogLibraryType {
  return (CATALOG_LIBRARY_TYPES as readonly string[]).includes(type);
}
