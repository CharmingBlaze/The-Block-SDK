import type { EdgeId, MeshId } from "@modeling-kit/core";
import type { Command, CommandContext } from "@modeling-kit/history";
import {
  createMeshOperationContext,
  fillBoundary,
  serializeMesh,
  type FillBoundaryMethod,
  type FillBoundaryResult,
  type SerializedMesh,
} from "@modeling-kit/mesh";
import { restoreAfter, restoreBefore } from "./connect-vertices";
import { requireSelectedMesh } from "./require-selected-mesh";
import { applyOperationSelection, restoreSelection } from "./selection-from-mapping";
import type { SelectionSnapshot } from "@modeling-kit/selection";

export interface FillBoundaryParams {
  readonly boundaryEdgeIds?: readonly EdgeId[];
  readonly method?: FillBoundaryMethod;
}

export class FillBoundaryCommand implements Command<FillBoundaryResult> {
  readonly id = crypto.randomUUID();
  readonly label = "Fill Boundary";
  private before: SerializedMesh | null = null;
  private after: SerializedMesh | null = null;
  private meshId: MeshId | null = null;
  private result: FillBoundaryResult | null = null;
  private selectionBefore: SelectionSnapshot | null = null;
  private selectionAfter: SelectionSnapshot | null = null;

  constructor(readonly params: FillBoundaryParams = {}) {}

  execute(context: CommandContext): FillBoundaryResult {
    if (this.after && this.meshId) {
      restoreAfter(context, this.after, this.meshId);
      restoreSelection(context, this.selectionAfter);
      if (!this.result) {
        throw new Error("FillBoundaryCommand is missing a stored result");
      }
      return this.result;
    }
    const { objectId, meshId, mesh } = requireSelectedMesh(context);
    const boundaryEdgeIds =
      this.params.boundaryEdgeIds ??
      (context.selection.domain === "edge"
        ? (context.selection.elementIds as EdgeId[])
        : mesh.findBoundaryEdges());
    this.selectionBefore = context.selection.snapshot();
    this.before = serializeMesh(mesh);
    this.meshId = meshId;
    this.result = fillBoundary(
      mesh,
      {
        boundaryEdgeIds,
        method: this.params.method ?? "ngon",
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

  redo(context: CommandContext): FillBoundaryResult {
    return this.execute(context);
  }
}
