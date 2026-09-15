import type { MeshId, ObjectId } from "@modeling-kit/core";
import type { Command, CommandContext } from "@modeling-kit/history";
import { deserializeMesh, serializeMesh } from "@modeling-kit/mesh";
import { getNode, linkMesh, nodeMeshId } from "@modeling-kit/document";

export interface MakeMeshIndependentParams {
  readonly objectId: ObjectId;
}

export interface MakeMeshIndependentResult {
  readonly meshId: MeshId;
}

export class MakeMeshIndependentCommand implements Command<MakeMeshIndependentResult> {
  readonly id = crypto.randomUUID();
  readonly label = "Make mesh independent";
  private previousMeshId: MeshId | undefined;
  private createdMeshId: MeshId | undefined;

  constructor(readonly params: MakeMeshIndependentParams) {}

  execute(context: CommandContext): MakeMeshIndependentResult {
    const node = getNode(context.document, this.params.objectId);
    const sourceId = nodeMeshId(node);
    if (!sourceId) {
      throw new RangeError("Node does not reference a mesh");
    }
    if (this.createdMeshId) {
      linkMesh(context.document, this.params.objectId, this.createdMeshId);
      context.events.emit("document:changed", {
        aspect: "scene",
        kind: "mesh-reference",
        objectIds: [this.params.objectId],
      });
      return { meshId: this.createdMeshId };
    }
    this.previousMeshId = sourceId;
    const sourceMesh = context.meshes.get(sourceId);
    const sourceRecord = context.document.meshes.get(sourceId);
    if (!sourceMesh || !sourceRecord) {
      throw new RangeError("Source mesh is missing");
    }
    const meshId = context.ids.mesh();
    const kernel = { ...serializeMesh(sourceMesh), id: meshId };
    context.meshes.set(meshId, deserializeMesh(kernel));
    context.document.meshes.set({ ...sourceRecord, id: meshId, kernel });
    linkMesh(context.document, this.params.objectId, meshId);
    this.createdMeshId = meshId;
    context.events.emit("document:changed", {
      aspect: "scene",
      kind: "mesh-reference",
      objectIds: [this.params.objectId],
    });
    context.events.emit("mesh:changed", { meshIds: [meshId] });
    return { meshId };
  }

  undo(context: CommandContext): void {
    if (!this.previousMeshId || !this.createdMeshId) {
      return;
    }
    linkMesh(context.document, this.params.objectId, this.previousMeshId);
    context.document.meshes.delete(this.createdMeshId);
    context.meshes.delete(this.createdMeshId);
    context.events.emit("document:changed", {
      aspect: "scene",
      kind: "mesh-reference",
      objectIds: [this.params.objectId],
    });
  }

  redo(context: CommandContext): MakeMeshIndependentResult {
    return this.execute(context);
  }
}
