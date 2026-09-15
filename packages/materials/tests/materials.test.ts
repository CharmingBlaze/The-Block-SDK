import { createSequenceIdFactory } from "@modeling-kit/core";
import {
  createMaterialData,
  createModelDocument,
  parseDocument,
  serializeDocument,
} from "@modeling-kit/document";
import { MeshBuilder } from "@modeling-kit/mesh";
import { describe, expect, it } from "vitest";
import {
  addSlotToRecord,
  assignFaceMaterialSlot,
  assignMaterialSlots,
  createMaterialSlot,
  createStandardPbrMaterial,
  createUnlitMaterial,
  MaterialLibrary,
  reorderSlotsInRecord,
  syncMeshSlotIndices,
  validateStandardPbrMaterial,
  validateUnlitMaterial,
} from "../src/index";

describe("@modeling-kit/materials", () => {
  it("round-trips PBR fields in native JSON", () => {
    const ids = createSequenceIdFactory("mat");
    const doc = createModelDocument({ ids });
    const material = createMaterialData(ids.material(), "Paint", {
      baseColor: [1, 0, 0, 1],
      metallic: 0.2,
      roughness: 0.4,
      pixelArt: true,
    });
    doc.materials.set(material);
    const again = parseDocument(serializeDocument(doc));
    expect(again.materials.get(material.id)?.baseColor).toEqual([1, 0, 0, 1]);
    expect(again.materials.get(material.id)?.pixelArt).toBe(true);
  });

  it("keeps color/emissive dual fields and texture bindings in sync", () => {
    const ids = createSequenceIdFactory("alias");
    const fromColor = createMaterialData(ids.material(), "FromColor", {
      color: [0.1, 0.2, 0.3, 1],
      emissiveColor: [0.4, 0.5, 0.6],
    });
    expect(fromColor.baseColor).toEqual([0.1, 0.2, 0.3, 1]);
    expect(fromColor.color).toEqual([0.1, 0.2, 0.3, 1]);
    expect(fromColor.emissive).toEqual([0.4, 0.5, 0.6]);
    expect(fromColor.emissiveColor).toEqual([0.4, 0.5, 0.6]);

    const textureId = ids.texture();
    const fromSlot = createMaterialData(ids.material(), "FromSlot", {
      baseColorTexture: textureId,
    });
    expect(fromSlot.textureBindings?.baseColor?.textureId).toBe(textureId);
    expect(fromSlot.baseColorTexture).toBe(textureId);
  });

  it("assigns a material slot on selected faces (legacy)", () => {
    const ids = createSequenceIdFactory("slot");
    const mesh = MeshBuilder.createCube(1, 1, 1, ids.mesh());
    const materialId = ids.material();
    const faceIds = [...mesh.faces.keys()];
    const record = assignMaterialSlots(
      mesh,
      { id: mesh.id, name: "Cube", materialIds: [], metadata: {} },
      materialId,
      faceIds,
      0,
    );
    expect(record.materialIds[0]).toBe(materialId);
    expect([...mesh.faces.values()].every((f) => f.materialSlot === 0)).toBe(true);
  });

  describe("Canonical PBR and Unlit Materials", () => {
    it("creates standard PBR materials with full properties and validation", () => {
      const ids = createSequenceIdFactory("pbr");
      const pbr = createStandardPbrMaterial({
        id: ids.material(),
        name: "Gold",
        baseColor: [1, 0.84, 0, 1],
        metallic: 1,
        roughness: 0.1,
        emissiveColor: [0.1, 0.08, 0],
        emissiveStrength: 2,
        opacity: 1,
        alphaMode: "opaque",
        alphaCutoff: 0.5,
        doubleSided: true,
        normalScale: 1.5,
        occlusionStrength: 0.8,
      });

      expect(pbr.type).toBe("standard-pbr");
      expect(pbr.name).toBe("Gold");
      expect(pbr.metallic).toBe(1);
      expect(pbr.roughness).toBe(0.1);
      expect(pbr.emissiveColor).toEqual([0.1, 0.08, 0]);
      expect(pbr.doubleSided).toBe(true);

      const res = validateStandardPbrMaterial(pbr);
      expect(res.valid).toBe(true);
      expect(res.errors).toHaveLength(0);
    });

    it("creates unlit materials with full properties and validation", () => {
      const ids = createSequenceIdFactory("unlit");
      const unlit = createUnlitMaterial({
        id: ids.material(),
        name: "Flat Red",
        color: [1, 0, 0, 1],
        opacity: 0.9,
        alphaMode: "blend",
        doubleSided: false,
        vertexColors: true,
      });

      expect(unlit.type).toBe("unlit");
      expect(unlit.name).toBe("Flat Red");
      expect(unlit.color).toEqual([1, 0, 0, 1]);
      expect(unlit.vertexColors).toBe(true);

      const res = validateUnlitMaterial(unlit);
      expect(res.valid).toBe(true);
      expect(res.errors).toHaveLength(0);
    });

    it("rejects non-finite and out-of-range numeric values", () => {
      const ids = createSequenceIdFactory("val");

      // NaN in baseColor
      expect(() =>
        createStandardPbrMaterial({
          id: ids.material(),
          baseColor: [NaN, 0, 0, 1],
        }),
      ).toThrow("validation failed");

      // Infinity in roughness
      expect(() =>
        createStandardPbrMaterial({
          id: ids.material(),
          roughness: Infinity,
        }),
      ).toThrow("validation failed");

      // Metallic > 1
      expect(() =>
        createStandardPbrMaterial({
          id: ids.material(),
          metallic: 1.5,
        }),
      ).toThrow("validation failed");

      // Metallic < 0
      expect(() =>
        createStandardPbrMaterial({
          id: ids.material(),
          metallic: -0.1,
        }),
      ).toThrow("validation failed");

      // Negative emissive strength
      expect(() =>
        createStandardPbrMaterial({
          id: ids.material(),
          emissiveStrength: -1,
        }),
      ).toThrow("validation failed");

      // Negative emissive color channel
      expect(() =>
        createStandardPbrMaterial({
          id: ids.material(),
          emissiveColor: [-0.5, 0, 0],
        }),
      ).toThrow("validation failed");

      // Unlit out of range color
      expect(() =>
        createUnlitMaterial({
          id: ids.material(),
          color: [2, 0, 0, 1],
        }),
      ).toThrow("validation failed");
    });
  });

  describe("Material Instances and MaterialLibrary", () => {
    it("manages materials and instances with deterministic resolution and caching", () => {
      const ids = createSequenceIdFactory("lib");
      const library = new MaterialLibrary();

      const pbr = createStandardPbrMaterial({
        id: ids.material(),
        name: "Base Plastic",
        baseColor: [1, 1, 1, 1],
        roughness: 0.5,
        metallic: 0,
      });
      library.addMaterial(pbr);

      const instanceId = ids.materialInstance();
      library.addInstance({
        type: "material-instance",
        id: instanceId,
        name: "Blue Plastic",
        parentMaterialId: pbr.id,
        overrides: {
          baseColor: [0, 0, 1, 1],
          roughness: 0.2,
        },
        metadata: {},
      });

      // Resolve instance
      const resolved = library.resolve(instanceId);
      expect(resolved).toBeDefined();
      expect(resolved?.type).toBe("standard-pbr");
      expect((resolved as typeof pbr).baseColor).toEqual([0, 0, 1, 1]);
      expect((resolved as typeof pbr).roughness).toBe(0.2);
      expect((resolved as typeof pbr).metallic).toBe(0); // inherited from parent

      // Re-resolving returns cached instance
      const cached = library.resolve(instanceId);
      expect(cached).toBe(resolved);

      // Updating parent material invalidates cache
      const updatedPbr = { ...pbr, metallic: 0.3 };
      library.addMaterial(updatedPbr);
      const afterParentUpdate = library.resolve(instanceId);
      expect((afterParentUpdate as typeof pbr).metallic).toBe(0.3);

      // Rejects instance inheriting from missing parent
      expect(() =>
        library.addInstance({
          type: "material-instance",
          id: ids.materialInstance(),
          name: "Broken",
          parentMaterialId: ids.material(), // not in library
          overrides: {},
          metadata: {},
        }),
      ).toThrow("references non-existent parent material");
    });
  });

  describe("Stable Material Slots and Reordering", () => {
    it("assigns stable material slots to faces and preserves assignments across slot reordering", () => {
      const ids = createSequenceIdFactory("slots");
      const mesh = MeshBuilder.createCube(1, 1, 1, ids.mesh());
      const faceKeys = [...mesh.faces.keys()];
      expect(faceKeys).toHaveLength(6);

      const mat1 = ids.material();
      const mat2 = ids.material();
      const slotA = createMaterialSlot(ids.materialSlot(), "Slot A", {
        type: "material",
        materialId: mat1,
      });
      const slotB = createMaterialSlot(ids.materialSlot(), "Slot B", {
        type: "material",
        materialId: mat2,
      });

      let record: import("@modeling-kit/document").MeshRecord = {
        id: mesh.id,
        name: "Cube",
        materialSlots: [],
        materialIds: [],
        metadata: {},
      };
      record = addSlotToRecord(record, slotA);
      record = addSlotToRecord(record, slotB);
      expect(record.materialSlots).toHaveLength(2);

      // Assign first 3 faces to Slot A, next 3 to Slot B
      const facesA = faceKeys.slice(0, 3);
      const facesB = faceKeys.slice(3);
      assignFaceMaterialSlot(mesh, facesA, slotA.id, 0);
      assignFaceMaterialSlot(mesh, facesB, slotB.id, 1);

      // Verify initial assignments
      for (const fId of facesA) {
        const f = mesh.faces.get(fId)!;
        expect(f.materialSlotId).toBe(slotA.id);
        expect(f.materialSlot).toBe(0);
      }
      for (const fId of facesB) {
        const f = mesh.faces.get(fId)!;
        expect(f.materialSlotId).toBe(slotB.id);
        expect(f.materialSlot).toBe(1);
      }

      // Reorder slots: Slot B first, Slot A second
      const reorderedRecord = reorderSlotsInRecord(record, [slotB.id, slotA.id]);
      expect(reorderedRecord.materialSlots?.[0]?.id).toBe(slotB.id);
      expect(reorderedRecord.materialSlots?.[1]?.id).toBe(slotA.id);

      // Sync numeric slot indices to match new order
      syncMeshSlotIndices(mesh, reorderedRecord.materialSlots ?? []);

      // Face assignments MUST remain unchanged with respect to materialSlotId!
      for (const fId of facesA) {
        const f = mesh.faces.get(fId)!;
        expect(f.materialSlotId).toBe(slotA.id); // STABLE!
        expect(f.materialSlot).toBe(1); // Numeric index updated to match reordered slot
      }
      for (const fId of facesB) {
        const f = mesh.faces.get(fId)!;
        expect(f.materialSlotId).toBe(slotB.id); // STABLE!
        expect(f.materialSlot).toBe(0); // Numeric index updated to match reordered slot
      }
    });
  });

  it("owns materials through ModelDocument when attached", () => {
    const ids = createSequenceIdFactory("owned");
    const document = createModelDocument({ ids });
    const library = MaterialLibrary.fromDocument(document);
    const material = createStandardPbrMaterial({
      id: ids.material(),
      name: "Owned",
      baseColor: [0.2, 0.3, 0.4, 1],
    });
    library.addMaterial(material);
    expect(document.materials.get(material.id)?.name).toBe("Owned");
    library.deleteMaterial(material.id);
    expect(document.materials.has(material.id)).toBe(false);
  });
});
