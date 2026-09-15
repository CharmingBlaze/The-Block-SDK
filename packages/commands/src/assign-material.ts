import type { FaceId, MaterialId, MeshId } from "@modeling-kit/core";
import type { MeshRecord } from "@modeling-kit/document";
import type { Command, CommandContext } from "@modeling-kit/history";
import { assignMaterialSlots } from "@modeling-kit/materials";
import { requireSelectedMesh } from "./require-selected-mesh";

export interface AssignMaterialParams {
  readonly materialId: MaterialId;
  readonly slot?: number;
  readonly faceIds?: readonly FaceId[];
}

export class AssignMaterialCommand implements Command<void> {
  readonly id = crypto.randomUUID();
  readonly label = "Assign Material";
  private meshId: MeshId | null = null;
  private before: MeshRecord | null = null;
  private after: MeshRecord | null = null;
  private beforeSlots: Array<{ faceId: FaceId; slot: number }> = [];

  constructor(readonly params: AssignMaterialParams) {}

  execute(context: CommandContext): void {
    const { meshId, mesh } = requireSelectedMesh(context);
    const record = context.document.meshes.get(meshId);
    if (!record) {
      throw new RangeError("AssignMaterialCommand could not resolve a mesh record");
    }
    if (this.after && this.meshId) {
      context.document.meshes.set(this.after);
      for (const face of mesh.faces.values()) {
        const saved = this.afterFaceSlots.get(face.id);
        if (saved !== undefined) {
          mesh.faces.set(face.id, { ...face, materialSlot: saved });
        }
      }
      mesh.bumpRevision();
      context.syncMesh(meshId);
      context.events.emit("document:changed", {
        aspect: "material",
        entityIds: [this.params.materialId],
      });
      return;
    }
    const faceIds = this.params.faceIds ?? (context.selection.elementIds as FaceId[]);
    this.meshId = meshId;
    this.before = { ...record, materialIds: [...record.materialIds] };
    this.beforeSlots = [...mesh.faces.values()].map((face) => ({
      faceId: face.id,
      slot: face.materialSlot,
    }));
    const updated = assignMaterialSlots(
      mesh,
      record,
      this.params.materialId,
      faceIds,
      this.params.slot ?? 0,
    );
    this.after = updated;
    this.afterFaceSlots = new Map(
      [...mesh.faces.values()].map((face) => [face.id, face.materialSlot]),
    );
    context.document.meshes.set(updated);
    context.syncMesh(meshId);
    context.events.emit("document:changed", {
      aspect: "material",
      entityIds: [this.params.materialId],
    });
    context.events.emit("mesh:changed", { meshIds: [meshId] });
  }

  private afterFaceSlots = new Map<FaceId, number>();

  undo(context: CommandContext): void {
    if (!this.before || !this.meshId) {
      return;
    }
    const mesh = context.meshes.get(this.meshId);
    if (mesh) {
      for (const entry of this.beforeSlots) {
        const face = mesh.faces.get(entry.faceId);
        if (face) {
          mesh.faces.set(entry.faceId, { ...face, materialSlot: entry.slot });
        }
      }
      mesh.bumpRevision();
    }
    context.document.meshes.set(this.before);
    context.syncMesh(this.meshId);
    context.events.emit("document:changed", {
      aspect: "material",
      entityIds: [this.params.materialId],
    });
  }

  redo(context: CommandContext): void {
    this.execute(context);
  }
}
