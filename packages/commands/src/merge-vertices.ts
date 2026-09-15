import type { MeshId, VertexId } from "@modeling-kit/core";
import type { Command, CommandContext } from "@modeling-kit/history";
import {
  createMeshOperationContext,
  mergeVertices,
  serializeMesh,
  type MergeVertexTarget,
  type MergeVerticesResult,
  type SerializedMesh,
} from "@modeling-kit/mesh";
import type { SelectionSnapshot } from "@modeling-kit/selection";
import { applyOperationSelection, restoreSelection } from "./selection-from-mapping";
import { requireSelectedMesh } from "./require-selected-mesh";
import { restoreAfter, restoreBefore } from "./connect-vertices";

export interface MergeVerticesParams {
  readonly vertexIds?: readonly VertexId[];
  readonly target?: MergeVertexTarget;
  readonly activeId?: VertexId;
  readonly cursor?: readonly [number, number, number];
  readonly custom?: readonly [number, number, number];
}

export class MergeVerticesCommand implements Command<MergeVerticesResult> {
  readonly id = crypto.randomUUID();
  readonly label = "Merge Vertices";
  private before: SerializedMesh | null = null;
  private after: SerializedMesh | null = null;
  private meshId: MeshId | null = null;
  private result: MergeVerticesResult | null = null;
  private selectionBefore: SelectionSnapshot | null = null;
  private selectionAfter: SelectionSnapshot | null = null;

  constructor(readonly params: MergeVerticesParams = {}) {}

  execute(context: CommandContext): MergeVerticesResult {
    if (this.after && this.meshId) {
      restoreAfter(context, this.after, this.meshId);
      restoreSelection(context, this.selectionAfter);
      if (!this.result) {
        throw new Error("MergeVerticesCommand is missing a stored result");
      }
      return this.result;
    }
    const { objectId, meshId, mesh } = requireSelectedMesh(context);
    const vertexIds = this.params.vertexIds ?? (context.selection.elementIds as VertexId[]);
    this.selectionBefore = context.selection.snapshot();
    this.before = serializeMesh(mesh);
    this.meshId = meshId;
    this.result = mergeVertices(
      mesh,
      {
        vertexIds,
        target: this.params.target ?? "center",
        ...(this.params.activeId ? { activeId: this.params.activeId } : {}),
        ...(this.params.cursor ? { cursor: this.params.cursor } : {}),
        ...(this.params.custom ? { custom: this.params.custom } : {}),
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

  redo(context: CommandContext): MergeVerticesResult {
    return this.execute(context);
  }
}
