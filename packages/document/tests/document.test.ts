import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  SchemaError,
  UnsupportedSchemaVersionError,
  createSequenceIdFactory,
} from "@modeling-kit/core";
import { createIdFactory } from "@modeling-kit/core";
import {
  createModelDocument,
  createMaterialData,
  createTextureData,
  createTextureSet,
  materialFromTextureSet,
  parseDocument,
  serializeDocument,
  validateDocument,
  bytesToBase64,
  base64ToBytes,
  beginDocumentTransaction,
  addNode,
  registerSceneNodeExtension,
  sceneNodeExtensions,
} from "../src/index";

const packageDir = dirname(fileURLToPath(import.meta.url));

describe("document lifecycle", () => {
  it("creates, serializes, loads, and validates", () => {
    const doc = createModelDocument({
      name: "Fixture",
      ids: createSequenceIdFactory("t"),
      metadata: { app: "test", extra: { nested: true } },
    });
    expect(validateDocument(doc).valid).toBe(true);
    const json = serializeDocument(doc);
    const again = serializeDocument(parseDocument(json));
    expect(again).toBe(json);
    const loaded = parseDocument(json);
    expect(loaded.name).toBe("Fixture");
  });

  it("rejects newer schema versions", () => {
    const doc = createModelDocument({ ids: createSequenceIdFactory("n") });
    const payload = JSON.parse(serializeDocument(doc)) as { schemaVersion: number };
    payload.schemaVersion = 99;
    expect(() => parseDocument(JSON.stringify(payload))).toThrow(UnsupportedSchemaVersionError);
  });

  it("rejects malformed json", () => {
    expect(() => parseDocument("{")).toThrow(SchemaError);
  });

  it("does not depend on three", () => {
    const pkg = JSON.parse(readFileSync(join(packageDir, "../package.json"), "utf8")) as {
      dependencies?: Record<string, string>;
    };
    expect(pkg.dependencies?.["three"]).toBeUndefined();
    const src = readFileSync(join(packageDir, "../src/index.ts"), "utf8");
    expect(src).not.toMatch(/from ["']three["']/);
  });
});

describe("IdFactory independence", () => {
  it("does not require a global factory", () => {
    const a = createModelDocument({
      ids: createIdFactory(() => "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1"),
    });
    const b = createModelDocument({
      ids: createIdFactory(() => "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2"),
    });
    expect(a.id).not.toBe(b.id);
  });
});

describe("PBR materials", () => {
  it("round-trips material factors", () => {
    const ids = createSequenceIdFactory("pbr");
    const doc = createModelDocument({ ids });
    const material = createMaterialData(ids.material(), "Red", {
      baseColor: [1, 0, 0, 1],
      metallic: 0.3,
      roughness: 0.2,
    });
    doc.materials.set(material);
    const loaded = parseDocument(serializeDocument(doc));
    expect(loaded.materials.get(material.id)?.baseColor).toEqual([1, 0, 0, 1]);
    expect(loaded.materials.get(material.id)?.metallic).toBe(0.3);
  });

  it("round-trips texture pixel payloads", () => {
    const ids = createSequenceIdFactory("tex");
    const doc = createModelDocument({ ids });
    const pixels = new Uint8Array([1, 2, 3, 255, 4, 5, 6, 255]);
    const texture = createTextureData(ids.texture(), "Ink", {
      width: 2,
      height: 1,
      pixelsBase64: bytesToBase64(pixels),
    });
    doc.textures.set(texture);
    const loaded = parseDocument(serializeDocument(doc));
    const raw = loaded.textures.get(texture.id)?.pixelsBase64;
    expect(raw).toBeDefined();
    expect([...base64ToBytes(raw!)]).toEqual([...pixels]);
  });

  it("binds a texture set onto a material and round-trips it", () => {
    const ids = createSequenceIdFactory("texset");
    const doc = createModelDocument({ ids });
    const texture = createTextureData(ids.texture(), "Albedo", { width: 1, height: 1 });
    const set = createTextureSet(ids.textureSet(), "PBR Set", { baseColor: texture.id });
    let material = createMaterialData(ids.material(), "Bound");
    material = materialFromTextureSet(material, set);
    doc.textures.set(texture);
    doc.textureSets.set(set);
    doc.materials.set(material);
    const loaded = parseDocument(serializeDocument(doc));
    expect(loaded.textureSets.get(set.id)?.channels.baseColor).toBe(texture.id);
    expect(loaded.materials.get(material.id)?.textureSetId).toBe(set.id);
    expect(validateDocument(loaded).valid).toBe(true);
  });
});

describe("document transactions", () => {
  it("rolls back scene mutations and commits a revision", () => {
    const ids = createSequenceIdFactory("tx");
    const doc = createModelDocument({ ids });
    const tx = beginDocumentTransaction(doc, "test");
    doc.scene.nodes.set(doc.scene.rootNodeId, {
      ...doc.scene.nodes.get(doc.scene.rootNodeId)!,
      name: "Broken",
    });
    tx.rollback();
    expect(doc.scene.nodes.get(doc.scene.rootNodeId)?.name).toBe("Scene");
    const committed = beginDocumentTransaction(doc, "rename");
    const result = committed.commit("name", [doc.scene.rootNodeId]);
    expect(result.revisionAfter).toBe(1);
    expect(doc.revision).toBe(1);
  });

  it("validates extension nodes against a per-document disposable registry", () => {
    const ids = createSequenceIdFactory("ext");
    const doc = createModelDocument({ ids });
    addNode(doc, ids.object(), {
      name: "Gizmo",
      type: "extension",
      metadata: { extensionType: "host.gizmo" },
    });
    expect(validateDocument(doc).errors.some((issue) => issue.code === "INVALID_EXTENSION")).toBe(
      true,
    );
    registerSceneNodeExtension(doc, "host.gizmo");
    expect(validateDocument(doc).valid).toBe(true);
    const registry = sceneNodeExtensions(doc);
    registry.dispose();
    expect(registry.disposed).toBe(true);
    expect(() => registerSceneNodeExtension(doc, "host.other")).not.toThrow();
    expect(sceneNodeExtensions(doc).has("host.other")).toBe(true);
    expect(sceneNodeExtensions(doc).has("host.gizmo")).toBe(false);
  });
});
