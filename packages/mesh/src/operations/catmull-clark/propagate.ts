import type { EdgeId, VertexId } from "@modeling-kit/core";
import type { HalfEdgeMesh } from "../../half-edge-mesh";
import { requireEdge } from "../../internal/rebuild";
import type { EdgeRecord } from "../../types";
import type { MeshOperationContext } from "../contract";

export interface ParentEdgeAttributes {
  readonly edgeId: EdgeId;
  readonly ends: readonly [VertexId, VertexId];
  readonly record: Pick<EdgeRecord, "isSeam" | "seamChannels" | "creaseAngle" | "creaseWeight">;
}

export function snapshotParentEdges(
  mesh: HalfEdgeMesh,
  edgeEnds: ReadonlyMap<EdgeId, readonly [VertexId, VertexId]>,
): ParentEdgeAttributes[] {
  const snaps: ParentEdgeAttributes[] = [];
  for (const [edgeId, ends] of edgeEnds) {
    const record = mesh.edges.get(edgeId);
    if (!record) {
      continue;
    }
    snaps.push({
      edgeId,
      ends,
      record: {
        isSeam: record.isSeam,
        seamChannels: record.seamChannels ? [...record.seamChannels] : undefined,
        creaseAngle: record.creaseAngle,
        creaseWeight: record.creaseWeight,
      },
    });
  }
  return snaps;
}

export function findEdgeBetween(mesh: HalfEdgeMesh, a: VertexId, b: VertexId): EdgeId | null {
  try {
    return requireEdge(mesh, a, b);
  } catch {
    return null;
  }
}

/**
 * Child edges of a split parent inherit the parent's crease and seam.
 * New interior face edges stay smooth. Sharpness does not decay per level.
 */
export function propagateParentEdgeAttributes(
  mesh: HalfEdgeMesh,
  parents: readonly ParentEdgeAttributes[],
  edgePointId: ReadonlyMap<EdgeId, VertexId>,
  ctx: MeshOperationContext,
): void {
  for (const parent of parents) {
    const mid = edgePointId.get(parent.edgeId);
    if (!mid) {
      continue;
    }
    const children = [findEdgeBetween(mesh, parent.ends[0], mid), findEdgeBetween(mesh, parent.ends[1], mid)];
    for (const childId of children) {
      if (!childId) {
        continue;
      }
      const child = mesh.edges.get(childId);
      if (!child) {
        continue;
      }
      if (ctx.attributes.preserveSeams) {
        child.isSeam = parent.record.isSeam;
        if (parent.record.seamChannels) {
          child.seamChannels = [...parent.record.seamChannels];
        }
      }
      if (ctx.attributes.preserveSharps) {
        child.creaseAngle = parent.record.creaseAngle;
        child.creaseWeight = parent.record.creaseWeight;
      }
    }
  }
}
