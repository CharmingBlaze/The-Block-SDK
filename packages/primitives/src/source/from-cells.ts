import { SchemaError } from "@modeling-kit/core";
import type { GeometryBuildWarning, SourceFace, SourceTopologyKind } from "./types";

export interface ExplicitFaceRecipe {
  readonly faces: SourceFace[];
  readonly topologyKind: SourceTopologyKind;
  readonly cellCount: number;
  readonly skipped: GeometryBuildWarning[];
}

/**
 * Expand a packed index buffer into explicit face loops.
 * `cellSize` is required. Total length is only used to check it is a multiple
 * of that declared size — never to guess triangles vs quads vs mixed polygons.
 */
export function facesFromFlatCells(
  cells: ArrayLike<number>,
  cellSize: 3 | 4,
  type: string,
): ExplicitFaceRecipe {
  if (cells.length === 0) {
    throw new SchemaError(`${type}: cells produced no faces`);
  }
  if (cells.length % cellSize !== 0) {
    throw new SchemaError(`${type}: cells length must be a multiple of the explicit cellSize ${cellSize}`);
  }
  const faces: SourceFace[] = [];
  const skipped: GeometryBuildWarning[] = [];
  const cellCount = cells.length / cellSize;
  for (let c = 0; c < cellCount; c++) {
    const indices: number[] = [];
    for (let k = 0; k < cellSize; k++) {
      const index = cells[c * cellSize + k]!;
      indices.push(index);
    }
    if (new Set(indices).size !== indices.length) {
      skipped.push({
        code: "degenerate-skipped",
        message: `${type}: face ${c} repeats a vertex index`,
        sourceFaceIndex: c,
      });
      continue;
    }
    if (indices.length < 3) {
      throw new SchemaError(`${type}: face ${c} has fewer than 3 indices`);
    }
    faces.push({ indices, sourceFaceIndex: c });
  }
  if (faces.length === 0) {
    throw new SchemaError(
      skipped.length > 0
        ? `${type}: every face repeats a vertex index`
        : `${type}: cells produced no faces`,
    );
  }
  return {
    faces,
    topologyKind: cellSize === 3 ? "triangles" : "polygons",
    cellCount,
    skipped,
  };
}

export function facesFromOffsets(
  data: { readonly indices: ArrayLike<number>; readonly faceOffsets: ArrayLike<number> },
  type: string,
): SourceFace[] {
  const offsets = data.faceOffsets;
  if (offsets.length < 2) {
    throw new SchemaError(`${type}: faceOffsets must contain at least two entries`);
  }
  const faces: SourceFace[] = [];
  for (let i = 0; i < offsets.length - 1; i++) {
    const start = offsets[i]!;
    const end = offsets[i + 1]!;
    if (!Number.isInteger(start) || !Number.isInteger(end) || end < start + 3) {
      throw new SchemaError(`${type}: face ${i} offsets do not describe a polygon`);
    }
    const indices: number[] = [];
    for (let k = start; k < end; k++) {
      indices.push(data.indices[k]!);
    }
    if (new Set(indices).size !== indices.length) {
      throw new SchemaError(`${type}: face ${i} repeats a vertex index`);
    }
    faces.push({ indices, sourceFaceIndex: i });
  }
  return faces;
}
