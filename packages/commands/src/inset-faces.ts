import { brand, type FaceId, type MeshId } from "@modeling-kit/core";
import type { Command, CommandContext } from "@modeling-kit/history";
import {
  createMeshOperationContext,
  insetFaces as insetFacesOp,
  restoreMesh,
  serializeMesh,
  type InsetFacesResult,
  type SerializedMesh,
} from "@modeling-kit/mesh";
import type { SelectionSnapshot } from "@modeling-kit/selection";
import { applyOperationSelection, restoreSelection } from "./selection-from-mapping";

export interface InsetFacesParams {
  readonly distance: number;
  readonly faceIds?: readonly FaceId[];
  readonly mode?: "individual" | "region";
}

export class InsetFacesCommand implements Command<InsetFacesResult> {
  readonly id = crypto.randomUUID();
  readonly label = "Inset Faces";
  private before: SerializedMesh | null = null;
  private after: SerializedMesh | null = null;
  private meshId: MeshId | null = null;
  private result: InsetFacesResult | null = null;
  private selectionBefore: SelectionSnapshot | null = null;
  private selectionAfter: SelectionSnapshot | null = null;

  constructor(readonly params: InsetFacesParams) {}

  execute(context: CommandContext): InsetFacesResult {
    if (this.after && this.meshId) {
      const mesh = context.meshes.get(this.meshId);
      if (mesh) {
        restoreMesh(mesh, this.after);
        context.syncMesh(mesh.id);
      }
      restoreSelection(context, this.selectionAfter);
      return this.result ?? { innerFaceIds: [], ringFaceIds: [], vertexMap: new Map() };
    }

    const objectId = context.selection.objectIds[0];
    if (!objectId) {
      throw new RangeError("InsetFacesCommand requires an object selection");
    }
    const node = context.document.scene.nodes.get(objectId);
    const meshId = node?.payloadRef ? brand<string, "MeshId">(node.payloadRef) : undefined;
    const mesh = meshId ? context.meshes.get(meshId) : undefined;
    if (!mesh || !meshId) {
      throw new RangeError("InsetFacesCommand could not resolve a mesh");
    }

    const faceIds = this.params.faceIds ?? (context.selection.elementIds as FaceId[]);
    this.selectionBefore = context.selection.snapshot();
    this.before = serializeMesh(mesh);
    this.meshId = meshId;
    const inset = insetFacesOp(
      mesh,
      {
        faceIds,
        distance: this.params.distance,
        mode: this.params.mode ?? "individual",
      },
      createMeshOperationContext(context.ids),
    );
    this.after = serializeMesh(mesh);
    this.result = {
      innerFaceIds: inset.innerFaceIds,
      ringFaceIds: inset.ringFaceIds,
      vertexMap: inset.vertexMap,
    };
    context.syncMesh(mesh.id);
    applyOperationSelection(context, objectId, inset);
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

  redo(context: CommandContext): InsetFacesResult {
    return this.execute(context);
  }
}
