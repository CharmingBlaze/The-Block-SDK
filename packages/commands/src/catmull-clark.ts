import type { MeshId } from "@modeling-kit/core";
import type { Command, CommandContext } from "@modeling-kit/history";
import {
  catmullClarkSubdivide,
  createMeshOperationContext,
  serializeMesh,
  type CatmullClarkResult,
  type SerializedMesh,
} from "@modeling-kit/mesh";
import { restoreAfter, restoreBefore } from "./connect-vertices";
import { requireSelectedMesh } from "./require-selected-mesh";
import { applyOperationSelection, restoreSelection } from "./selection-from-mapping";
import type { SelectionSnapshot } from "@modeling-kit/selection";

export interface CatmullClarkParams {
  readonly iterations?: number;
}

export class CatmullClarkSubdivideCommand implements Command<CatmullClarkResult> {
  readonly id = crypto.randomUUID();
  readonly label = "Catmull-Clark Subdivide";
  private before: SerializedMesh | null = null;
  private after: SerializedMesh | null = null;
  private meshId: MeshId | null = null;
  private result: CatmullClarkResult | null = null;
  private selectionBefore: SelectionSnapshot | null = null;
  private selectionAfter: SelectionSnapshot | null = null;

  constructor(readonly params: CatmullClarkParams = {}) {}

  execute(context: CommandContext): CatmullClarkResult {
    if (this.after && this.meshId) {
      restoreAfter(context, this.after, this.meshId);
      restoreSelection(context, this.selectionAfter);
      if (!this.result) {
        throw new Error("CatmullClarkSubdivideCommand is missing a stored result");
      }
      return this.result;
    }
    const { objectId, meshId, mesh } = requireSelectedMesh(context);
    this.selectionBefore = context.selection.snapshot();
    this.before = serializeMesh(mesh);
    this.meshId = meshId;
    this.result = catmullClarkSubdivide(
      mesh,
      {
        ...(this.params.iterations !== undefined ? { iterations: this.params.iterations } : {}),
      },
      createMeshOperationContext(context.ids),
    );
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

  redo(context: CommandContext): CatmullClarkResult {
    return this.execute(context);
  }
}
