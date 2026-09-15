import { createSequenceIdFactory } from "@modeling-kit/core";
import {
  createTextureData,
  parseDocument,
  readImagePixel,
  serializeDocument,
  writeImageRect,
} from "@modeling-kit/document";
import { describe, expect, it } from "vitest";
import { paintSurfaceHit } from "@modeling-kit/paint";
import { projectUvs } from "@modeling-kit/uv";
import {
  AddMaterialSlotCommand,
  AssignMaterialSlotCommand,
  AddImageLayerCommand,
  ApplyImageTilePatchesCommand,
  CreateImageDocumentCommand,
  CreateMaterialCommand,
  CreatePrimitiveCommand,
  CreateTextureCommand,
  CreateTextureSetCommand,
  DeleteTextureSetCommand,
  BindMaterialTextureSetCommand,
  CreateMaterialInstanceCommand,
  UpdateMaterialInstanceCommand,
  RemoveImageLayerCommand,
  UpdateImageLayerCommand,
  UpdateMaterialCommand,
  createModelingSession,
} from "../src/index";

describe("materials UV image paint integration", () => {
  it("round-trips identities through materials, UVs, tiled images, 2D paint, and 3D hits", () => {
    const session = createModelingSession(createSequenceIdFactory("mvp"));
    const cube = session.execute(new CreatePrimitiveCommand("cube", { width: 1, height: 1, depth: 1 }));
    const materialId = session.execute(
      new CreateMaterialCommand({
        name: "Painted",
        type: "standard-pbr",
        baseColor: [0.8, 0.8, 0.8, 1],
        metallic: 0,
        roughness: 0.4,
      }),
    );
    const slotId = session.execute(
      new AddMaterialSlotCommand({
        meshId: cube.meshId,
        target: { type: "material", materialId },
      }),
    );
    const mesh = session.meshes.get(cube.meshId)!;
    const faceIds = [...mesh.faces.keys()];
    session.execute(
      new AssignMaterialSlotCommand({
        meshId: cube.meshId,
        faceIds,
        slotId,
      }),
    );
    const topologyBeforeUv = mesh.topologyRevision;
    projectUvs(mesh, { projection: "box" });
    expect(mesh.topologyRevision).toBe(topologyBeforeUv);

    const textureId = session.execute(new CreateTextureCommand({ width: 32, height: 32, name: "Albedo" }));
    const setId = session.execute(
      new CreateTextureSetCommand({
        name: "Albedo Set",
        channels: { baseColor: textureId },
      }),
    );
    session.execute(new BindMaterialTextureSetCommand({ materialId, textureSetId: setId }));
    expect(session.document.materials.require(materialId).baseColorTexture).toBe(textureId);
    const instanceId = session.execute(
      new CreateMaterialInstanceCommand({ materialId, name: "Worn", overrides: { roughness: 0.9 } }),
    );
    session.execute(new UpdateMaterialInstanceCommand({ instanceId, overrides: { roughness: 0.2 } }));
    expect(session.document.materialInstances.require(instanceId).overrides?.roughness).toBe(0.2);
    session.undo();
    expect(session.document.materialInstances.require(instanceId).overrides?.roughness).toBe(0.9);
    session.execute(new DeleteTextureSetCommand({ textureSetId: setId }));
    expect(session.document.materials.require(materialId).textureSetId).toBeUndefined();
    session.undo();
    expect(session.document.textureSets.has(setId)).toBe(true);

    const imageId = session.execute(new CreateImageDocumentCommand({ width: 64, height: 64, name: "Layered" }));
    const image = session.document.images.require(imageId);
    const layerId = image.layers[0]!.id;
    const pixels = new Uint8ClampedArray(8 * 8 * 4);
    pixels.fill(255);
    const tiled = writeImageRect(image, layerId, { x: 0, y: 0, width: 8, height: 8 }, pixels, 8);
    session.document.images.set(tiled.image);
    session.document.textures.set(
      createTextureData(textureId, "Albedo", {
        ...session.document.textures.require(textureId),
        sourceKind: "image-document",
        imageDocumentId: imageId,
        usage: "color",
      }),
    );

    session.beginPaintStroke(textureId);
    session.dabPaintStroke(4, 4, { size: 1, color: [9, 8, 7, 255] });
    expect(session.commitPaintStroke()).toBe(true);
    const painted = session.textures.get(textureId)!.getPixel(4, 4);
    session.undo();
    expect(session.textures.get(textureId)!.getPixel(4, 4)[3]).toBe(0);
    session.redo();
    expect(session.textures.get(textureId)!.getPixel(4, 4)).toEqual(painted);

    const faceId = faceIds[0]!;
    paintSurfaceHit(mesh, { faceId, u: 0, v: 0 }, session.textures.get(textureId)!, {
      size: 1,
      color: [1, 2, 3, 255],
    });
    const slot = mesh.faces.get(faceId);
    expect(slot?.materialSlotId).toBe(slotId);

    const json = serializeDocument(session.document);
    const loaded = parseDocument(json);
    expect(loaded.materials.has(materialId)).toBe(true);
    expect(loaded.images.has(imageId)).toBe(true);
    expect(loaded.textures.get(textureId)?.imageDocumentId).toBe(imageId);

    session.execute(new UpdateMaterialCommand({ materialId, patch: { baseColor: [1, 0, 0, 1] } }));
    expect(session.document.materials.get(materialId)?.baseColor[0]).toBe(1);
    session.undo();
    expect(session.document.materials.get(materialId)?.baseColor[0]).toBe(0.8);

    const extra = session.execute(new AddImageLayerCommand({ imageDocumentId: imageId, name: "Paint" }));
    session.execute(
      new UpdateImageLayerCommand({
        imageDocumentId: imageId,
        layerId: extra,
        patch: { opacity: 0.5, blendMode: "multiply" },
      }),
    );
    expect(session.document.images.require(imageId).layers.find((layer) => layer.id === extra)?.opacity).toBe(0.5);
    const paint = writeImageRect(
      session.document.images.require(imageId),
      extra,
      { x: 0, y: 0, width: 4, height: 4 },
      pixels,
      8,
    );
    session.execute(new ApplyImageTilePatchesCommand({ imageDocumentId: imageId, patches: paint.patches }));
    expect(readImagePixel(session.document.images.require(imageId), extra, 1, 1)[3]).toBe(255);
    session.undo();
    expect(readImagePixel(session.document.images.require(imageId), extra, 1, 1)[3]).toBe(0);
    session.execute(new RemoveImageLayerCommand({ imageDocumentId: imageId, layerId: extra }));
    expect(session.document.images.require(imageId).layers.some((layer) => layer.id === extra)).toBe(false);
    session.undo();
    expect(session.document.images.require(imageId).layers.some((layer) => layer.id === extra)).toBe(true);
  });
});
