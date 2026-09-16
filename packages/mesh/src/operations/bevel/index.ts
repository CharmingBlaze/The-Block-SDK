import type { FaceId } from "@modeling-kit/core";
import { assertStrictMesh } from "../../internal/assert-mesh";
import type { HalfEdgeMesh } from "../../half-edge-mesh";
import type { MeshOperationContext } from "../contract";
import { runTransactionalMeshOp } from "../contract";
import { constructBevel } from "./construct";
import { planCornerMiters } from "./miter";
import { planBevelSelection } from "./planner";
import type { BevelEdgesRequest, BevelEdgesResult, BevelOverlapMode, BevelWidthMode, SimpleBevelMiterMode } from "./types";
import { DEFAULT_MITER_LIMIT } from "./types";
import { planBevelWidths, resolveRequestedWidth, validateRequestedWidth } from "./width";

export type {
  BevelEdgesRequest,
  BevelEdgesResult,
  BevelOverlapMode,
  BevelWidthMode,
  SimpleBevelMiterMode,
  SimpleBevelOptions,
} from "./types";
export { DEFAULT_MITER_LIMIT } from "./types";

/**
 * Chamfers a connected edge network in one topology pass.
 * Offset is a geometric distance in model units unless `widthMode: "percent"`.
 */
export function bevelEdges(
  mesh: HalfEdgeMesh,
  request: BevelEdgesRequest,
  ctx: MeshOperationContext,
): BevelEdgesResult {
  return runTransactionalMeshOp(mesh, () => {
    const requestedWidth = resolveRequestedWidth(request.offset, request.width);
    const widthMode: BevelWidthMode = request.widthMode ?? "offset";
    validateRequestedWidth(requestedWidth, widthMode);
    const overlapMode: BevelOverlapMode = request.overlapMode ?? "clamp";
    const miterMode: SimpleBevelMiterMode = request.miterMode ?? "sharp";
    const segments = Math.max(1, Math.floor(request.segments ?? 1));
    const miterLimit = request.miterLimit ?? DEFAULT_MITER_LIMIT;
    const allowClipFallback = request.allowClipFallback === true;

    const selection = planBevelSelection(mesh, request.edgeIds, ctx);
    const widths = planBevelWidths(
      mesh,
      selection.plans,
      requestedWidth,
      widthMode,
      overlapMode,
      ctx,
    );
    const corners = planCornerMiters({
      mesh,
      plans: selection.plans,
      requestedWidth: widths.appliedWidth,
      tByPair: widths.tByPair,
      miterMode,
      allowClipFallback,
      miterLimit,
      ctx,
    });

    const built = constructBevel({
      mesh,
      ctx,
      plans: selection.plans,
      tByPair: widths.tByPair,
      cornerDecisions: corners.decisions,
      segments,
    });

    assertStrictMesh(mesh, "bevelEdges");
    const { mapping, changes } = built.mapping.build(mesh);
    const createdFaceIds: FaceId[] = [...built.chamferFaceIds, ...built.clipFaceIds];
    const beveledEdgeIds = selection.plans.map((plan) => plan.edgeId);
    return {
      mesh,
      changes,
      mapping,
      selection: { domain: "face", elementIds: createdFaceIds },
      warnings: [...widths.warnings, ...corners.warnings],
      chamferFaceIds: built.chamferFaceIds,
      remainingFaceIds: built.remainingFaceIds,
      appliedWidth: widths.appliedWidth,
      appliedWidths: widths.appliedWidths,
      beveledEdgeIds,
      createdFaceIds,
    };
  });
}
