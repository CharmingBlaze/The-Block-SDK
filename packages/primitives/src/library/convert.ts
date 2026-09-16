import { SchemaError, type FaceId } from "@modeling-kit/core";
import { MeshBuilder } from "@modeling-kit/mesh";
import { finalizePrimitive } from "../shared";
import { facesFromFlatCells } from "../source/from-cells";
import type { GeometryBuildWarning } from "../source/types";
import { computeBounds, hasAttribute } from "./attributes";
import { buildCell, resolveCellSize } from "./cells";
import type {
  CellSpec,
  ConvertedPrimitive,
  ConvertSimplicialOptions,
  SimplicialComplexInput,
} from "./convert-types";
import { addConvertedFaces } from "./faces";
import { groupFaces } from "./groups";
import { orientCell } from "./orient";
import { markUvSeams } from "./seams";
import { weldSourceVertices } from "./weld";
import { resolveWeldPolicy } from "./weld-policy";

export type {
  ConvertedPrimitive,
  ConvertSimplicialOptions,
  SimplicialComplexInput,
} from "./convert-types";

export function convertSimplicialComplex(
  geometry: SimplicialComplexInput,
  options: ConvertSimplicialOptions = {},
): ConvertedPrimitive {
  const type = options.type ?? "library";
  const positions = geometry.positions;
  if (positions.length < 9 || positions.length % 3 !== 0) {
    throw new SchemaError(`${type}: positions length must be a multiple of 3 and at least 9`);
  }
  const renderVertexCount = positions.length / 3;
  for (let i = 0; i < positions.length; i++) {
    if (!Number.isFinite(positions[i])) {
      throw new SchemaError(`${type}: positions must be finite`);
    }
  }

  const remap = options.remapXyToXz === true;
  const hadNormals = hasAttribute(geometry.normals, renderVertexCount * 3, `${type}: normals`);
  const hadUvs = hasAttribute(geometry.uvs, renderVertexCount * 2, `${type}: uvs`);
  const cellSize = resolveCellSize(geometry.cells, options.cellSize, type);
  const recipe = facesFromFlatCells(geometry.cells, cellSize, type);
  const skipDegenerate = options.skipDegenerateFaces !== false;
  if (recipe.skipped.length > 0 && !skipDegenerate) {
    throw new SchemaError(recipe.skipped[0]!.message);
  }
  const sourceFaces = recipe.faces;
  for (const face of sourceFaces) {
    for (const index of face.indices) {
      if (!Number.isInteger(index) || index < 0 || index >= renderVertexCount) {
        throw new SchemaError(`${type}: cell index ${String(index)} is out of range`);
      }
    }
  }

  const bounds = computeBounds(positions, remap);
  const builder = new MeshBuilder(options.meshId);
  const policy = resolveWeldPolicy(type, geometry, options.weld);
  const sourceIndexToVertex = weldSourceVertices(
    builder,
    positions,
    geometry.cells,
    cellSize,
    remap,
    policy,
  );

  const cells: CellSpec[] = [];
  const skipped: GeometryBuildWarning[] = [];
  const keptSourceIndex: number[] = [];
  for (const face of sourceFaces) {
    const spec = buildCell(
      geometry,
      face.sourceFaceIndex,
      cellSize,
      sourceIndexToVertex,
      positions,
      hadNormals,
      hadUvs,
      remap,
      bounds,
      type,
    );
    if (!spec) {
      skipped.push({
        code: "degenerate-skipped",
        message: "face collapsed below 3 unique vertices after welding",
        sourceFaceIndex: face.sourceFaceIndex,
      });
      continue;
    }
    cells.push(orientCell(spec, positions, remap, options.orientation ?? "preserve"));
    keptSourceIndex.push(face.sourceFaceIndex);
  }
  if (cells.length === 0) {
    throw new SchemaError(`${type}: every cell was degenerate after welding`);
  }

  if (skipped.length > 0 && !skipDegenerate) {
    throw new SchemaError(`${type}: ${skipped[0]!.message}`);
  }

  const added = addConvertedFaces(builder, cells, options.smooth === true, type, skipDegenerate);
  if (builder.getMesh().faces.size === 0) {
    throw new SchemaError(`${type}: every cell was degenerate after welding`);
  }

  const sourceFaceToCanonicalFaceIds: (readonly FaceId[])[] = Array.from({ length: recipe.cellCount }, () => []);
  for (let i = 0; i < keptSourceIndex.length; i++) {
    const sourceIndex = keptSourceIndex[i]!;
    sourceFaceToCanonicalFaceIds[sourceIndex] = added.sourceFaceToCanonicalFaceIds[i] ?? [];
  }

  const mesh = builder.getMesh();
  markUvSeams(mesh);
  const groups = groupFaces(mesh);
  const finalized = finalizePrimitive(type, builder, groups);
  return {
    ...finalized,
    sourceIndexToVertex,
    sourceFaceToCanonicalFaceIds,
    warnings: [...recipe.skipped, ...skipped, ...added.warnings],
    library: {
      renderVertexCount,
      cellSize,
      hadNormals,
      hadUvs,
      sourceIndexToVertex,
    },
  };
}
