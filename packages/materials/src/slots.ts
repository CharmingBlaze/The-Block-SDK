import { brand, type FaceId, type MaterialId, type MaterialSlotId } from "@modeling-kit/core";
import type { MeshRecord } from "@modeling-kit/document";
import type { HalfEdgeMesh } from "@modeling-kit/mesh";
import type { MaterialSlot } from "./types";

/**
 * Assigns a stable MaterialSlotId to specified faces on a HalfEdgeMesh.
 * Also keeps the numeric face.materialSlot synchronized with the slot index.
 */
export function assignFaceMaterialSlot(
  mesh: HalfEdgeMesh,
  faceIds: readonly FaceId[],
  slotId: MaterialSlotId | null,
  slotIndex = 0,
): void {
  for (const faceId of faceIds) {
    const face = mesh.faces.get(faceId);
    if (face) {
      mesh.faces.set(faceId, {
        ...face,
        materialSlotId: slotId,
        materialSlot: slotIndex,
      });
    }
  }
  mesh.bumpMaterialsRevision();
}

/**
 * Synchronizes the numeric `materialSlot` on each face to match the index of its
 * stable `materialSlotId` in the provided `slots` list.
 * Crucially, face `materialSlotId` is NEVER modified by reordering.
 */
export function syncMeshSlotIndices(mesh: HalfEdgeMesh, slots: readonly MaterialSlot[]): void {
  const slotIndexMap = new Map<MaterialSlotId, number>();
  for (let i = 0; i < slots.length; i++) {
    slotIndexMap.set(slots[i]!.id, i);
  }

  for (const face of mesh.faces.values()) {
    if (face.materialSlotId) {
      const idx = slotIndexMap.get(face.materialSlotId);
      if (idx !== undefined && face.materialSlot !== idx) {
        mesh.faces.set(face.id, {
          ...face,
          materialSlot: idx,
        });
      }
    }
  }
  mesh.bumpMaterialsRevision();
}

/**
 * Adds a stable MaterialSlot to a MeshRecord and returns the updated record.
 */
export function addSlotToRecord(record: MeshRecord, slot: MaterialSlot): MeshRecord {
  const currentSlots = record.materialSlots ? [...record.materialSlots] : [];
  const existingIdx = currentSlots.findIndex((s) => s.id === slot.id);
  if (existingIdx >= 0) {
    currentSlots[existingIdx] = slot;
  } else {
    currentSlots.push(slot);
  }

  const materialIds = currentSlots
    .map((item) => (item.target.type === "material" ? item.target.materialId : null))
    .filter((id): id is MaterialId => id !== null);

  return {
    ...record,
    materialSlots: currentSlots,
    materialIds,
  };
}

/**
 * Reorders slots on a MeshRecord according to the given slot IDs.
 * Does not modify face assignments.
 */
export function reorderSlotsInRecord(
  record: MeshRecord,
  orderedSlotIds: readonly MaterialSlotId[],
): MeshRecord {
  const currentSlots = record.materialSlots ? [...record.materialSlots] : [];
  const slotMap = new Map<MaterialSlotId, MaterialSlot>();
  for (const slot of currentSlots) {
    slotMap.set(slot.id, slot);
  }

  const reordered: MaterialSlot[] = [];
  for (const id of orderedSlotIds) {
    const slot = slotMap.get(id);
    if (slot) {
      reordered.push(slot);
      slotMap.delete(id);
    }
  }
  // Append any unmentioned slots to avoid dropping them
  for (const remaining of slotMap.values()) {
    reordered.push(remaining);
  }

  const materialIds = reordered
    .map((s) => (s.target.type === "material" ? s.target.materialId : null))
    .filter((id): id is MaterialId => id !== null);

  return {
    ...record,
    materialSlots: reordered,
    materialIds,
  };
}

/**
 * Legacy slot assignment maintained for backwards compatibility.
 */
export function assignMaterialSlots(
  mesh: HalfEdgeMesh,
  record: MeshRecord,
  materialId: MaterialId,
  faceIds: readonly FaceId[],
  slot = 0,
): MeshRecord {
  const materialIds = [...record.materialIds];
  while (materialIds.length <= slot) {
    materialIds.push(materialId);
  }
  materialIds[slot] = materialId;

  // Maintain materialSlots list on the record
  const currentSlots: MaterialSlot[] = record.materialSlots ? [...record.materialSlots] : [];
  while (currentSlots.length <= slot) {
    const slotIdx = currentSlots.length;
    const slotId = brand<string, "MaterialSlotId">(`slot-${slotIdx}`);
    currentSlots.push({
      id: slotId,
      name: `Slot ${slotIdx + 1}`,
      target: { type: "material", materialId },
      slotIndex: slotIdx,
      materialId,
    });
  }
  currentSlots[slot] = {
    ...currentSlots[slot]!,
    target: { type: "material", materialId },
    materialId,
  };

  const assignedSlotId = currentSlots[slot]!.id;

  for (const faceId of faceIds) {
    const face = mesh.faces.get(faceId);
    if (face) {
      mesh.faces.set(faceId, {
        ...face,
        materialSlot: slot,
        materialSlotId: assignedSlotId,
      });
    }
  }
  mesh.bumpMaterialsRevision();
  return { ...record, materialIds, materialSlots: currentSlots };
}
