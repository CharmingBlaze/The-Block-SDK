import type { MaterialId, MeshId, ObjectId } from "@modeling-kit/core";
import type { MaterialData, ModelDocument, SceneNode } from "@modeling-kit/document";
import { bytesToBase64 } from "@modeling-kit/document";
import { triangulateMesh, type HalfEdgeMesh } from "@modeling-kit/mesh";
import { throwIfAborted, type IoCancelOptions } from "./cancel";
import { createConversionReport, triangulatedInterchangeLoss, type ConversionReport } from "./conversion";
import { encodeGlb } from "./gltf-glb";

export interface GltfExportOptions extends IoCancelOptions {
  readonly copyright?: string | undefined;
  readonly generator?: string | undefined;
}

export interface GltfExportResult {
  readonly gltf: Record<string, unknown>;
  readonly report: ConversionReport;
}

export interface GlbExportResult {
  readonly glb: Uint8Array;
  readonly report: ConversionReport;
}

const ARRAY_BUFFER = 34962;
const ELEMENT_ARRAY_BUFFER = 34963;
const FLOAT = 5126;
const UNSIGNED_SHORT = 5123;
const UNSIGNED_INT = 5125;
const TRIANGLES = 4;

function assembleGltf(
  doc: ModelDocument,
  meshes: ReadonlyMap<string, HalfEdgeMesh>,
  options: GltfExportOptions = {},
): { json: Record<string, unknown>; binary: Uint8Array; report: ConversionReport } {
  throwIfAborted(options.signal, "glTF export");
  const gltfMeshes: Array<Record<string, unknown>> = [];
  const gltfNodes: Array<Record<string, unknown>> = [];
  const accessors: Array<Record<string, unknown>> = [];
  const bufferViews: Array<Record<string, unknown>> = [];
  const bufferDataChunks: Uint8Array[] = [];
  const meshIndex = new Map<string, number>();

  let currentBufferOffset = 0;

  function appendBufferData(data: Uint8Array, target?: number): number {
    const pad = (4 - (data.byteLength % 4)) % 4;
    const aligned = new Uint8Array(data.byteLength + pad);
    aligned.set(data);
    const viewIndex = bufferViews.length;
    bufferViews.push({
      buffer: 0,
      byteOffset: currentBufferOffset,
      byteLength: data.byteLength,
      ...(target !== undefined ? { target } : {}),
    });
    bufferDataChunks.push(aligned);
    currentBufferOffset += aligned.byteLength;
    return viewIndex;
  }

  const referenced = new Set<string>();
  for (const node of doc.scene.nodes.values()) {
    if (node.type === "mesh_instance" && node.payloadRef && meshes.has(node.payloadRef)) {
      referenced.add(node.payloadRef);
    }
  }
  if (referenced.size === 0) {
    for (const id of meshes.keys()) {
      referenced.add(id);
    }
  }

  const materialIndex = new Map<MaterialId, number>();
  const gltfMaterials: Array<Record<string, unknown>> = [];
  for (const material of doc.materials.values()) {
    materialIndex.set(material.id, gltfMaterials.length);
    gltfMaterials.push(writeGltfMaterial(material));
  }

  let ngonCount = 0;
  for (const meshId of referenced) {
    throwIfAborted(options.signal, "glTF export");
    const mesh = meshes.get(meshId);
    if (!mesh) {
      continue;
    }
    for (const face of mesh.faces.values()) {
      if (mesh.getFaceVertices(face.id).length > 3) {
        ngonCount += 1;
      }
    }
    meshIndex.set(meshId, gltfMeshes.length);
    gltfMeshes.push(
      buildGltfMesh(
        mesh,
        meshId as MeshId,
        doc.meshes.get(meshId as MeshId)?.materialIds ?? [],
        materialIndex,
        appendBufferData,
        accessors,
      ),
    );
  }

  const nodeIndex = new Map<ObjectId, number>();
  const root = doc.scene.nodes.get(doc.scene.rootNodeId);
  const exportRoots = root?.childIds ?? [];
  const ordered: ObjectId[] = [];
  const seen = new Set<ObjectId>();
  const visit = (id: ObjectId): void => {
    if (seen.has(id)) {
      return;
    }
    seen.add(id);
    ordered.push(id);
    const node = doc.scene.nodes.get(id);
    if (!node) {
      return;
    }
    for (const childId of node.childIds) {
      visit(childId);
    }
  };
  for (const id of exportRoots) {
    visit(id);
  }
  for (const id of ordered) {
    nodeIndex.set(id, gltfNodes.length);
    gltfNodes.push({});
  }
  for (const id of ordered) {
    const node = doc.scene.nodes.get(id);
    if (!node) {
      continue;
    }
    gltfNodes[nodeIndex.get(id)!] = writeGltfNode(node, meshIndex, nodeIndex);
  }

  const totalLength = bufferDataChunks.reduce((acc, chunk) => acc + chunk.byteLength, 0);
  const combined = new Uint8Array(totalLength);
  let writeOffset = 0;
  for (const chunk of bufferDataChunks) {
    combined.set(chunk, writeOffset);
    writeOffset += chunk.byteLength;
  }

  return {
    json: {
      asset: {
        version: "2.0",
        generator: options.generator ?? "@modeling-kit/formats glTF Exporter",
        ...(options.copyright ? { copyright: options.copyright } : {}),
      },
      scene: 0,
      scenes: [{ nodes: exportRoots.map((id) => nodeIndex.get(id)!).filter((n) => n !== undefined) }],
      nodes: gltfNodes,
      meshes: gltfMeshes,
      ...(gltfMaterials.length > 0 ? { materials: gltfMaterials } : {}),
      accessors,
      bufferViews,
      buffers: [
        {
          byteLength: totalLength,
        },
      ],
    },
    binary: combined,
    report: createConversionReport("gltf", [], triangulatedInterchangeLoss(ngonCount)),
  };
}

