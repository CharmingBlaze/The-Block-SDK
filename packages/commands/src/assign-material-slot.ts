import { brand, type FaceId, type MaterialSlotId, type MeshId } from "@modeling-kit/core";
import type { Command, CommandContext } from "@modeling-kit/history";
import { restoreMesh, serializeMesh, type SerializedMesh } from "@modeling-kit/mesh";

export interface AssignMaterialSlotParams {
  readonly slotId?: MaterialSlotId | undefined;
  readonly slotIndex?: number | undefined;
  readonly meshId?: MeshId | undefined;
  readonly faceIds?: readonly FaceId[] | undefined;
}

export class AssignMaterialSlotCommand implements Command<void> {
  readonly id = crypto.randomUUID();
  readonly label = "Assign Material Slot";
  private before: SerializedMesh | null = null;
  private after: SerializedMesh | null = null;
  private meshId: MeshId | null = null;

  constructor(readonly params: AssignMaterialSlotParams) {}

  execute(context: CommandContext): void {
    if (this.after && this.meshId) {
      const mesh = context.meshes.get(this.meshId);
      if (mesh) {
        restoreMesh(mesh, this.after);
        context.syncMesh(mesh.id);
        context.events.emit("mesh:changed", { meshIds: [mesh.id] });
      }
      return;
    }

    let meshId = this.params.meshId;
    if (!meshId) {
      const objectId = context.selection.objectIds[0];
      if (!objectId) {
        throw new RangeError("AssignMaterialSlotCommand requires an object selection or explicit meshId");
      }
      const node = context.document.scene.nodes.get(objectId);
      meshId = node?.payloadRef ? brand<string, "MeshId">(node.payloadRef) : undefined;
    }

    const mesh = meshId ? context.meshes.get(meshId) : undefined;
    if (!mesh || !meshId) {
      throw new RangeError("AssignMaterialSlotCommand could not resolve a mesh");
    }

    const record = context.document.meshes.get(meshId);
    let resolvedSlotId: MaterialSlotId | null = this.params.slotId ?? null;
    let resolvedSlotIndex = this.params.slotIndex ?? 0;

    if (this.params.slotId && record?.materialSlots) {
      const idx = record.materialSlots.findIndex((s) => s.id === this.params.slotId);
      if (idx >= 0) {
        resolvedSlotIndex = idx;
      }
    } else if (this.params.slotIndex !== undefined && record?.materialSlots) {
      const slot = record.materialSlots[this.params.slotIndex];
      if (slot) {
        resolvedSlotId = slot.id;
      }
    }

    const faceIds =
      this.params.faceIds ??
      (context.selection.elementIds.length > 0
        ? (context.selection.elementIds as FaceId[])
        : Array.from(mesh.faces.keys()));

    this.before = serializeMesh(mesh);
    this.meshId = meshId;

    for (const fId of faceIds) {
      const face = mesh.faces.get(fId);
      if (face) {
        mesh.faces.set(fId, {
          ...face,
          materialSlot: resolvedSlotIndex,
          materialSlotId: resolvedSlotId,
        });
      }
    }
    mesh.bumpMaterialsRevision();

    this.after = serializeMesh(mesh);
    context.syncMesh(mesh.id);
    context.events.emit("mesh:changed", { meshIds: [mesh.id] });
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
    context.events.emit("mesh:changed", { meshIds: [mesh.id] });
  }

  redo(context: CommandContext): void {
    this.execute(context);
  }
}
