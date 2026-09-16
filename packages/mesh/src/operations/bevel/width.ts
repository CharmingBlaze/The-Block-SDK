import type { EdgeId, VertexId } from "@modeling-kit/core";
import type { HalfEdgeMesh } from "../../half-edge-mesh";
import type { MeshOperationContext, MeshOperationWarning } from "../contract";
import { edgeLength } from "./geometry";
import type { BevelOverlapMode, BevelWidthMode, SelectedEdgePlan } from "./types";
import { DEFAULT_WIDTH_FRACTION } from "./types";

export interface BevelWidthPlan {
  readonly requestedWidth: number;
  readonly appliedWidth: number;
  readonly appliedWidths: ReadonlyMap<EdgeId, number>;
  readonly tByPair: ReadonlyMap<string, number>;
  readonly warnings: MeshOperationWarning[];
}

export function offsetKey(from: VertexId, toward: VertexId): string {
  return `${from}::${toward}`;
}

export function resolveRequestedWidth(offset: number | undefined, width: number | undefined): number {
  const value = width ?? offset;
  if (value === undefined) {
    throw new RangeError("bevel offset must be a positive finite distance");
  }
  return value;
}

export function validateRequestedWidth(value: number, widthMode: BevelWidthMode): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError("bevel offset must be a positive finite distance");
  }
  if (widthMode === "percent" && value >= 0.5) {
    throw new RangeError("bevel percent width must be in (0, 0.5)");
  }
}

function adjacentPairs(plan: SelectedEdgePlan): Array<readonly [VertexId, VertexId]> {
  return [
    [plan.a, plan.nA1],
    [plan.b, plan.nB1],
    [plan.a, plan.nA2],
    [plan.b, plan.nB2],
  ];
}

export function planBevelWidths(
  mesh: HalfEdgeMesh,
  plans: readonly SelectedEdgePlan[],
  requestedWidth: number,
  widthMode: BevelWidthMode,
  overlapMode: BevelOverlapMode,
  ctx: MeshOperationContext,
): BevelWidthPlan {
  const warnings: MeshOperationWarning[] = [];
  const appliedWidths = new Map<EdgeId, number>();
  const tByPair = new Map<string, number>();

  for (const plan of plans) {
    let edgeWidth = requestedWidth;
    if (widthMode === "percent") {
      const maxFraction = DEFAULT_WIDTH_FRACTION;
      if (requestedWidth > maxFraction) {
        if (overlapMode === "error") {
          throw new RangeError(
            `bevel-overlap: percent width ${requestedWidth} exceeds the safe fraction ${maxFraction} on edge ${plan.edgeId}`,
          );
        }
        warnings.push({
          code: "bevel-clamped",
          message: `Percent width ${requestedWidth} exceeded ${maxFraction} and was clamped`,
          elementIds: [plan.edgeId],
        });
        edgeWidth = maxFraction;
      }
      for (const [from, toward] of adjacentPairs(plan)) {
        tByPair.set(offsetKey(from, toward), edgeWidth);
      }
      appliedWidths.set(plan.edgeId, edgeWidth);
      continue;
    }

    let maxSafe = requestedWidth;
    for (const [from, toward] of adjacentPairs(plan)) {
      const length = edgeLength(mesh, from, toward);
      if (length <= ctx.tolerance.epsilon) {
        throw new RangeError(`Cannot bevel along a degenerate edge at vertex ${from}`);
      }
      maxSafe = Math.min(maxSafe, DEFAULT_WIDTH_FRACTION * length);
    }
    if (maxSafe + ctx.tolerance.epsilon < requestedWidth) {
      if (overlapMode === "error") {
        throw new RangeError(
          `bevel-overlap: offset ${requestedWidth} exceeds the safe width ${maxSafe} on edge ${plan.edgeId}`,
        );
      }
      warnings.push({
        code: "bevel-clamped",
        message: `Requested width ${requestedWidth} exceeded ${maxSafe.toFixed(6)} and was clamped`,
        elementIds: [plan.edgeId],
      });
    }
    const applied = overlapMode === "clamp" ? maxSafe : requestedWidth;
    appliedWidths.set(plan.edgeId, applied);
    for (const [from, toward] of adjacentPairs(plan)) {
      const length = edgeLength(mesh, from, toward);
      tByPair.set(offsetKey(from, toward), Math.min(DEFAULT_WIDTH_FRACTION, applied / length));
    }
  }

  const appliedWidth = Math.min(...appliedWidths.values());
  return { requestedWidth, appliedWidth, appliedWidths, tByPair, warnings };
}