/**
 * Serializes a ModelDocument scene graph and its meshes into glTF 2.0 JSON.
 * Mesh kernels stay canonical; this is a derived interchange dump (triangulated).
 */
export function exportGltfWithReport(
  doc: ModelDocument,
  meshes: ReadonlyMap<string, HalfEdgeMesh>,
  options: GltfExportOptions = {},
): GltfExportResult {
  const { json, binary, report } = assembleGltf(doc, meshes, options);
  return {
    gltf: {
      ...json,
      buffers: [
        {
          byteLength: binary.byteLength,
          uri: `data:application/octet-stream;base64,${bytesToBase64(binary)}`,
        },
      ],
    },
    report,
  };
}

export function exportGltf(
  doc: ModelDocument,
  meshes: ReadonlyMap<string, HalfEdgeMesh>,
  options: GltfExportOptions = {},
): Record<string, unknown> {
  return exportGltfWithReport(doc, meshes, options).gltf;
}

/** Packs the same payload as `exportGltf` into a GLB 2.0 container (JSON chunk + BIN chunk). */
export function exportGlbWithReport(
  doc: ModelDocument,
  meshes: ReadonlyMap<string, HalfEdgeMesh>,
  options: GltfExportOptions = {},
): GlbExportResult {
  const assembled = assembleGltf(doc, meshes, options);
  return {
    glb: encodeGlb(assembled.json, assembled.binary),
    report: { ...assembled.report, format: "glb" },
  };
}

export function exportGlb(
  doc: ModelDocument,
  meshes: ReadonlyMap<string, HalfEdgeMesh>,
  options: GltfExportOptions = {},
): Uint8Array {
  return exportGlbWithReport(doc, meshes, options).glb;
}

function writeGltfNode(
  node: SceneNode,
  meshIndex: ReadonlyMap<string, number>,
  nodeIndex: ReadonlyMap<ObjectId, number>,
): Record<string, unknown> {
  const t = node.localTransform;
  const written: Record<string, unknown> = { name: node.name };
  if (t.position.x !== 0 || t.position.y !== 0 || t.position.z !== 0) {
    written.translation = [t.position.x, t.position.y, t.position.z];
  }
  if (t.rotation.x !== 0 || t.rotation.y !== 0 || t.rotation.z !== 0 || t.rotation.w !== 1) {
    written.rotation = [t.rotation.x, t.rotation.y, t.rotation.z, t.rotation.w];
  }
  if (t.scale.x !== 1 || t.scale.y !== 1 || t.scale.z !== 1) {
    written.scale = [t.scale.x, t.scale.y, t.scale.z];
  }
  const children = node.childIds
    .map((childId) => nodeIndex.get(childId))
    .filter((index): index is number => index !== undefined);
  if (children.length > 0) {
    written.children = children;
  }
  if (node.type === "mesh_instance" && node.payloadRef) {
    const mesh = meshIndex.get(node.payloadRef);
    if (mesh !== undefined) {
      written.mesh = mesh;
    }
  }
  if (!node.visible) {
    written.extras = { visible: false };
  }
  return written;
}

