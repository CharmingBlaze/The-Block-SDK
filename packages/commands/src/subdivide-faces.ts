import { brand, type FaceId, type MeshId } from "@modeling-kit/core";
import type { Command, CommandContext } from "@modeling-kit/history";
import {
  createMeshOperationContext,
  restoreMesh,
  serializeMesh,
  subdivideFaces,
  type SerializedMesh,
  type SubdivideResult,
} from "@modeling-kit/mesh";
import type { SelectionSnapshot } from "@modeling-kit/selection";
import { applyOperationSelection, restoreSelection } from "./selection-from-mapping";

export interface SubdivideFacesParams {
  readonly faceIds?: readonly FaceId[];
  readonly cuts?: number;
}

export class SubdivideFacesCommand implements Command<SubdivideResult> {
  readonly id = crypto.randomUUID();
  readonly label = "Subdivide Faces";
  private before: SerializedMesh | null = null;
  private after: SerializedMesh | null = null;
  private meshId: MeshId | null = null;
  private result: SubdivideResult | null = null;
  private selectionBefore: SelectionSnapshot | null = null;
  private selectionAfter: SelectionSnapshot | null = null;

  constructor(readonly params: SubdivideFacesParams = {}) {}

  execute(context: CommandContext): SubdivideResult {
    if (this.after && this.meshId) {
      const mesh = context.meshes.get(this.meshId);
      if (mesh) {
        restoreMesh(mesh, this.after);
        context.syncMesh(mesh.id);
      }
      restoreSelection(context, this.selectionAfter);
      return this.result ?? { newFaceIds: [] };
    }

    const objectId = context.selection.objectIds[0];
    if (!objectId) {
      throw new RangeError("SubdivideFacesCommand requires an object selection");
    }
    const node = context.document.scene.nodes.get(objectId);
    const meshId = node?.payloadRef ? brand<string, "MeshId">(node.payloadRef) : undefined;
    const mesh = meshId ? context.meshes.get(meshId) : undefined;
    if (!mesh || !meshId) {
      throw new RangeError("SubdivideFacesCommand could not resolve a mesh");
    }

    const faceIds =
      this.params.faceIds ??
      (context.selection.elementIds.length > 0
        ? (context.selection.elementIds as FaceId[])
        : Array.from(mesh.faces.keys()));

    this.before = serializeMesh(mesh);
    this.meshId = meshId;
    this.selectionBefore = context.selection.snapshot();

    const sub = subdivideFaces(
      mesh,
      {
        faceIds,
        ...(this.params.cuts !== undefined ? { cuts: this.params.cuts } : {}),
      },
      createMeshOperationContext(context.ids),
    );
    this.after = serializeMesh(mesh);
    this.result = { newFaceIds: sub.newFaceIds };

    context.syncMesh(mesh.id);
    applyOperationSelection(context, objectId, sub);
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

  redo(context: CommandContext): SubdivideResult {
    return this.execute(context);
  }
}
