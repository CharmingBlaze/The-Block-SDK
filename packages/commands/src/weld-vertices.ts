import type { MeshId } from "@modeling-kit/core";
import type { Command, CommandContext } from "@modeling-kit/history";
import {
  createMeshOperationContext,
  mergeVerticesByDistance,
  serializeMesh,
  defaultGeometryTolerance,
  type MergeVerticesResult,
  type SerializedMesh,
} from "@modeling-kit/mesh";
import type { SelectionSnapshot } from "@modeling-kit/selection";
import { applyOperationSelection, restoreSelection } from "./selection-from-mapping";
import { requireSelectedMesh } from "./require-selected-mesh";
import { restoreAfter, restoreBefore } from "./connect-vertices";

export interface WeldVerticesParams {
  readonly epsilon?: number;
}

export interface WeldResult {
  readonly weldedCount: number;
  readonly remainingVertices: number;
}

export class WeldVerticesCommand implements Command<WeldResult> {
  readonly id = crypto.randomUUID();
  readonly label = "Weld Vertices";
  private before: SerializedMesh | null = null;
  private after: SerializedMesh | null = null;
  private meshId: MeshId | null = null;
  private result: WeldResult | null = null;
  private mapped: MergeVerticesResult | null = null;
  private selectionBefore: SelectionSnapshot | null = null;
  private selectionAfter: SelectionSnapshot | null = null;

  constructor(readonly params: WeldVerticesParams = {}) {}

  execute(context: CommandContext): WeldResult {
    if (this.after && this.meshId) {
      restoreAfter(context, this.after, this.meshId);
      restoreSelection(context, this.selectionAfter);
      return this.result ?? { weldedCount: 0, remainingVertices: 0 };
    }
    const { objectId, meshId, mesh } = requireSelectedMesh(context);
    this.selectionBefore = context.selection.snapshot();
    this.before = serializeMesh(mesh);
    this.meshId = meshId;
    this.mapped = mergeVerticesByDistance(
      mesh,
      this.params.epsilon ?? defaultGeometryTolerance.epsilon,
      createMeshOperationContext(context.ids),
    );
    this.result = {
      weldedCount: this.mapped.mergedCount,
      remainingVertices: mesh.vertices.size,
    };
    this.after = serializeMesh(mesh);
    context.syncMesh(mesh.id);
    applyOperationSelection(context, objectId, this.mapped);
    this.selectionAfter = context.selection.snapshot();
    context.events.emit("mesh:changed", { meshIds: [mesh.id] });
    return this.result;
  }

  undo(context: CommandContext): void {
    restoreBefore(context, this.before, this.meshId);
    restoreSelection(context, this.selectionBefore);
  }

  redo(context: CommandContext): WeldResult {
    return this.execute(context);
  }
}