function writeGltfMaterial(material: MaterialData): Record<string, unknown> {
  const written: Record<string, unknown> = {
    name: material.name,
    pbrMetallicRoughness: {
      baseColorFactor: [...material.baseColor],
      metallicFactor: material.metallic,
      roughnessFactor: material.roughness,
    },
    doubleSided: material.doubleSided,
  };
  if (material.emissive[0] !== 0 || material.emissive[1] !== 0 || material.emissive[2] !== 0) {
    written.emissiveFactor = [...material.emissive];
  }
  if (material.alphaMode === "mask") {
    written.alphaMode = "MASK";
    written.alphaCutoff = material.alphaCutoff;
  } else if (material.alphaMode === "blend") {
    written.alphaMode = "BLEND";
  }
  return written;
}

function buildGltfMesh(
  mesh: HalfEdgeMesh,
  meshId: MeshId,
  materialIds: readonly MaterialId[],
  materialIndex: ReadonlyMap<MaterialId, number>,
  appendBufferData: (data: Uint8Array, target?: number) => number,
  accessors: Array<Record<string, unknown>>,
): Record<string, unknown> {
  const tri = triangulateMesh(mesh);
  const posView = appendBufferData(new Uint8Array(new Float32Array(tri.positions).buffer), ARRAY_BUFFER);
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  for (let i = 0; i < tri.positions.length; i += 3) {
    const x = tri.positions[i]!;
    const y = tri.positions[i + 1]!;
    const z = tri.positions[i + 2]!;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    minZ = Math.min(minZ, z);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
    maxZ = Math.max(maxZ, z);
  }
  const posAccessor = accessors.length;
  accessors.push({
    bufferView: posView,
    componentType: FLOAT,
    count: tri.positions.length / 3,
    type: "VEC3",
    min: [minX, minY, minZ],
    max: [maxX, maxY, maxZ],
  });

  const normView = appendBufferData(new Uint8Array(new Float32Array(tri.normals).buffer), ARRAY_BUFFER);
  const normAccessor = accessors.length;
  accessors.push({
    bufferView: normView,
    componentType: FLOAT,
    count: tri.normals.length / 3,
    type: "VEC3",
  });

  const attributes: Record<string, number> = {
    POSITION: posAccessor,
    NORMAL: normAccessor,
  };
  if (tri.uvs.length === (tri.positions.length / 3) * 2) {
    const uvView = appendBufferData(new Uint8Array(new Float32Array(tri.uvs).buffer), ARRAY_BUFFER);
    attributes.TEXCOORD_0 = accessors.length;
    accessors.push({
      bufferView: uvView,
      componentType: FLOAT,
      count: tri.uvs.length / 2,
      type: "VEC2",
    });
  }

  const indicesBySlot = new Map<number, number[]>();
  for (let triangle = 0; triangle < tri.triangleFaceIds.length; triangle++) {
    const face = mesh.faces.get(tri.triangleFaceIds[triangle]!);
    const slot = face?.materialSlot ?? 0;
    const list = indicesBySlot.get(slot) ?? [];
    list.push(tri.indices[triangle * 3]!, tri.indices[triangle * 3 + 1]!, tri.indices[triangle * 3 + 2]!);
    indicesBySlot.set(slot, list);
  }
  if (indicesBySlot.size === 0) {
    const fallback = [...tri.indices];
    indicesBySlot.set(0, fallback);
  }

  const primitives: Array<Record<string, unknown>> = [];
  const slots = [...indicesBySlot.keys()].sort((a, b) => a - b);
  for (const slot of slots) {
    const slotIndices = indicesBySlot.get(slot) ?? [];
    if (slotIndices.length === 0) {
      continue;
    }
    const maxIndex = slotIndices.reduce((max, value) => Math.max(max, value), 0);
    const useUint32 = maxIndex > 65535;
    const indexBytes = useUint32
      ? new Uint8Array(new Uint32Array(slotIndices).buffer)
      : new Uint8Array(new Uint16Array(slotIndices).buffer);
    const indexView = appendBufferData(indexBytes, ELEMENT_ARRAY_BUFFER);
    const indexAccessor = accessors.length;
    accessors.push({
      bufferView: indexView,
      componentType: useUint32 ? UNSIGNED_INT : UNSIGNED_SHORT,
      count: slotIndices.length,
      type: "SCALAR",
    });
    const materialId = materialIds[slot];
    const gltfMaterial = materialId !== undefined ? materialIndex.get(materialId) : undefined;
    primitives.push({
      attributes,
      indices: indexAccessor,
      mode: TRIANGLES,
      ...(gltfMaterial !== undefined ? { material: gltfMaterial } : {}),
    });
  }

  return {
    name: meshId,
    primitives,
  };
}
