import type { EdgeId, MeshId } from "@modeling-kit/core";
import type { Command, CommandContext } from "@modeling-kit/history";
import {
  createMeshOperationContext,
  loopCut as loopCutOp,
  restoreMesh,
  serializeMesh,
  type SerializedMesh,
} from "@modeling-kit/mesh";
import type { LoopCutResult } from "@modeling-kit/tools";
import type { SelectionSnapshot } from "@modeling-kit/selection";
import { applyOperationSelection, restoreSelection } from "./selection-from-mapping";
import { requireSelectedMesh } from "./require-selected-mesh";

export interface LoopCutParams {
  readonly factor?: number;
  readonly startEdgeId?: EdgeId;
  readonly cuts?: number;
}

export class LoopCutCommand implements Command<LoopCutResult> {
  readonly id = crypto.randomUUID();
  readonly label = "Loop Cut";
  private before: SerializedMesh | null = null;
  private after: SerializedMesh | null = null;
  private meshId: MeshId | null = null;
  private result: LoopCutResult | null = null;
  private selectionBefore: SelectionSnapshot | null = null;
  private selectionAfter: SelectionSnapshot | null = null;

  constructor(readonly params: LoopCutParams = {}) {}

  execute(context: CommandContext): LoopCutResult {
    if (this.after && this.meshId) {
      const mesh = context.meshes.get(this.meshId);
      if (mesh) {
        restoreMesh(mesh, this.after);
        context.syncMesh(mesh.id);
      }
      restoreSelection(context, this.selectionAfter);
      return (
        this.result ?? {
          newVertexIds: [],
          newFaceIds: [],
          loopEdgeIds: [],
        }
      );
    }
    const { objectId, meshId, mesh } = requireSelectedMesh(context);
    const startEdgeId =
      this.params.startEdgeId ?? (context.selection.elementIds[0] as EdgeId | undefined);
    if (!startEdgeId) {
      throw new RangeError("LoopCutCommand requires a start edge");
    }
    this.selectionBefore = context.selection.snapshot();
    this.before = serializeMesh(mesh);
    this.meshId = meshId;
    const cut = loopCutOp(
      mesh,
      {
        startEdgeId,
        factor: this.params.factor ?? 0.5,
        cuts: this.params.cuts ?? 1,
      },
      createMeshOperationContext(context.ids),
    );
    this.after = serializeMesh(mesh);
    this.result = {
      newVertexIds: cut.newVertexIds,
      newFaceIds: cut.newFaceIds,
      loopEdgeIds: cut.loopEdgeIds,
    };
    context.syncMesh(mesh.id);
    applyOperationSelection(context, objectId, cut);
    this.selectionAfter = context.selection.snapshot();
    context.events.emit("mesh:changed", { meshIds: [mesh.id] });
    return this.result;
  }

  undo(context: CommandContext): void {
    if (!this.before || !this.meshId) {
      return;
    }
    const mesh = context.meshes.get(this.meshId);
    if (!mesh) {
      return;
    }
    restoreMesh(mesh, this.before);
    context.syncMesh(mesh.id);
    restoreSelection(context, this.selectionBefore);
    context.events.emit("mesh:changed", { meshIds: [mesh.id] });
  }

  redo(context: CommandContext): LoopCutResult {
    return this.execute(context);
  }
}
