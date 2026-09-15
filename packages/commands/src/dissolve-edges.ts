import type { EdgeId, MeshId } from "@modeling-kit/core";
import type { Command, CommandContext } from "@modeling-kit/history";
import {
  createMeshOperationContext,
  dissolveEdge,
  restoreMesh,
  serializeMesh,
  type SerializedMesh,
} from "@modeling-kit/mesh";
import type { DissolveEdgesResult } from "@modeling-kit/tools";
import type { SelectionSnapshot } from "@modeling-kit/selection";
import { applyOperationSelection, restoreSelection } from "./selection-from-mapping";
import { requireSelectedMesh } from "./require-selected-mesh";

export interface DissolveEdgesParams {
  readonly edgeIds?: readonly EdgeId[];
}

export class DissolveEdgesCommand implements Command<DissolveEdgesResult> {
  readonly id = crypto.randomUUID();
  readonly label = "Dissolve Edges";
  private before: SerializedMesh | null = null;
  private after: SerializedMesh | null = null;
  private meshId: MeshId | null = null;
  private result: DissolveEdgesResult | null = null;
  private selectionBefore: SelectionSnapshot | null = null;
  private selectionAfter: SelectionSnapshot | null = null;

  constructor(readonly params: DissolveEdgesParams = {}) {}

  execute(context: CommandContext): DissolveEdgesResult {
    if (this.after && this.meshId) {
      const mesh = context.meshes.get(this.meshId);
      if (mesh) {
        restoreMesh(mesh, this.after);
        context.syncMesh(mesh.id);
      }
      restoreSelection(context, this.selectionAfter);
      return this.result ?? { faceIds: [], dissolved: [] };
    }
    const { objectId, meshId, mesh } = requireSelectedMesh(context);
    const edgeIds = this.params.edgeIds ?? (context.selection.elementIds as EdgeId[]);
    this.selectionBefore = context.selection.snapshot();
    this.before = serializeMesh(mesh);
    this.meshId = meshId;
    const dissolved: EdgeId[] = [];
    const faceIds: DissolveEdgesResult["faceIds"] = [];
    let last = null as ReturnType<typeof dissolveEdge> | null;
    for (const edgeId of edgeIds) {
      if (!mesh.edges.has(edgeId)) {
        continue;
      }
      last = dissolveEdge(mesh, { edgeId }, createMeshOperationContext(context.ids));
      faceIds.push(last.faceId);
      dissolved.push(last.dissolvedEdgeId);
    }
    this.after = serializeMesh(mesh);
    this.result = { faceIds, dissolved };
    context.syncMesh(mesh.id);
    if (last) {
      applyOperationSelection(context, objectId, last);
    }
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

  redo(context: CommandContext): DissolveEdgesResult {
    return this.execute(context);
  }
}
