import type { MeshId } from "@modeling-kit/core";
import type { Command, CommandContext } from "@modeling-kit/history";
import {
  createMeshOperationContext,
  executeKnifeCutPlan,
  executeKnifePlan,
  planKnifeCuts,
  serializeMesh,
  type KnifeCutPlan,
  type KnifeExecuteResult,
  type KnifePoint,
  type SerializedMesh,
  type Vec3Tuple,
} from "@modeling-kit/mesh";
import { restoreAfter, restoreBefore } from "./connect-vertices";
import { requireSelectedMesh } from "./require-selected-mesh";
import { applyOperationSelection, restoreSelection } from "./selection-from-mapping";
import type { SelectionSnapshot } from "@modeling-kit/selection";

export interface KnifeCutParams {
  readonly points: readonly KnifePoint[] | readonly Vec3Tuple[];
  readonly snapRadius?: number;
  readonly plan?: KnifeCutPlan;
}

export class KnifeCutCommand implements Command<KnifeExecuteResult> {
  readonly id = crypto.randomUUID();
  readonly label = "Knife Cut";
  private before: SerializedMesh | null = null;
  private after: SerializedMesh | null = null;
  private meshId: MeshId | null = null;
  private result: KnifeExecuteResult | null = null;
  private selectionBefore: SelectionSnapshot | null = null;
  private selectionAfter: SelectionSnapshot | null = null;

  constructor(readonly params: KnifeCutParams) {}

  execute(context: CommandContext): KnifeExecuteResult {
    if (this.after && this.meshId) {
      restoreAfter(context, this.after, this.meshId);
      restoreSelection(context, this.selectionAfter);
      if (!this.result) {
        throw new Error("KnifeCutCommand is missing a stored result");
      }
      return this.result;
    }
    const { objectId, meshId, mesh } = requireSelectedMesh(context);
    this.selectionBefore = context.selection.snapshot();
    this.before = serializeMesh(mesh);
    this.meshId = meshId;
    const ctx = createMeshOperationContext(context.ids);
    if (this.params.plan) {
      this.result = executeKnifeCutPlan(mesh, this.params.plan, ctx);
    } else if (isKnifePointList(this.params.points)) {
      const cutPlan = planKnifeCuts(mesh, this.params.points, ctx);
      this.result = executeKnifeCutPlan(mesh, cutPlan, ctx);
    } else {
      this.result = executeKnifePlan(
        mesh,
        {
          points: this.params.points,
          ...(this.params.snapRadius !== undefined ? { snapRadius: this.params.snapRadius } : {}),
        },
        ctx,
      );
    }
    this.after = serializeMesh(mesh);
    context.syncMesh(mesh.id);
    applyOperationSelection(context, objectId, this.result);
    this.selectionAfter = context.selection.snapshot();
    context.events.emit("mesh:changed", { meshIds: [mesh.id] });
    return this.result;
  }

  undo(context: CommandContext): void {
    restoreBefore(context, this.before, this.meshId);
    restoreSelection(context, this.selectionBefore);
  }

  redo(context: CommandContext): KnifeExecuteResult {
    return this.execute(context);
  }
}

function isKnifePointList(
  points: readonly KnifePoint[] | readonly Vec3Tuple[],
): points is readonly KnifePoint[] {
  const first = points[0];
  return Boolean(first && typeof first === "object" && "attachment" in first && "faceId" in first);
}
