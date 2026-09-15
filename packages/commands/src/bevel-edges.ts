import type { EdgeId, MeshId } from "@modeling-kit/core";
import type { Command, CommandContext } from "@modeling-kit/history";
import {
  bevelEdges,
  createMeshOperationContext,
  restoreMesh,
  serializeMesh,
  type SerializedMesh,
} from "@modeling-kit/mesh";
import type { BevelEdgesResult } from "@modeling-kit/tools";
import type { SelectionSnapshot } from "@modeling-kit/selection";
import { applyOperationSelection, restoreSelection } from "./selection-from-mapping";
import { requireSelectedMesh } from "./require-selected-mesh";

export interface BevelEdgesParams {
  readonly offset: number;
  readonly edgeIds?: readonly EdgeId[];
  readonly segments?: number;
}

export class BevelEdgesCommand implements Command<BevelEdgesResult> {
  readonly id = crypto.randomUUID();
  readonly label = "Bevel Edges";
  private before: SerializedMesh | null = null;
  private after: SerializedMesh | null = null;
  private meshId: MeshId | null = null;
  private result: BevelEdgesResult | null = null;
  private selectionBefore: SelectionSnapshot | null = null;
  private selectionAfter: SelectionSnapshot | null = null;

  constructor(readonly params: BevelEdgesParams) {}

  execute(context: CommandContext): BevelEdgesResult {
    if (this.after && this.meshId) {
      const mesh = context.meshes.get(this.meshId);
      if (mesh) {
        restoreMesh(mesh, this.after);
        context.syncMesh(mesh.id);
      }
      restoreSelection(context, this.selectionAfter);
      return this.result ?? { chamferFaceIds: [], remainingFaceIds: [] };
    }
    const { objectId, meshId, mesh } = requireSelectedMesh(context);
    const edgeIds = this.params.edgeIds ?? (context.selection.elementIds as EdgeId[]);
    this.selectionBefore = context.selection.snapshot();
    this.before = serializeMesh(mesh);
    this.meshId = meshId;
    const beveledOp = bevelEdges(
      mesh,
      {
        edgeIds,
        offset: this.params.offset,
        ...(this.params.segments !== undefined ? { segments: this.params.segments } : {}),
      },
      createMeshOperationContext(context.ids),
    );
    this.after = serializeMesh(mesh);
    this.result = {
      chamferFaceIds: beveledOp.chamferFaceIds,
      remainingFaceIds: beveledOp.remainingFaceIds,
    };
    context.syncMesh(mesh.id);
    applyOperationSelection(context, objectId, beveledOp);
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

  redo(context: CommandContext): BevelEdgesResult {
    return this.execute(context);
  }
}
