import { brand, type FaceId, type MeshId } from "@modeling-kit/core";
import type { Command, CommandContext } from "@modeling-kit/history";
import {
  createMeshOperationContext,
  extrudeFaces,
  restoreMesh,
  serializeMesh,
  type SerializedMesh,
} from "@modeling-kit/mesh";
import type { SelectionSnapshot } from "@modeling-kit/selection";
import { applyOperationSelection, restoreSelection } from "./selection-from-mapping";

export interface ExtrudeFacesParams {
  readonly distance: number;
  readonly faceIds?: readonly FaceId[];
}

export interface ExtrudeFacesResult {
  readonly capFaceIds: FaceId[];
  readonly sideFaceIds: FaceId[];
}

export class ExtrudeFacesCommand implements Command<ExtrudeFacesResult> {
  readonly id = crypto.randomUUID();
  readonly label = "Extrude Faces";
  private before: SerializedMesh | null = null;
  private after: SerializedMesh | null = null;
  private meshId: MeshId | null = null;
  private result: ExtrudeFacesResult | null = null;
  private selectionBefore: SelectionSnapshot | null = null;
  private selectionAfter: SelectionSnapshot | null = null;

  constructor(readonly params: ExtrudeFacesParams) {}

  execute(context: CommandContext): ExtrudeFacesResult {
    if (this.after && this.meshId) {
      const mesh = context.meshes.get(this.meshId);
      if (mesh) {
        restoreMesh(mesh, this.after);
        context.syncMesh(mesh.id);
      }
      restoreSelection(context, this.selectionAfter);
      return this.result ?? { capFaceIds: [], sideFaceIds: [] };
    }
    const objectId = context.selection.objectIds[0];
    if (!objectId) {
      throw new RangeError("ExtrudeFacesCommand requires an object selection");
    }
    const node = context.document.scene.nodes.get(objectId);
    const meshId = node?.payloadRef ? brand<string, "MeshId">(node.payloadRef) : undefined;
    const mesh = meshId ? context.meshes.get(meshId) : undefined;
    if (!mesh || !meshId) {
      throw new RangeError("ExtrudeFacesCommand could not resolve a mesh");
    }
    const faceIds = this.params.faceIds ?? (context.selection.elementIds as FaceId[]);
    this.selectionBefore = context.selection.snapshot();
    this.before = serializeMesh(mesh);
    this.meshId = meshId;
    const extruded = extrudeFaces(
      mesh,
      { faceIds, distance: this.params.distance },
      createMeshOperationContext(context.ids),
    );
    this.after = serializeMesh(mesh);
    this.result = { capFaceIds: extruded.capFaceIds, sideFaceIds: extruded.sideFaceIds };
    context.syncMesh(mesh.id);
    applyOperationSelection(context, objectId, extruded);
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

  redo(context: CommandContext): ExtrudeFacesResult {
    return this.execute(context);
  }
}
