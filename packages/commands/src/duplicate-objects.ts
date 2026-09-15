import type { MeshId, ObjectId } from "@modeling-kit/core";
import type { MeshRecord, SceneNode } from "@modeling-kit/document";
import type { Command, CommandContext } from "@modeling-kit/history";
import { deserializeMesh, serializeMesh, type SerializedMesh } from "@modeling-kit/mesh";
import { addNode, descendants, duplicateSubtree, getNode, removeNode } from "@modeling-kit/scene";

export interface DuplicateObjectsParams {
  readonly objectId?: ObjectId;
  readonly linkMeshes?: boolean;
}

export interface DuplicateObjectsResult {
  readonly objectId: ObjectId;
  readonly meshIds: readonly MeshId[];
}

interface ClonedMesh {
  readonly meshId: MeshId;
  readonly record: MeshRecord;
  readonly kernel: SerializedMesh;
}

export class DuplicateObjectsCommand implements Command<DuplicateObjectsResult> {
  readonly id = crypto.randomUUID();
  readonly label = "Duplicate";
  private result: DuplicateObjectsResult | null = null;
  private nodes: SceneNode[] = [];
  private clones: ClonedMesh[] = [];

  constructor(readonly params: DuplicateObjectsParams = {}) {}

  execute(context: CommandContext): DuplicateObjectsResult {
    if (this.result) {
      this.restoreCreated(context);
      return this.result;
    }
    const sourceId = this.params.objectId ?? context.selection.objectIds[0];
    if (!sourceId) {
      throw new RangeError("DuplicateObjectsCommand requires an object selection");
    }
    const copyId = duplicateSubtree(context.document, sourceId, () => context.ids.object(), {
      mesh: this.params.linkMeshes ? "link" : "independent",
    });
    const copyRoot = getNode(context.document, copyId);
    context.document.scene.nodes.set(copyId, { ...copyRoot, name: `${copyRoot.name} Copy` });
    const meshIds: MeshId[] = [];
    const nodeIds = [copyId, ...descendants(context.document, copyId)];
    if (!this.params.linkMeshes) {
    for (const objectId of nodeIds) {
      const node = getNode(context.document, objectId);
      if ((node.type !== "mesh_instance" && node.type !== "mesh") || !node.payloadRef) {
        continue;
      }
      const sourceMeshId = node.payloadRef as MeshId;
      const sourceMesh = context.meshes.get(sourceMeshId);
      const sourceRecord = context.document.meshes.get(sourceMeshId);
      if (!sourceMesh || !sourceRecord) {
        continue;
      }
      const meshId = context.ids.mesh();
      const kernel = { ...serializeMesh(sourceMesh), id: meshId };
      const mesh = deserializeMesh(kernel);
      const record: MeshRecord = {
        ...sourceRecord,
        id: meshId,
        name: `${sourceRecord.name} Copy`,
        kernel,
      };
      context.meshes.set(meshId, mesh);
      context.document.meshes.set(record);
      context.document.scene.nodes.set(objectId, { ...getNode(context.document, objectId), payloadRef: meshId });
      meshIds.push(meshId);
      this.clones.push({ meshId, record, kernel });
    }
    }
    this.nodes = nodeIds.map((id) => getNode(context.document, id));
    this.result = { objectId: copyId, meshIds };
    this.emit(context);
    return this.result;
  }

  undo(context: CommandContext): void {
    if (!this.result) {
      return;
    }
    removeNode(context.document, this.result.objectId);
    for (const clone of this.clones) {
      context.document.meshes.delete(clone.meshId);
      context.meshes.delete(clone.meshId);
    }
    this.emit(context);
  }

  redo(context: CommandContext): DuplicateObjectsResult {
    return this.execute(context);
  }

  private restoreCreated(context: CommandContext): void {
    const result = this.result!;
    if (context.document.scene.nodes.has(result.objectId)) {
      return;
    }
    for (const clone of this.clones) {
      context.meshes.set(clone.meshId, deserializeMesh(clone.kernel));
      context.document.meshes.set(clone.record);
    }
    for (const node of this.nodes) {
      if (context.document.scene.nodes.has(node.id)) {
        continue;
      }
      addNode(context.document, node.id, {
        name: node.name,
        type: node.type,
        parentId: node.parentId ?? context.document.scene.rootNodeId,
        localTransform: node.localTransform,
        ...(node.payloadRef !== undefined ? { payloadRef: node.payloadRef } : {}),
        metadata: node.metadata,
        tags: node.tags,
      });
    }
    this.emit(context);
  }

  private emit(context: CommandContext): void {
    if (!this.result) {
      return;
    }
    context.events.emit("document:changed", { aspect: "scene", objectIds: [this.result.objectId] });
    if (this.result.meshIds.length > 0) {
      context.events.emit("mesh:changed", { meshIds: [...this.result.meshIds] });
    }
  }
}
