import { describe, expect, it } from "vitest";
import { createSequenceIdFactory } from "@modeling-kit/core";
import { identityTransform } from "@modeling-kit/math";
import {
  addNode,
  beginDocumentTransaction,
  createAnimationClipData,
  createImageDocument,
  createMaterialData,
  createMaterialInstanceData,
  createModelDocument,
  createSkeletonData,
  createTextureData,
  createTextureSet,
  getNode,
  setLocalTransform,
} from "../src/index";

describe("document transactions", () => {
  it("rolls back hierarchy mutations atomically", () => {
    const ids = createSequenceIdFactory("tx");
    const document = createModelDocument({ ids });
    const tx = beginDocumentTransaction(document, "add");
    addNode(document, ids.object(), { name: "Temp" });
    tx.rollback();
    expect(getNode(document, document.scene.rootNodeId).childIds).toEqual([]);
    expect(document.revision).toBe(0);
  });

  it("commits a structured change set and revision", () => {
    const ids = createSequenceIdFactory("tx2");
    const document = createModelDocument({ ids });
    const tx = beginDocumentTransaction(document, "Add node");
    const node = addNode(document, ids.object(), { name: "Box" });
    const result = tx.commit();
    expect(result.revisionAfter).toBe(1);
    expect(result.changeSet.addedNodes).toContain(node.id);
    expect(result.kind).toBe("hierarchy");
  });

  it("infers transform vs hierarchy change kinds", () => {
    const ids = createSequenceIdFactory("tx-kind");
    const document = createModelDocument({ ids });
    const node = addNode(document, ids.object(), { name: "Mover" });
    const tx = beginDocumentTransaction(document, "move");
    const moved = identityTransform();
    setLocalTransform(document, node.id, {
      ...moved,
      position: { x: 1, y: 0, z: 0 },
    });
    const result = tx.commit();
    expect(result.kind).toBe("transform");
    expect(result.changeSet.changedNodes[0]?.kind).toBe("transform");
  });

  it("rejects nested transactions", () => {
    const document = createModelDocument({ ids: createSequenceIdFactory("tx3") });
    beginDocumentTransaction(document, "outer");
    expect(() => beginDocumentTransaction(document, "inner")).toThrow(/Nested/);
  });

  it("restores revision counters on rollback", () => {
    const ids = createSequenceIdFactory("tx4");
    const document = createModelDocument({ ids });
    const before = document.revisions.hierarchy;
    const tx = beginDocumentTransaction(document, "add");
    addNode(document, ids.object(), { name: "Temp" });
    tx.rollback();
    expect(document.revisions.hierarchy).toBe(before);
    expect(document.revision).toBe(0);
  });

  it("rolls back mesh and material mutations", () => {
    const ids = createSequenceIdFactory("tx-res");
    const document = createModelDocument({ ids });
    const meshId = ids.mesh();
    const materialId = ids.material();
    document.meshes.set({ id: meshId, name: "Keep", materialIds: [], metadata: {} });
    const tx = beginDocumentTransaction(document, "mutate-resources");
    document.meshes.set({ id: meshId, name: "Changed", materialIds: [], metadata: {} });
    document.materials.set(createMaterialData(materialId, "Temp"));
    tx.rollback();
    expect(document.meshes.get(meshId)?.name).toBe("Keep");
    expect(document.materials.has(materialId)).toBe(false);
  });

  it("rolls back textures, sets, images, skeletons, animations, and instances", () => {
    const ids = createSequenceIdFactory("tx-all");
    const document = createModelDocument({ ids });
    const texture = createTextureData(ids.texture(), "Albedo");
    const set = createTextureSet(ids.textureSet(), "Set", { baseColor: texture.id });
    const image = createImageDocument({
      id: ids.imageDocument(),
      name: "Paint",
      width: 8,
      height: 8,
      ids,
    });
    const skeleton = createSkeletonData(ids.skeleton(), "Rig");
    const clip = createAnimationClipData(ids.animation(), "Idle", {
      tracks: [
        {
          id: "t0",
          targetKind: "object",
          targetId: "node",
          channel: "position",
          interpolation: "linear",
          keys: [{ time: 0, value: [0, 0, 0] }],
        },
      ],
    });
    const material = createMaterialData(ids.material(), "Mat");
    const instance = createMaterialInstanceData(ids.materialInstance(), material.id, "Inst");
    document.textures.set(texture);
    document.textureSets.set(set);
    document.images.set(image);
    document.skeletons.set(skeleton);
    document.animations.set(clip);
    document.materials.set(material);
    document.materialInstances.set(instance);

    const tx = beginDocumentTransaction(document, "mutate-all-resources");
    document.textures.set({ ...texture, name: "Renamed" });
    document.textureSets.set({ ...set, name: "RenamedSet", channels: {}, textureIds: [] });
    document.images.set({ ...image, name: "Scrubbed", layers: [], rootLayerIds: [] });
    document.skeletons.set({ ...skeleton, name: "Other" });
    document.animations.set({ ...clip, name: "Walk", tracks: [] });
    document.materialInstances.set({ ...instance, name: "Detached" });
    document.materials.delete(material.id);
    tx.rollback();

    expect(document.textures.get(texture.id)?.name).toBe("Albedo");
    expect(document.textureSets.get(set.id)?.name).toBe("Set");
    expect(document.textureSets.get(set.id)?.channels.baseColor).toBe(texture.id);
    expect(document.images.get(image.id)?.name).toBe("Paint");
    expect(document.images.get(image.id)?.layers).toHaveLength(1);
    expect(document.skeletons.get(skeleton.id)?.name).toBe("Rig");
    expect(document.animations.get(clip.id)?.name).toBe("Idle");
    expect(document.animations.get(clip.id)?.tracks).toHaveLength(1);
    expect(document.materials.has(material.id)).toBe(true);
    expect(document.materialInstances.get(instance.id)?.name).toBe("Inst");
  });

  it("rolls back nested metadata, settings, and name without sharing clones", () => {
    const ids = createSequenceIdFactory("tx-ident");
    const document = createModelDocument({ ids, name: "Original" });
    const nested = { note: "keep" };
    document.metadata.nested = nested;
    const meshId = ids.mesh();
    document.meshes.set({
      id: meshId,
      name: "Keep",
      materialIds: [],
      metadata: { inner: { v: 1 } },
    });
    const tx = beginDocumentTransaction(document, "identity");
    document.name = "Changed";
    document.settings = { ...document.settings, gridSize: 99 };
    (document.metadata.nested as { note: string }).note = "mutated";
    const liveMesh = document.meshes.get(meshId)!;
    (liveMesh.metadata.inner as { v: number }).v = 2;
    tx.rollback();
    expect(document.name).toBe("Original");
    expect(document.settings.gridSize).toBe(1);
    expect((document.metadata.nested as { note: string }).note).toBe("keep");
    expect((document.meshes.get(meshId)?.metadata.inner as { v: number }).v).toBe(1);
    nested.note = "after";
    expect((document.metadata.nested as { note: string }).note).toBe("keep");
  });
});
