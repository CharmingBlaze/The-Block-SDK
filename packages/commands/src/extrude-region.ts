import type { FaceId, MeshId } from "@modeling-kit/core";
import type { Command, CommandContext } from "@modeling-kit/history";
import {
  createMeshOperationContext,
  extrudeRegion,
  serializeMesh,
  type ExtrudeRegionResult,
  type SerializedMesh,
} from "@modeling-kit/mesh";
import { requireSelectedMesh } from "./require-selected-mesh";
import { restoreAfter, restoreBefore } from "./connect-vertices";
import { applyOperationSelection, restoreSelection } from "./selection-from-mapping";
import type { SelectionSnapshot } from "@modeling-kit/selection";

export interface ExtrudeRegionParams {
  readonly distance: number;
  readonly faceIds?: readonly FaceId[];
}

export class ExtrudeRegionCommand implements Command<ExtrudeRegionResult> {
  readonly id = crypto.randomUUID();
  readonly label = "Extrude Region";
  private before: SerializedMesh | null = null;
  private after: SerializedMesh | null = null;
  private meshId: MeshId | null = null;
  private result: ExtrudeRegionResult | null = null;
  private selectionBefore: SelectionSnapshot | null = null;
  private selectionAfter: SelectionSnapshot | null = null;

  constructor(readonly params: ExtrudeRegionParams) {}

  execute(context: CommandContext): ExtrudeRegionResult {
    if (this.after && this.meshId) {
      restoreAfter(context, this.after, this.meshId);
      restoreSelection(context, this.selectionAfter);
      if (!this.result) {
        throw new Error("ExtrudeRegionCommand is missing a stored result");
      }
      return this.result;
    }
    const { objectId, meshId, mesh } = requireSelectedMesh(context);
    const faceIds = this.params.faceIds ?? (context.selection.elementIds as FaceId[]);
    this.selectionBefore = context.selection.snapshot();
    this.before = serializeMesh(mesh);
    this.meshId = meshId;
    this.result = extrudeRegion(
      mesh,
      { faceIds, distance: this.params.distance },
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

  redo(context: CommandContext): ExtrudeRegionResult {
    return this.execute(context);
  }
}
