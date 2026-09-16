import { SchemaError, type VertexId } from "@modeling-kit/core";
import { fallbackUv, readNormal } from "./attributes";
import type { Aabb, CellSpec, SimplicialComplexInput } from "./convert-types";

export function resolveCellSize(
  cells: ArrayLike<number>,
  explicit: 3 | 4 | undefined,
  type: string,
): 3 | 4 {
  const length = cells.length;
  if (explicit) {
    if (length % explicit !== 0) {
      throw new SchemaError(`${type}: cells length must be a multiple of ${explicit}`);
    }
    return explicit;
  }
  if (length % 3 !== 0) {
    throw new SchemaError(`${type}: cells are triangles unless cellSize is supplied; length must be a multiple of 3`);
  }
  return 3;
}

export function buildCell(
  geometry: SimplicialComplexInput,
  cell: number,
  cellSize: 3 | 4,
  sourceIndexToVertex: readonly VertexId[],
  positions: ArrayLike<number>,
  hadNormals: boolean,
  hadUvs: boolean,
  remap: boolean,
  bounds: Aabb,
  type: string,
): CellSpec | null {
  const source: number[] = [];
  const vertices: VertexId[] = [];
  const uvs: [number, number][] = [];
  const normals: [number, number, number][] = [];
  const unique = new Set<VertexId>();
  for (let k = 0; k < cellSize; k++) {
    const sourceIndex = geometry.cells[cell * cellSize + k]!;
    const vertexId = sourceIndexToVertex[sourceIndex];
    if (vertexId === undefined) {
      throw new SchemaError(`${type}: missing welded vertex for source ${sourceIndex}`);
    }
    if (vertices[vertices.length - 1] === vertexId) {
      continue;
    }
    source.push(sourceIndex);
    vertices.push(vertexId);
    unique.add(vertexId);
    const uv =
      hadUvs && geometry.uvs
        ? ([geometry.uvs[sourceIndex * 2] ?? 0, geometry.uvs[sourceIndex * 2 + 1] ?? 0] as [number, number])
        : fallbackUv(positions, sourceIndex, remap, bounds);
    uvs.push(uv);
    if (hadNormals && geometry.normals) {
      normals.push(readNormal(geometry.normals, sourceIndex, remap));
    }
  }
  if (vertices.length >= 3 && vertices[0] === vertices[vertices.length - 1]) {
    vertices.pop();
    source.pop();
    uvs.pop();
    normals.pop();
  }
  if (unique.size < 3 || vertices.length < 3) {
    return null;
  }
  return {
    source,
    vertices,
    uvs,
    normals: hadNormals ? normals : undefined,
  };
}
