import type { FaceId, MeshId } from "@modeling-kit/core";
import type { Command, CommandContext } from "@modeling-kit/history";
import {
  createMeshOperationContext,
  serializeMesh,
  triangulateFaces,
  type SerializedMesh,
  type TriangulateFacesResult,
} from "@modeling-kit/mesh";
import { requireSelectedMesh } from "./require-selected-mesh";
import { restoreAfter, restoreBefore } from "./connect-vertices";
import { applyOperationSelection, restoreSelection } from "./selection-from-mapping";
import type { SelectionSnapshot } from "@modeling-kit/selection";

export interface TriangulateFacesParams {
  readonly faceIds?: readonly FaceId[];
}

export class TriangulateFacesCommand implements Command<TriangulateFacesResult> {
  readonly id = crypto.randomUUID();
  readonly label = "Triangulate Faces";
  private before: SerializedMesh | null = null;
  private after: SerializedMesh | null = null;
  private meshId: MeshId | null = null;
  private result: TriangulateFacesResult | null = null;
  private selectionBefore: SelectionSnapshot | null = null;
  private selectionAfter: SelectionSnapshot | null = null;

  constructor(readonly params: TriangulateFacesParams = {}) {}

  execute(context: CommandContext): TriangulateFacesResult {
    if (this.after && this.meshId) {
      restoreAfter(context, this.after, this.meshId);
      restoreSelection(context, this.selectionAfter);
      if (!this.result) {
        throw new Error("TriangulateFacesCommand is missing a stored result");
      }
      return this.result;
    }
    const { objectId, meshId, mesh } = requireSelectedMesh(context);
    const faceIds =
      this.params.faceIds ??
      (context.selection.domain === "face" ? (context.selection.elementIds as FaceId[]) : undefined);
    this.selectionBefore = context.selection.snapshot();
    this.before = serializeMesh(mesh);
    this.meshId = meshId;
    this.result = triangulateFaces(
      mesh,
      { ...(faceIds ? { faceIds } : {}) },
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

  redo(context: CommandContext): TriangulateFacesResult {
    return this.execute(context);
  }
}
