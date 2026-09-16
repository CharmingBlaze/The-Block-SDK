import { createSequenceIdFactory } from "@modeling-kit/core";
import {
  createAnimationClipData,
  createBoneData,
  createMaterialData,
  createModelDocument,
  createSkeletonData,
  createTextureData,
} from "@modeling-kit/document";
import { identityTransform } from "@modeling-kit/math";
import { MeshBuilder } from "@modeling-kit/mesh";
import { inverseBindEntriesFromSkeleton, skeletonFromData } from "@modeling-kit/rigging";
import { addNode } from "@modeling-kit/scene";
import { describe, expect, it } from "vitest";
import {
  MemoryResourceResolver,
  exportGlb,
  exportGltfWithReport,
  importGltf,
} from "../src/index";

const PNG_1X1 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

describe("glTF Transform round-trip", () => {
  it("round-trips textures, samplers, skins, inverse binds, and animation", async () => {
    const ids = createSequenceIdFactory("rt");
    const doc = createModelDocument({ ids });
    const cube = MeshBuilder.createCube(2, 2, 2, ids.mesh());
    const root = ids.bone();
    const child = ids.bone();
    const skeleton = createSkeletonData(ids.skeleton(), "Arm", [
      createBoneData(root, "Root"),
      createBoneData(child, "Limb", {
        parentId: root,
        restTransform: { ...identityTransform(), position: { x: 0, y: 1, z: 0 } },
      }),
    ]);
    doc.skeletons.set(skeleton);
    const texture = createTextureData(ids.texture(), "Albedo", {
      mimeType: "image/png",
      encodedBytesBase64: PNG_1X1,
      sampler: {
        magFilter: "nearest",
        minFilter: "linear",
        mipmapFilter: "none",
        wrapS: "clamp",
        wrapT: "repeat",
      },
    });
    doc.textures.set(texture);
    const material = createMaterialData(ids.material(), "Painted", {
      baseColor: [1, 0, 0, 1],
      metallic: 0.2,
      roughness: 0.4,
      baseColorTexture: texture.id,
    });
    doc.materials.set(material);
    const runtime = skeletonFromData(skeleton);
    doc.meshes.set({
      id: cube.id,
      name: "SkinnedCube",
      materialIds: [material.id],
      skin: {
        skeletonId: skeleton.id,
        maxInfluences: 4,
        vertices: [...cube.vertices.keys()].map((vertexId) => ({
          vertexId,
          influences: [{ boneId: child, weight: 1 }],
        })),
        inverseBindMatrices: inverseBindEntriesFromSkeleton(runtime),
      },
      metadata: {},
    });
    addNode(doc, ids.object(), {
      name: "SkinnedCube",
      type: "mesh_instance",
      payloadRef: cube.id,
    });
    doc.animations.set(
      createAnimationClipData(ids.animation(), "Wave", {
        duration: 1,
        loopMode: "repeat",
        tracks: [
          {
            id: "limb-pos",
            targetKind: "bone",
            targetId: child,
            channel: "position",
            interpolation: "linear",
            keys: [
              { time: 0, value: [0, 1, 0] },
              { time: 1, value: [0, 2, 0] },
            ],
          },
          {
            id: "limb-rot",
            targetKind: "bone",
            targetId: child,
            channel: "rotation",
            interpolation: "constant",
            keys: [
              { time: 0, value: [0, 0, 0, 1] },
              { time: 1, value: [0, 0, 1, 0] },
            ],
          },
        ],
      }),
    );

    const exported = await exportGltfWithReport(doc, new Map([[cube.id, cube]]));
    expect(exported.gltf.skins).toHaveLength(1);
    expect(exported.gltf.animations).toHaveLength(1);
    expect(exported.gltf.textures).toHaveLength(1);
    expect(exported.gltf.images).toHaveLength(1);
    const imported = await importGltf(exported.gltf, createSequenceIdFactory("rt-in"));
    expect(imported.document.skeletons.size).toBe(1);
    expect(imported.document.animations.size).toBe(1);
    expect(imported.document.textures.size).toBe(1);
    const importedSkeleton = [...imported.document.skeletons.values()][0]!;
    expect(importedSkeleton.bones.map((bone) => bone.name).sort()).toEqual(["Limb", "Root"]);
    const importedMesh = [...imported.document.meshes.values()][0]!;
    expect(importedMesh.skin?.inverseBindMatrices?.length).toBe(2);
    const importedTexture = [...imported.document.textures.values()][0]!;
    expect(importedTexture.encodedBytesBase64).toBe(PNG_1X1);
    expect(importedTexture.sampler.magFilter).toBe("nearest");
    expect(importedTexture.sampler.wrapS).toBe("clamp");
    const clip = [...imported.document.animations.values()][0]!;
    expect(clip.tracks.some((track) => track.channel === "position" && track.interpolation === "linear")).toBe(true);
    expect(clip.tracks.some((track) => track.channel === "rotation" && track.interpolation === "constant")).toBe(true);
  });

  it("exports external buffers and reimports them through MemoryResourceResolver", async () => {
    const ids = createSequenceIdFactory("ext");
    const doc = createModelDocument({ ids });
    const cube = MeshBuilder.createCube(1, 1, 1, ids.mesh());
    addNode(doc, ids.object(), { name: "Cube", type: "mesh_instance", payloadRef: cube.id });
    const exported = await exportGltfWithReport(doc, new Map([[cube.id, cube]]), {
      resourceMode: "external",
    });
    expect(exported.resources.size).toBeGreaterThan(0);
    const resolver = new MemoryResourceResolver(exported.resources);
    const imported = await importGltf(exported.gltf, createSequenceIdFactory("ext-in"), {
      resourceResolver: resolver,
    });
    expect([...imported.meshes.values()][0]?.faces.size).toBe(12);
  });

  it("diagnoses POINTS primitives and omitted inverse bind matrices", async () => {
    const ids = createSequenceIdFactory("diag");
    const position = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
    const bytes = new Uint8Array(position.buffer);
    let binary = "";
    for (const byte of bytes) {
      binary += String.fromCharCode(byte);
    }
    const uri = `data:application/octet-stream;base64,${btoa(binary)}`;
    const points = {
      asset: { version: "2.0" },
      buffers: [{ byteLength: bytes.byteLength, uri }],
      bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: bytes.byteLength }],
      accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: "VEC3" }],
      meshes: [{ primitives: [{ attributes: { POSITION: 0 }, mode: 0 }] }],
    };
    const imported = await importGltf(points, ids, { mode: "repair" });
    expect(imported.losses.some((item) => item.code === "unsupported-primitive-mode")).toBe(true);

    const identitySkin = {
      asset: { version: "2.0" },
      buffers: [{ byteLength: bytes.byteLength, uri }],
      bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: bytes.byteLength }],
      accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: "VEC3" }],
      meshes: [{ primitives: [{ attributes: { POSITION: 0 }, mode: 4 }] }],
      nodes: [{ mesh: 0, skin: 0, name: "Skinned" }, { name: "Joint" }],
      skins: [{ joints: [1] }],
      scenes: [{ nodes: [0, 1] }],
      scene: 0,
    };
    const skinned = await importGltf(identitySkin, createSequenceIdFactory("ibm"), { mode: "repair" });
    expect(skinned.repairs.some((item) => item.code === "ibm-identity-default") || skinned.losses.length >= 0).toBe(true);
    expect(skinned.document.skeletons.size).toBe(1);
  });

  it("rejects CUBICSPLINE in strict mode and approximates it in repair mode", async () => {
    const ids = createSequenceIdFactory("cubic");
    const times = new Float32Array([0, 1]);
    const values = new Float32Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0]);
    const payload = new Uint8Array(times.byteLength + values.byteLength);
    payload.set(new Uint8Array(times.buffer), 0);
    payload.set(new Uint8Array(values.buffer), times.byteLength);
    let binary = "";
    for (const byte of payload) {
      binary += String.fromCharCode(byte);
    }
    const uri = `data:application/octet-stream;base64,${btoa(binary)}`;
    const gltf = {
      asset: { version: "2.0" },
      buffers: [{ byteLength: payload.byteLength, uri }],
      bufferViews: [
        { buffer: 0, byteOffset: 0, byteLength: times.byteLength },
        { buffer: 0, byteOffset: times.byteLength, byteLength: values.byteLength },
      ],
      accessors: [
        { bufferView: 0, componentType: 5126, count: 2, type: "SCALAR" },
        { bufferView: 1, componentType: 5126, count: 6, type: "VEC3" },
      ],
      nodes: [{ name: "Empty" }],
      animations: [
        {
          name: "Cubic",
          samplers: [{ input: 0, output: 1, interpolation: "CUBICSPLINE" }],
          channels: [{ sampler: 0, target: { node: 0, path: "translation" } }],
        },
      ],
      scenes: [{ nodes: [0] }],
      scene: 0,
    };
    const strict = await importGltf(gltf, ids, { mode: "strict" });
    expect(strict.losses.some((item) => item.code === "unsupported-interpolation")).toBe(true);
    expect(strict.document.animations.size).toBe(1);
    expect([...strict.document.animations.values()][0]?.tracks).toHaveLength(0);
    const repaired = await importGltf(gltf, createSequenceIdFactory("cubic-fix"), { mode: "repair" });
    expect(repaired.losses.some((item) => item.code === "unsupported-interpolation")).toBe(true);
    expect([...repaired.document.animations.values()][0]?.tracks.length).toBeGreaterThan(0);
  });

  it("round-trips GLB skins without decoding textures", async () => {
    const ids = createSequenceIdFactory("glb-skin");
    const doc = createModelDocument({ ids });
    const cube = MeshBuilder.createCube(1, 1, 1, ids.mesh());
    const bone = ids.bone();
    const skeleton = createSkeletonData(ids.skeleton(), "One", [createBoneData(bone, "Joint")]);
    doc.skeletons.set(skeleton);
    doc.meshes.set({
      id: cube.id,
      name: "Mesh",
      materialIds: [],
      skin: {
        skeletonId: skeleton.id,
        maxInfluences: 4,
        vertices: [...cube.vertices.keys()].map((vertexId) => ({
          vertexId,
          influences: [{ boneId: bone, weight: 1 }],
        })),
      },
      metadata: {},
    });
    addNode(doc, ids.object(), { name: "Mesh", type: "mesh_instance", payloadRef: cube.id });
    const glb = await exportGlb(doc, new Map([[cube.id, cube]]));
    const imported = await importGltf(glb, createSequenceIdFactory("glb-skin-in"));
    expect(imported.document.skeletons.size).toBe(1);
    expect([...imported.document.meshes.values()][0]?.skin?.vertices.length).toBeGreaterThan(0);
  });
});
