import { brand, type MaterialSlotId, type MeshId } from "@modeling-kit/core";
import type { MeshRecord } from "@modeling-kit/document";
import type { Command, CommandContext } from "@modeling-kit/history";
import {
  addSlotToRecord,
  reorderSlotsInRecord,
  syncMeshSlotIndices,
  type MaterialSlot,
  type MaterialSlotTarget,
} from "@modeling-kit/materials";

export interface AddMaterialSlotParams {
  readonly meshId?: MeshId | undefined;
  readonly slot?: MaterialSlot | undefined;
  readonly slotId?: MaterialSlotId | undefined;
  readonly name?: string | undefined;
  readonly target: MaterialSlotTarget;
}

export class AddMaterialSlotCommand implements Command<MaterialSlotId> {
  readonly id = crypto.randomUUID();
  readonly label = "Add Material Slot";
  private meshId: MeshId | null = null;
  private slotId: MaterialSlotId | null = null;
  private before: MeshRecord | null = null;
  private after: MeshRecord | null = null;

  constructor(readonly params: AddMaterialSlotParams) {}

  execute(context: CommandContext): MaterialSlotId {
    const meshId = this.params.meshId ?? resolveSelectedMeshId(context);
    const record = context.document.meshes.get(meshId);
    if (!record) {
      throw new RangeError(`AddMaterialSlotCommand: mesh '${meshId}' not found`);
    }

    if (this.after && this.slotId) {
      context.document.meshes.set(this.after);
      context.events.emit("document:changed", { aspect: "mesh", entityIds: [meshId] });
      return this.slotId;
    }

    this.meshId = meshId;
    this.before = {
      ...record,
      materialSlots: record.materialSlots ? [...record.materialSlots] : [],
      materialIds: [...record.materialIds],
    };

    const slotId = this.params.slot?.id ?? this.params.slotId ?? context.ids.materialSlot();
    const slot: MaterialSlot = this.params.slot ?? {
      id: slotId,
      name: this.params.name ?? `Slot ${(record.materialSlots?.length ?? 0) + 1}`,
      target: this.params.target,
      materialId: this.params.target.type === "material" ? this.params.target.materialId : null,
    };
    this.slotId = slotId;

    const updated = addSlotToRecord(record, slot);
    this.after = updated;

    context.document.meshes.set(updated);
    const mesh = context.meshes.get(meshId);
    if (mesh && updated.materialSlots) {
      syncMeshSlotIndices(mesh, updated.materialSlots);
    }
    context.events.emit("document:changed", { aspect: "mesh", entityIds: [meshId] });
    return slotId;
  }

  undo(context: CommandContext): void {
    if (!this.before || !this.meshId) {
      return;
    }
    context.document.meshes.set(this.before);
    const mesh = context.meshes.get(this.meshId);
    if (mesh && this.before.materialSlots) {
      syncMeshSlotIndices(mesh, this.before.materialSlots);
    }
    context.events.emit("document:changed", { aspect: "mesh", entityIds: [this.meshId] });
  }

  redo(context: CommandContext): MaterialSlotId {
    return this.execute(context);
  }
}

export interface ReorderMaterialSlotsParams {
  readonly meshId?: MeshId | undefined;
  readonly orderedSlotIds: readonly MaterialSlotId[];
}

export class ReorderMaterialSlotsCommand implements Command<void> {
  readonly id = crypto.randomUUID();
  readonly label = "Reorder Material Slots";
  private meshId: MeshId | null = null;
  private before: MeshRecord | null = null;
  private after: MeshRecord | null = null;

  constructor(readonly params: ReorderMaterialSlotsParams) {}

  execute(context: CommandContext): void {
    const meshId = this.params.meshId ?? resolveSelectedMeshId(context);
    const record = context.document.meshes.get(meshId);
    if (!record) {
      throw new RangeError(`ReorderMaterialSlotsCommand: mesh '${meshId}' not found`);
    }

    if (this.after) {
      context.document.meshes.set(this.after);
      const mesh = context.meshes.get(meshId);
      if (mesh && this.after.materialSlots) {
        syncMeshSlotIndices(mesh, this.after.materialSlots);
        context.syncMesh(meshId);
      }
      context.events.emit("document:changed", { aspect: "mesh", entityIds: [meshId] });
      return;
    }

    this.meshId = meshId;
    this.before = {
      ...record,
      materialSlots: record.materialSlots ? [...record.materialSlots] : [],
      materialIds: [...record.materialIds],
    };

    const updated = reorderSlotsInRecord(record, this.params.orderedSlotIds);
    this.after = updated;

    context.document.meshes.set(updated);
    const mesh = context.meshes.get(meshId);
    if (mesh && updated.materialSlots) {
      // Synchronize numeric slot indices to new order; face.materialSlotId is preserved
      syncMeshSlotIndices(mesh, updated.materialSlots);
      context.syncMesh(meshId);
    }
    context.events.emit("document:changed", { aspect: "mesh", entityIds: [meshId] });
    context.events.emit("mesh:changed", { meshIds: [meshId] });
  }

  undo(context: CommandContext): void {
    if (!this.before || !this.meshId) {
      return;
    }
    context.document.meshes.set(this.before);
    const mesh = context.meshes.get(this.meshId);
    if (mesh && this.before.materialSlots) {
      syncMeshSlotIndices(mesh, this.before.materialSlots);
      context.syncMesh(this.meshId);
    }
    context.events.emit("document:changed", { aspect: "mesh", entityIds: [this.meshId] });
    context.events.emit("mesh:changed", { meshIds: [this.meshId] });
  }

  redo(context: CommandContext): void {
    this.execute(context);
  }
}

function resolveSelectedMeshId(context: CommandContext): MeshId {
  const objectId = context.selection.objectIds[0];
  if (!objectId) {
    throw new RangeError("Operation requires a selected object or explicit meshId");
  }
  const node = context.document.scene.nodes.get(objectId);
  const meshId = node?.payloadRef ? brand<string, "MeshId">(node.payloadRef) : undefined;
  if (!meshId) {
    throw new RangeError("Selected object does not reference a mesh");
  }
  return meshId;
}
