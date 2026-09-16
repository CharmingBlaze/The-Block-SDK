import { requireValid } from "../shared";
import type { PrimitiveCreateParams, PrimitiveGenerationContext, PrimitiveResult } from "../types";
import { convertSimplicialComplex } from "./convert";
import { isPlanarGeometry, type LibraryGeometryId } from "./ids";
import { planarRecipe } from "./recipes-planar";
import { solidRecipe } from "./recipes-solid";
import { validateLibraryParameters } from "./validate";

export function generateLibraryPrimitive(
  kind: LibraryGeometryId,
  params: PrimitiveCreateParams = {},
  context: PrimitiveGenerationContext = {},
): PrimitiveResult {
  requireValid(validateLibraryParameters(kind, params), kind);
  const recipe = isPlanarGeometry(kind) ? planarRecipe(kind, params) : solidRecipe(kind, params);
  return convertSimplicialComplex(recipe.geometry, {
    ...recipe.convert,
    type: kind,
    ...(context.meshId ? { meshId: context.meshId } : {}),
  });
}
