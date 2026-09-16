import type { VertexId } from "@modeling-kit/core";
import type { MeshBuilder } from "@modeling-kit/mesh";
import { readPosition } from "./attributes";
import { unionCoincidentSources, unionZeroLengthCellEdges } from "./weld-components";
import { unionUvGrid } from "./weld-grid";
import type { WeldPolicy } from "./weld-policy";
import { IndexUnion } from "./weld-union";

/**
 * Identify source indices that should share a half-edge vertex.
 *
 * Never weld by position across the whole buffer: UV-seam duplicates must stay
 * distinct until a grid/solid policy says they are the same topological vertex.
 */
export function weldSourceVertices(
  builder: MeshBuilder,
  positions: ArrayLike<number>,
  cells: ArrayLike<number>,
  cellSize: 3 | 4,
  remap: boolean,
  policy: WeldPolicy,
): VertexId[] {
  const renderVertexCount = positions.length / 3;
  const welded = new IndexUnion(renderVertexCount);
  if (policy.kind !== "none") {
    unionZeroLengthCellEdges(welded, positions, cells, cellSize, remap);
  }

  if (policy.kind === "uv-grid") {
    unionUvGrid(welded, policy);
  } else if (policy.kind === "solid") {
    unionCoincidentSources(
      welded,
      positions,
      remap,
      Array.from({ length: renderVertexCount }, (_, i) => i),
    );
  }

  const canonical = new Map<number, VertexId>();
  const sourceIndexToVertex: VertexId[] = [];
  for (let i = 0; i < renderVertexCount; i++) {
    const root = welded.find(i);
    let id = canonical.get(root);
    if (!id) {
      const position = readPosition(positions, root, remap);
      id = builder.addVertex(position[0], position[1], position[2]);
      canonical.set(root, id);
    }
    sourceIndexToVertex.push(id);
  }
  return sourceIndexToVertex;
}
