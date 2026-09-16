import { SchemaError } from "@modeling-kit/core";
import { MeshBuilder } from "@modeling-kit/mesh";
import { finalizePrimitive } from "../shared";
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
  const cellCount = geometry.cells.length / cellSize;
  if (cellCount < 1) {
    throw new SchemaError(`${type}: cells produced no faces`);
  }
  for (let i = 0; i < geometry.cells.length; i++) {
    const index = geometry.cells[i];
    if (index === undefined || !Number.isInteger(index) || index < 0 || index >= renderVertexCount) {
      throw new SchemaError(`${type}: cell index ${String(index)} is out of range`);
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
  for (let c = 0; c < cellCount; c++) {
    const spec = buildCell(
      geometry,
      c,
      cellSize,
      sourceIndexToVertex,
      positions,
      hadNormals,
      hadUvs,
      remap,
      bounds,
      type,
    );
    if (spec) {
      cells.push(orientCell(spec, positions, remap, options.orientation ?? "preserve"));
    }
  }
  if (cells.length === 0) {
    throw new SchemaError(`${type}: every cell was degenerate after welding`);
  }

  addConvertedFaces(builder, cells, options.smooth === true, type);
  if (builder.getMesh().faces.size === 0) {
    throw new SchemaError(`${type}: every cell was degenerate after welding`);
  }

  const mesh = builder.getMesh();
  markUvSeams(mesh);
  const groups = groupFaces(mesh);
  const finalized = finalizePrimitive(type, builder, groups);
  return {
    ...finalized,
    sourceIndexToVertex,
    library: {
      renderVertexCount,
      cellSize,
      hadNormals,
      hadUvs,
      sourceIndexToVertex,
    },
  };
}
