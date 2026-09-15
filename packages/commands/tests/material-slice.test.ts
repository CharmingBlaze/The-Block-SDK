import { createSequenceIdFactory } from "@modeling-kit/core";
import {
  parseDocument,
  serializeDocument,
} from "@modeling-kit/document";
import { describe, expect, it } from "vitest";
import {
  AddMaterialSlotCommand,
  AssignMaterialSlotCommand,
  createEditor,
  createModelingSession,
  CreateMaterialCommand,
  CreatePrimitiveCommand,
  ReorderMaterialSlotsCommand,
  UpdateMaterialCommand,
} from "../src/index";

describe("Material First Vertical Slice Acceptance Workflow", () => {
  it("executes the exact required acceptance workflow end-to-end", () => {
    // 1. Create document (via ModelingSession)
    const ids = createSequenceIdFactory("accept");
    const session = createModelingSession(ids);
    const doc = session.document;

    // 2. Create cube
    const cube = session.execute(
      new CreatePrimitiveCommand("cube", { width: 1, height: 1, depth: 1 }),
    );
    const mesh = session.meshes.get(cube.meshId)!;
    expect(mesh.faces.size).toBe(6);

    // 3. Create PBR material
    const pbrId = session.execute(
      new CreateMaterialCommand({
        name: "PBR Material",
        type: "standard-pbr",
        baseColor: [1, 0.5, 0, 1], // Orange
        metallic: 0.8,
        roughness: 0.2,
      }),
    );
    const pbrMat = doc.materials.require(pbrId);
    expect(pbrMat.name).toBe("PBR Material");
    expect(pbrMat.baseColor).toEqual([1, 0.5, 0, 1]);
    expect(pbrMat.metallic).toBe(0.8);

    // 4. Create unlit material
    const unlitId = session.execute(
      new CreateMaterialCommand({
        name: "Unlit Material",
        type: "unlit",
        color: [0, 1, 0, 1], // Green
        opacity: 0.9,
      }),
    );
    const unlitMat = doc.materials.require(unlitId);
    expect(unlitMat.name).toBe("Unlit Material");
    expect(unlitMat.type).toBe("unlit");
    expect(unlitMat.color).toEqual([0, 1, 0, 1]);
    expect(unlitMat.baseColor).toEqual([0, 1, 0, 1]);

    // 5. Add two stable material slots
    const slot1Id = session.execute(
      new AddMaterialSlotCommand({
        meshId: cube.meshId,
        name: "Slot 1 (PBR)",
        target: { type: "material", materialId: pbrId },
      }),
    );
    const slot2Id = session.execute(
      new AddMaterialSlotCommand({
        meshId: cube.meshId,
        name: "Slot 2 (Unlit)",
        target: { type: "material", materialId: unlitId },
      }),
    );
    const meshRecord = doc.meshes.require(cube.meshId);
    expect(meshRecord.materialSlots).toHaveLength(2);
    expect(meshRecord.materialSlots?.[0]?.id).toBe(slot1Id);
    expect(meshRecord.materialSlots?.[1]?.id).toBe(slot2Id);

    // 6. Assign different faces to each slot
    const allFaces = [...mesh.faces.keys()];
    const facesForSlot1 = [allFaces[0]!, allFaces[1]!, allFaces[2]!];
    const facesForSlot2 = [allFaces[3]!, allFaces[4]!, allFaces[5]!];

    session.execute(
      new AssignMaterialSlotCommand({
        meshId: cube.meshId,
        slotId: slot1Id,
        faceIds: facesForSlot1,
      }),
    );
    session.execute(
      new AssignMaterialSlotCommand({
        meshId: cube.meshId,
        slotId: slot2Id,
        faceIds: facesForSlot2,
      }),
    );

    for (const fId of facesForSlot1) {
      const face = mesh.faces.get(fId)!;
      expect(face.materialSlotId).toBe(slot1Id);
      expect(face.materialSlot).toBe(0);
    }
    for (const fId of facesForSlot2) {
      const face = mesh.faces.get(fId)!;
      expect(face.materialSlotId).toBe(slot2Id);
      expect(face.materialSlot).toBe(1);
    }

    // 7. Reorder slots: slot 2 first, slot 1 second
    session.execute(
      new ReorderMaterialSlotsCommand({
        meshId: cube.meshId,
        orderedSlotIds: [slot2Id, slot1Id],
      }),
    );
    const reorderedMeshRecord = doc.meshes.require(cube.meshId);
    expect(reorderedMeshRecord.materialSlots?.[0]?.id).toBe(slot2Id);
    expect(reorderedMeshRecord.materialSlots?.[1]?.id).toBe(slot1Id);

    // 8. Verify assignments remain unchanged with respect to stable slot IDs
    for (const fId of facesForSlot1) {
      const face = mesh.faces.get(fId)!;
      expect(face.materialSlotId).toBe(slot1Id); // Assignment remained unchanged!
      expect(face.materialSlot).toBe(1); // Index updated to match reordered slot
    }
    for (const fId of facesForSlot2) {
      const face = mesh.faces.get(fId)!;
      expect(face.materialSlotId).toBe(slot2Id); // Assignment remained unchanged!
      expect(face.materialSlot).toBe(0); // Index updated to match reordered slot
    }

    // 9. Change PBR base color
    session.execute(
      new UpdateMaterialCommand({
        materialId: pbrId,
        patch: { baseColor: [0, 0, 1, 1] }, // Blue
      }),
    );
    expect(doc.materials.require(pbrId).baseColor).toEqual([0, 0, 1, 1]);
    expect(doc.materials.require(pbrId).color).toEqual([0, 0, 1, 1]);

    // 10. Undo (verify base color reverted to orange)
    session.undo();
    expect(doc.materials.require(pbrId).baseColor).toEqual([1, 0.5, 0, 1]);

    // 11. Redo (verify base color re-applied to blue)
    session.redo();
    expect(doc.materials.require(pbrId).baseColor).toEqual([0, 0, 1, 1]);

    // 12. Save (serialize document)
    const serializedJson = serializeDocument(doc);
    expect(serializedJson).toContain("Slot 1 (PBR)");
    expect(serializedJson).toContain("Slot 2 (Unlit)");

    // 13. Reload (parse document)
    const reloadedDoc = parseDocument(serializedJson);

    // 14. Verify IDs, properties, and face assignments
    expect(reloadedDoc.materials.has(pbrId)).toBe(true);
    expect(reloadedDoc.materials.has(unlitId)).toBe(true);

    const reloadedPbr = reloadedDoc.materials.require(pbrId);
    expect(reloadedPbr.name).toBe("PBR Material");
    expect(reloadedPbr.baseColor).toEqual([0, 0, 1, 1]);
    expect(reloadedPbr.metallic).toBe(0.8);

    const reloadedUnlit = reloadedDoc.materials.require(unlitId);
    expect(reloadedUnlit.name).toBe("Unlit Material");
    expect(reloadedUnlit.type).toBe("unlit");
    expect(reloadedUnlit.color).toEqual([0, 1, 0, 1]);

    const reloadedMeshRecord = reloadedDoc.meshes.require(cube.meshId);
    expect(reloadedMeshRecord.materialSlots).toHaveLength(2);
    expect(reloadedMeshRecord.materialSlots?.[0]?.id).toBe(slot2Id);
    expect(reloadedMeshRecord.materialSlots?.[1]?.id).toBe(slot1Id);
  });

  it("supports undo and redo of material slot reordering and face assignments", () => {
    const ids = createSequenceIdFactory("hist");
    const session = createModelingSession(ids);

    const cube = session.execute(
      new CreatePrimitiveCommand("cube", { width: 1, height: 1, depth: 1 }),
    );
    const mesh = session.meshes.get(cube.meshId)!;
    const m1 = session.execute(new CreateMaterialCommand({ name: "M1" }));
    const m2 = session.execute(new CreateMaterialCommand({ name: "M2" }));

    const slot1 = session.execute(
      new AddMaterialSlotCommand({
        meshId: cube.meshId,
        name: "S1",
        target: { type: "material", materialId: m1 },
      }),
    );
    const slot2 = session.execute(
      new AddMaterialSlotCommand({
        meshId: cube.meshId,
        name: "S2",
        target: { type: "material", materialId: m2 },
      }),
    );

    const topFace = cube.faceIds.posY;

    // Assign slot2 to top face
    session.execute(
      new AssignMaterialSlotCommand({
        meshId: cube.meshId,
        slotId: slot2,
        faceIds: [topFace],
      }),
    );
    expect(mesh.faces.get(topFace)?.materialSlotId).toBe(slot2);

    // Undo face assignment
    session.undo();
    expect(mesh.faces.get(topFace)?.materialSlotId).not.toBe(slot2);

    // Redo face assignment
    session.redo();
    expect(mesh.faces.get(topFace)?.materialSlotId).toBe(slot2);

    // Reorder slots
    session.execute(
      new ReorderMaterialSlotsCommand({
        meshId: cube.meshId,
        orderedSlotIds: [slot2, slot1],
      }),
    );
    expect(session.document.meshes.require(cube.meshId).materialSlots?.[0]?.id).toBe(slot2);

    // Undo reorder
    session.undo();
    expect(session.document.meshes.require(cube.meshId).materialSlots?.[0]?.id).toBe(slot1);

    // Redo reorder
    session.redo();
    expect(session.document.meshes.require(cube.meshId).materialSlots?.[0]?.id).toBe(slot2);
  });

  it("supports fluent editor syntax for materials and slots", () => {
    const editor = createEditor();
    const cube = editor.spawn.primitive("cube");

    const pbrId = editor.createPbrMaterial({ name: "Shiny", metallic: 0.9 });
    const slotId = cube.addMaterialSlot({ type: "material", materialId: pbrId }, "Main Slot");

    cube.select("top").assignMaterialSlot(slotId);

    const mesh = cube.mesh!;
    const topFaceId = cube.groups?.posY;
    expect(topFaceId).toBeDefined();
    expect(mesh.faces.get(topFaceId!)?.materialSlotId).toBe(slotId);

    // Update material via fluent editor
    editor.updateMaterial(pbrId, { roughness: 0.1 });
    expect(editor.session.document.materials.require(pbrId).roughness).toBe(0.1);

    editor.undo();
    expect(editor.session.document.materials.require(pbrId).roughness).toBe(0.5); // default
  });
});
