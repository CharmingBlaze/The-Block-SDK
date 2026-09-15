import { createSequenceIdFactory } from "@modeling-kit/core";
import { createMaterialData, createModelDocument } from "@modeling-kit/document";
import { identityTransform } from "@modeling-kit/math";
import { MeshBuilder } from "@modeling-kit/mesh";
import { addNode } from "@modeling-kit/scene";
import { describe, expect, it } from "vitest";
import { exportGltf, exportGlb, exportObj, exportStlAscii, importGltf, importStlAscii, importStlAsciiWithReport, exportGltfWithReport, exportObjWithReport, importObjWithReport, exportImagePpm, importImagePpm } from "../src/index";

describe("@modeling-kit/formats", () => {
  it("exports and imports Wavefront OBJ with geometry preservation", () => {
    const ids = createSequenceIdFactory("obj");
    const cube = MeshBuilder.createCube(2, 2, 2, ids.mesh());

    const objText = exportObj(cube, { objectName: "TestCube" });
    expect(objText).toContain("o TestCube");
    expect(objText).toContain("v 1 1 1");
    expect(objText).toContain("f ");

    const reimported = importObjWithReport(objText, ids);
    expect(reimported.value.vertices.size).toBe(cube.vertices.size);
    expect(reimported.value.faces.size).toBe(cube.faces.size);
    expect(reimported.report.format).toBe("obj");
    const reported = exportObjWithReport(cube, { objectName: "TestCube" });
    expect(reported.report.format).toBe("obj");
    expect(reported.report.dataLoss.length).toBeGreaterThan(0);
  });

  it("exports mesh to ASCII STL", () => {
    const ids = createSequenceIdFactory("stl");
    const cube = MeshBuilder.createCube(1, 1, 1, ids.mesh());

    const stlText = exportStlAscii(cube, { solidName: "SampleCube" });
    expect(stlText).toContain("solid SampleCube");
    expect(stlText).toContain("facet normal");
    expect(stlText).toContain("vertex");
    expect(stlText).toContain("endsolid SampleCube");
  });

  it("exports ModelDocument scene hierarchy to glTF 2.0", () => {
    const ids = createSequenceIdFactory("gltf");
    const doc = createModelDocument({ ids });
    const cube = MeshBuilder.createCube(2, 2, 2, ids.mesh());
    const groupId = ids.object();
    const meshNodeId = ids.object();
    addNode(doc, groupId, {
      name: "Arm",
      type: "group",
      localTransform: {
        ...identityTransform(),
        position: { x: 0, y: 2, z: 0 },
      },
    });
    addNode(doc, meshNodeId, {
      name: "Cube",
      type: "mesh_instance",
      parentId: groupId,
      payloadRef: cube.id,
    });
    const steel = createMaterialData(ids.material(), "Steel", {
      baseColor: [0.2, 0.3, 0.4, 1],
      metallic: 0.8,
      roughness: 0.25,
      emissive: [0.1, 0, 0],
      alphaMode: "blend",
      doubleSided: true,
    });
    doc.materials.set(steel);
    doc.meshes.set({
      id: cube.id,
      name: "Cube",
      materialIds: [steel.id],
      metadata: {},
    });
    const meshes = new Map([[cube.id, cube]]);

    const exported = exportGltfWithReport(doc, meshes);
    const gltf = exported.gltf;
    expect(exported.report.dataLoss.some((item) => item.includes("triangulated"))).toBe(true);
    expect((gltf["asset"] as { version: string }).version).toBe("2.0");
    expect(gltf["meshes"]).toHaveLength(1);
    const nodes = gltf["nodes"] as Array<{ name?: string; mesh?: number; children?: number[]; translation?: number[] }>;
    expect(nodes).toHaveLength(2);
    const arm = nodes.find((node) => node.name === "Arm");
    const meshNode = nodes.find((node) => node.name === "Cube");
    expect(arm?.translation).toEqual([0, 2, 0]);
    expect(arm?.children).toHaveLength(1);
    expect(meshNode?.mesh).toBe(0);
    expect((gltf["meshes"] as Array<{ primitives: Array<{ attributes: Record<string, number> }> }>)[0]?.primitives[0]?.attributes.TEXCOORD_0).toBeDefined();
    expect((gltf["meshes"] as Array<{ primitives: Array<{ material?: number }> }>)[0]?.primitives[0]?.material).toBe(0);
    const exportedMaterials = gltf["materials"] as Array<{
      name?: string;
      pbrMetallicRoughness?: { metallicFactor?: number; roughnessFactor?: number; baseColorFactor?: number[] };
      emissiveFactor?: number[];
      alphaMode?: string;
      doubleSided?: boolean;
    }>;
    expect(exportedMaterials).toHaveLength(1);
    expect(exportedMaterials[0]?.name).toBe("Steel");
    expect(exportedMaterials[0]?.pbrMetallicRoughness?.metallicFactor).toBe(0.8);
    expect(exportedMaterials[0]?.pbrMetallicRoughness?.roughnessFactor).toBe(0.25);
    expect(exportedMaterials[0]?.emissiveFactor).toEqual([0.1, 0, 0]);
    expect(exportedMaterials[0]?.alphaMode).toBe("BLEND");
    expect(exportedMaterials[0]?.doubleSided).toBe(true);
    expect(gltf["buffers"]).toHaveLength(1);

    const imported = importGltf(JSON.stringify(gltf), createSequenceIdFactory("gltf-in"));
    const importedMeshes = [...imported.meshes.values()];
    expect(importedMeshes).toHaveLength(1);
    expect(imported.report.dataLoss.length).toBeGreaterThan(0);
    expect(imported.report.format).toBe("gltf");
    expect(importedMeshes[0]?.vertices.size).toBe(8);
    expect(importedMeshes[0]?.faces.size).toBe(12);
    const importedArm = [...imported.document.scene.nodes.values()].find((node) => node.name === "Arm");
    const cubeNode = [...imported.document.scene.nodes.values()].find((node) => node.name === "Cube");
    expect(importedArm?.localTransform.position.y).toBeCloseTo(2);
    expect(cubeNode?.parentId).toBe(importedArm?.id);
    expect(cubeNode?.type).toBe("mesh_instance");
    const importedMaterial = [...imported.document.materials.values()].find((item) => item.name === "Steel");
    expect(importedMaterial?.metallic).toBeCloseTo(0.8);
    expect(importedMaterial?.roughness).toBeCloseTo(0.25);
    expect(importedMaterial?.baseColor[0]).toBeCloseTo(0.2);
    expect(importedMaterial?.emissive[0]).toBeCloseTo(0.1);
    expect(importedMaterial?.alphaMode).toBe("blend");
    expect(importedMaterial?.doubleSided).toBe(true);
    expect([...importedMeshes[0]!.faces.values()].every((face) => face.materialSlot === 0)).toBe(true);
  });

  it("reports OBJ interchange data loss", () => {
    const ids = createSequenceIdFactory("obj-report");
    const cube = MeshBuilder.createCube(1, 1, 1, ids.mesh());
    const exported = exportObjWithReport(cube, { objectName: "Cube" });
    expect(exported.report.format).toBe("obj");
    expect(exported.report.dataLoss.join(" ")).toMatch(/geometry-only/);
    const imported = importObjWithReport(exported.value, ids);
    expect(imported.report.dataLoss.length).toBeGreaterThan(0);
    expect(imported.value.faces.size).toBe(cube.faces.size);
  });

  it("exports and imports a GLB 2.0 container", () => {
    const ids = createSequenceIdFactory("glb");
    const doc = createModelDocument({ ids });
    const cube = MeshBuilder.createCube(2, 2, 2, ids.mesh());
    addNode(doc, ids.object(), {
      name: "Cube",
      type: "mesh_instance",
      payloadRef: cube.id,
    });
    const glb = exportGlb(doc, new Map([[cube.id, cube]]));
    const header = new DataView(glb.buffer, glb.byteOffset, glb.byteLength);
    expect(header.getUint32(0, true)).toBe(0x46546c67);
    expect(header.getUint32(4, true)).toBe(2);
    expect(header.getUint32(8, true)).toBe(glb.byteLength);

    const imported = importGltf(glb, createSequenceIdFactory("glb-in"));
    const importedMeshes = [...imported.meshes.values()];
    expect(importedMeshes).toHaveLength(1);
    expect(importedMeshes[0]?.vertices.size).toBe(8);
    expect(importedMeshes[0]?.faces.size).toBe(12);
    expect([...imported.document.scene.nodes.values()].some((node) => node.name === "Cube")).toBe(true);
  });

  it("round-trips ASCII STL and ASCII PPM and honors cancel tokens", () => {
    const ids = createSequenceIdFactory("io");
    const cube = MeshBuilder.createCube(1, 1, 1, ids.mesh());
    const stl = exportStlAscii(cube, { solidName: "Cube" });
    const imported = importStlAsciiWithReport(stl, ids);
    expect(imported.mesh.faces.size).toBeGreaterThan(0);
    expect(imported.report.dataLoss.join(" ")).toMatch(/triangle soup/);
    expect(() => importStlAscii("not-a-solid", ids)).toThrow(/ASCII/);
    const image = importImagePpm("P3\n1 1\n255\n10 20 30\n", ids);
    expect(image.width).toBe(1);
    const ppm = exportImagePpm(image);
    expect(ppm).toContain("P3");
    const signal = AbortSignal.abort();
    expect(() => exportStlAscii(cube, { signal })).toThrow(/cancelled/);
    expect(() => importStlAscii(stl, ids, { signal })).toThrow(/cancelled/);
  });

  it("does not recurse forever on a cyclic scene graph", () => {
    const ids = createSequenceIdFactory("cycle");
    const doc = createModelDocument({ ids });
    const a = ids.object();
    const b = ids.object();
    addNode(doc, a, { name: "A", type: "group" });
    addNode(doc, b, { name: "B", type: "group", parentId: a });
    const nodeA = doc.scene.nodes.get(a)!;
    const nodeB = doc.scene.nodes.get(b)!;
    doc.scene.nodes.set(a, { ...nodeA, childIds: [b] });
    doc.scene.nodes.set(b, { ...nodeB, childIds: [a], parentId: a });
    const gltf = exportGltf(doc, new Map());
    expect((gltf["nodes"] as unknown[]).length).toBe(2);
  });

  it("skips empty meshes instead of writing non-finite POSITION bounds", () => {
    const ids = createSequenceIdFactory("empty-mesh");
    const doc = createModelDocument({ ids });
    const empty = new MeshBuilder(ids.mesh()).getMesh();
    addNode(doc, ids.object(), {
      name: "Empty",
      type: "mesh_instance",
      payloadRef: empty.id,
    });
    const exported = exportGltfWithReport(doc, new Map([[empty.id, empty]]));
    const accessors = exported.gltf["accessors"] as Array<{ min?: number[]; max?: number[] }>;
    expect(accessors.some((item) => item.min?.some((value) => !Number.isFinite(value)))).toBe(false);
    expect(exported.report.warnings.some((item) => item.includes("empty mesh"))).toBe(true);
  });

  it("rejects non-finite STL vertices and warns on extra facet vertices", () => {
    const ids = createSequenceIdFactory("stl-bad");
    const text = `solid bad
  facet normal 0 0 1
    outer loop
      vertex NaN 0 0
      vertex 1 0 0
      vertex 0 1 0
    endloop
  endfacet
  facet normal 0 0 1
    outer loop
      vertex 0 0 0
      vertex 1 0 0
      vertex 1 1 0
      vertex 0 1 0
    endloop
  endfacet
endsolid bad`;
    const imported = importStlAsciiWithReport(text, ids);
    expect(imported.report.warnings.some((item) => item.includes("non-finite"))).toBe(true);
    expect(imported.report.warnings.some((item) => item.includes("more than three"))).toBe(true);
    expect(imported.mesh.faces.size).toBe(1);
  });

  it("rejects OBJ vertices with NaN coordinates and invalid face indices", () => {
    const ids = createSequenceIdFactory("obj-bad");
    expect(() => importObjWithReport("v 0 0 NaN\n", ids)).toThrow(/non-finite/);
    expect(() =>
      importObjWithReport(
        `v 0 0 0
v 1 0 0
v 0 1 0
f 1 2 99
`,
        ids,
      ),
    ).toThrow(/missing vertex/);
  });

  it("rejects corrupt glTF accessors in strict mode", () => {
    const ids = createSequenceIdFactory("gltf-strict");
    const gltf = {
      asset: { version: "2.0" },
      buffers: [{ byteLength: 4, uri: "data:application/octet-stream;base64,AAAAAA==" }],
      bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 4 }],
      accessors: [{ bufferView: 0, componentType: 5126, count: 8, type: "VEC3" }],
      meshes: [
        {
          primitives: [{ attributes: { POSITION: 0 }, indices: 0 }],
        },
      ],
    };
    expect(() => importGltf(gltf, ids, { strict: true })).toThrow(/past the end|invalid/);
  });
});
