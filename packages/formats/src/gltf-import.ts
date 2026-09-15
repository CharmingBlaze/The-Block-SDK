import { SchemaError, type IdFactory, type MeshId, type ObjectId } from "@modeling-kit/core";
import {
  base64ToBytes,
  createMaterialData,
  createModelDocument,
  type ModelDocument,
} from "@modeling-kit/document";
import { Matrix4, matrixToTransform, type TransformData } from "@modeling-kit/math";
import { MeshBuilder, serializeMesh, type HalfEdgeMesh } from "@modeling-kit/mesh";
import { addNode } from "@modeling-kit/scene";
import { isGlb, parseGlb } from "./gltf-glb";
import { throwIfAborted } from "./cancel";
import { createConversionReport, type ConversionReport } from "./conversion";

export interface GltfImportResult {
  readonly document: ModelDocument;
  readonly meshes: Map<MeshId, HalfEdgeMesh>;
  readonly warnings: readonly string[];
  readonly dataLoss: readonly string[];
  readonly report: ConversionReport;
}

export interface GltfImportOptions {
  readonly name?: string;
  /** Merge render vertices that share a position into one kernel vertex. Default 1e-5. */
  readonly weldEpsilon?: number;
  readonly signal?: AbortSignal;
}

export type GltfImportSource = string | Record<string, unknown> | ArrayBuffer | ArrayBufferView;

const FLOAT = 5126;
const UNSIGNED_SHORT = 5123;
const UNSIGNED_INT = 5125;
const UNSIGNED_BYTE = 5121;
const SHORT = 5122;
const BYTE = 5120;
const TRIANGLES = 4;

const COMPONENT_BYTES: Record<number, number> = {
  [BYTE]: 1,
  [UNSIGNED_BYTE]: 1,
  [SHORT]: 2,
  [UNSIGNED_SHORT]: 2,
  [UNSIGNED_INT]: 4,
  [FLOAT]: 4,
};

const TYPE_COMPONENTS: Record<string, number> = {
  SCALAR: 1,
  VEC2: 2,
  VEC3: 3,
  VEC4: 4,
  MAT2: 4,
  MAT3: 9,
  MAT4: 16,
};

/**
 * Imports glTF 2.0 JSON or GLB (embedded / BIN-chunk buffers) into a ModelDocument.
 * Implemented from the Khronos glTF 2.0 specification, not from any DCC exporter.
 */
export function importGltf(
  source: GltfImportSource,
  ids: IdFactory,
  options: GltfImportOptions = {},
): GltfImportResult {
  throwIfAborted(options.signal, "glTF import");
  const warnings: string[] = [];
  const dataLoss: string[] = [
    "glTF import welds coincident render vertices; native IDs, history, and selection are not recovered",
  ];
  const parsed = resolveGltfSource(source);
  const gltf = parsed.json;
  const asset = asRecord(gltf.asset);
  if (!asset || String(asset.version) !== "2.0") {
    throw new SchemaError("glTF asset.version must be \"2.0\"");
  }

  const buffers = decodeBuffers(asArray(gltf.buffers), warnings, parsed.bin);
  const bufferViews = asArray(gltf.bufferViews);
  const accessors = asArray(gltf.accessors);
  const gltfMeshes = asArray(gltf.meshes);
  const gltfNodes = asArray(gltf.nodes);
  const gltfMaterials = asArray(gltf.materials);
  if (asArray(gltf.animations).length > 0) {
    warnings.push("glTF animations are not imported in Release 1.0");
  }
  if (asArray(gltf.skins).length > 0) {
    warnings.push("glTF skins are not imported in Release 1.0");
  }
  const weldEpsilon = options.weldEpsilon ?? 1e-5;

  const document = createModelDocument({ ids, name: options.name ?? "glTF Import" });
  const meshes = new Map<MeshId, HalfEdgeMesh>();
  const meshIdsByIndex = new Map<number, MeshId>();

  for (let materialIndex = 0; materialIndex < gltfMaterials.length; materialIndex++) {
    const material = asRecord(gltfMaterials[materialIndex]);
    if (!material) {
      continue;
    }
    const pbr = asRecord(material.pbrMetallicRoughness);
    const baseColor = asNumberArray(pbr?.baseColorFactor) ?? [1, 1, 1, 1];
    const emissive = asNumberArray(material.emissiveFactor) ?? [0, 0, 0];
    const alphaMode = parseAlpha(material.alphaMode);
    document.materials.set(
      createMaterialData(ids.material(), typeof material.name === "string" ? material.name : `Material ${materialIndex}`, {
        baseColor: [baseColor[0] ?? 1, baseColor[1] ?? 1, baseColor[2] ?? 1, baseColor[3] ?? 1],
        metallic: typeof pbr?.metallicFactor === "number" ? pbr.metallicFactor : 1,
        roughness: typeof pbr?.roughnessFactor === "number" ? pbr.roughnessFactor : 1,
        emissive: [emissive[0] ?? 0, emissive[1] ?? 0, emissive[2] ?? 0],
        alphaMode,
        alphaCutoff: typeof material.alphaCutoff === "number" ? material.alphaCutoff : 0.5,
        doubleSided: material.doubleSided === true,
      }),
    );
  }
  const materialList = [...document.materials.values()];

  for (let meshIndex = 0; meshIndex < gltfMeshes.length; meshIndex++) {
    const gltfMesh = asRecord(gltfMeshes[meshIndex]);
    if (!gltfMesh) {
      continue;
    }
    const built = buildMesh(
      gltfMesh,
      accessors,
      bufferViews,
      buffers,
      ids,
      weldEpsilon,
      materialList.map((item) => item.id),
      warnings,
    );
    if (!built) {
      continue;
    }
    const meshId = built.id;
    meshIdsByIndex.set(meshIndex, meshId);
    meshes.set(meshId, built);
    document.meshes.set({
      id: meshId,
      name: typeof gltfMesh.name === "string" ? gltfMesh.name : `Mesh ${meshIndex}`,
      kernel: serializeMesh(built),
      materialIds: materialList.map((item) => item.id),
      metadata: {},
    });
  }

  const objectIds = gltfNodes.map(() => ids.object());
  const imported = new Set<number>();
  const scenes = asArray(gltf.scenes);
  const sceneIndex = typeof gltf.scene === "number" ? gltf.scene : 0;
  const scene = asRecord(scenes[sceneIndex]) ?? { nodes: [] };
  const roots = asNumberArray(scene.nodes) ?? [];

  const importNode = (index: number, parentId: ObjectId): void => {
    throwIfAborted(options.signal, "glTF import");
    if (imported.has(index) || index < 0 || index >= gltfNodes.length) {
      return;
    }
    imported.add(index);
    const raw = asRecord(gltfNodes[index]) ?? {};
    const objectId = objectIds[index]!;
    const meshIndex = typeof raw.mesh === "number" ? raw.mesh : undefined;
    const meshId = meshIndex !== undefined ? meshIdsByIndex.get(meshIndex) : undefined;
    const extras = asRecord(raw.extras);
    addNode(document, objectId, {
      name: typeof raw.name === "string" ? raw.name : `Node ${index}`,
      type: meshId ? "mesh_instance" : "group",
      parentId,
      localTransform: transformFromGltfNode(raw),
      ...(meshId ? { payloadRef: meshId } : {}),
    });
    if (extras?.visible === false) {
      const node = document.scene.nodes.get(objectId);
      if (node) {
        document.scene.nodes.set(objectId, { ...node, visible: false });
      }
    }
    for (const child of asNumberArray(raw.children) ?? []) {
      importNode(child, objectId);
    }
  };

  for (const rootIndex of roots) {
    importNode(rootIndex, document.scene.rootNodeId);
  }

  if (imported.size === 0 && meshIdsByIndex.size > 0) {
    for (const meshId of meshIdsByIndex.values()) {
      addNode(document, ids.object(), {
        name: document.meshes.get(meshId)?.name ?? "Mesh",
        type: "mesh_instance",
        payloadRef: meshId,
      });
    }
  }

  return {
    document,
    meshes,
    warnings,
    dataLoss,
    report: createConversionReport("gltf", warnings, dataLoss),
  };
}

function resolveGltfSource(source: GltfImportSource): { json: Record<string, unknown>; bin?: Uint8Array } {
  if (typeof source === "string") {
    return { json: parseJson(source) };
  }
  if (source instanceof ArrayBuffer) {
    return resolveBytes(new Uint8Array(source));
  }
  if (ArrayBuffer.isView(source)) {
    return resolveBytes(new Uint8Array(source.buffer, source.byteOffset, source.byteLength));
  }
  return { json: source };
}

function resolveBytes(bytes: Uint8Array): { json: Record<string, unknown>; bin?: Uint8Array } {
  if (isGlb(bytes)) {
    return parseGlb(bytes);
  }
  return { json: parseJson(new TextDecoder().decode(bytes)) };
}

function parseJson(text: string): Record<string, unknown> {
  try {
    const raw: unknown = JSON.parse(text);
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      throw new SchemaError("glTF JSON must be an object");
    }
    return raw as Record<string, unknown>;
  } catch (error) {
    if (error instanceof SchemaError) {
      throw error;
    }
    throw new SchemaError(`glTF JSON is malformed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function decodeBuffers(buffers: unknown[], warnings: string[], binChunk?: Uint8Array): Uint8Array[] {
  let binConsumed = false;
  return buffers.map((item, index) => {
    const record = asRecord(item);
    const uri = typeof record?.uri === "string" ? record.uri : "";
    if (!uri) {
      if (binChunk && !binConsumed) {
        binConsumed = true;
        return binChunk;
      }
      const declared = typeof record?.byteLength === "number" ? record.byteLength : 0;
      if (declared === 0) {
        return new Uint8Array(0);
      }
      warnings.push(`Buffer ${index} is not an embedded data URI and was skipped`);
      return new Uint8Array(0);
    }
    const comma = uri.indexOf(",");
    if (!uri.startsWith("data:") || comma < 0) {
      warnings.push(`Buffer ${index} is not an embedded data URI and was skipped`);
      return new Uint8Array(0);
    }
    return base64ToBytes(uri.slice(comma + 1));
  });
}

function buildMesh(
  gltfMesh: Record<string, unknown>,
  accessors: unknown[],
  bufferViews: unknown[],
  buffers: Uint8Array[],
  ids: IdFactory,
  weldEpsilon: number,
  materialIds: readonly string[],
  warnings: string[],
): HalfEdgeMesh | null {
  const primitives = asArray(gltfMesh.primitives);
  if (primitives.length === 0) {
    return null;
  }
  const builder = new MeshBuilder(ids.mesh());
  const vertexKey = new Map<string, ReturnType<MeshBuilder["addVertex"]>>();
  const quantize = 1 / Math.max(weldEpsilon, 1e-8);
  let faces = 0;

  for (const primitiveUnknown of primitives) {
    const primitive = asRecord(primitiveUnknown);
    if (!primitive) {
      continue;
    }
    const mode = typeof primitive.mode === "number" ? primitive.mode : TRIANGLES;
    if (mode !== TRIANGLES) {
      warnings.push(`Skipped primitive with unsupported mode ${mode}`);
      continue;
    }
    const attributes = asRecord(primitive.attributes);
    if (!attributes || typeof attributes.POSITION !== "number") {
      warnings.push("Skipped primitive without POSITION");
      continue;
    }
    const positions = readAccessor(accessors, bufferViews, buffers, attributes.POSITION, warnings);
    const uvs =
      typeof attributes.TEXCOORD_0 === "number"
        ? readAccessor(accessors, bufferViews, buffers, attributes.TEXCOORD_0, warnings)
        : [];
    const indices =
      typeof primitive.indices === "number"
        ? readAccessor(accessors, bufferViews, buffers, primitive.indices, warnings)
        : Array.from({ length: positions.length / 3 }, (_, i) => i);
    const slot =
      typeof primitive.material === "number" && primitive.material >= 0 && primitive.material < materialIds.length
        ? primitive.material
        : 0;

    for (let i = 0; i + 2 < indices.length; i += 3) {
      const cornerIds: ReturnType<MeshBuilder["addVertex"]>[] = [];
      const cornerUvs: [number, number][] = [];
      let valid = true;
      for (let k = 0; k < 3; k++) {
        const vertexIndex = Math.round(indices[i + k]!);
        const px = positions[vertexIndex * 3];
        const py = positions[vertexIndex * 3 + 1];
        const pz = positions[vertexIndex * 3 + 2];
        if (px === undefined || py === undefined || pz === undefined) {
          valid = false;
          break;
        }
        const key = `${Math.round(px * quantize)}:${Math.round(py * quantize)}:${Math.round(pz * quantize)}`;
        let vertexId = vertexKey.get(key);
        if (!vertexId) {
          vertexId = builder.addVertex(px, py, pz, ids.vertex());
          vertexKey.set(key, vertexId);
        }
        cornerIds.push(vertexId);
        if (uvs.length >= (vertexIndex + 1) * 2) {
          cornerUvs.push([uvs[vertexIndex * 2]!, uvs[vertexIndex * 2 + 1]!]);
        }
      }
      if (!valid || new Set(cornerIds).size < 3) {
        continue;
      }
      builder.addFace(cornerIds, {
        id: ids.face(),
        materialSlot: slot,
        ...(cornerUvs.length === 3 ? { uvs: cornerUvs } : {}),
      });
      faces += 1;
    }
  }

  return faces > 0 ? builder.getMesh() : null;
}

function readAccessor(
  accessors: unknown[],
  bufferViews: unknown[],
  buffers: Uint8Array[],
  index: number,
  warnings: string[],
): number[] {
  const accessor = asRecord(accessors[index]);
  if (!accessor) {
    warnings.push(`Missing accessor ${index}`);
    return [];
  }
  if (accessor.sparse) {
    warnings.push(`Sparse accessor ${index} is not supported`);
    return [];
  }
  const count = typeof accessor.count === "number" ? accessor.count : 0;
  const type = typeof accessor.type === "string" ? accessor.type : "SCALAR";
  const componentType = typeof accessor.componentType === "number" ? accessor.componentType : FLOAT;
  const components = TYPE_COMPONENTS[type] ?? 1;
  const componentBytes = COMPONENT_BYTES[componentType] ?? 4;
  const viewIndex = typeof accessor.bufferView === "number" ? accessor.bufferView : undefined;
  const accessorOffset = typeof accessor.byteOffset === "number" ? accessor.byteOffset : 0;
  const normalized = accessor.normalized === true;
  if (viewIndex === undefined) {
    return new Array(count * components).fill(0);
  }
  const view = asRecord(bufferViews[viewIndex]);
  if (!view) {
    warnings.push(`Missing bufferView ${viewIndex}`);
    return [];
  }
  const bufferIndex = typeof view.buffer === "number" ? view.buffer : 0;
  const viewOffset = typeof view.byteOffset === "number" ? view.byteOffset : 0;
  const stride = typeof view.byteStride === "number" ? view.byteStride : componentBytes * components;
  const bytes = buffers[bufferIndex];
  if (!bytes) {
    return [];
  }
  const data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    const elementOffset = viewOffset + accessorOffset + i * stride;
    for (let c = 0; c < components; c++) {
      out.push(readComponent(data, elementOffset + c * componentBytes, componentType, normalized));
    }
  }
  return out;
}

function readComponent(data: DataView, offset: number, componentType: number, normalized: boolean): number {
  if (offset < 0 || offset + (COMPONENT_BYTES[componentType] ?? 1) > data.byteLength) {
    return 0;
  }
  switch (componentType) {
    case BYTE: {
      const value = data.getInt8(offset);
      return normalized ? Math.max(value / 127, -1) : value;
    }
    case UNSIGNED_BYTE: {
      const value = data.getUint8(offset);
      return normalized ? value / 255 : value;
    }
    case SHORT: {
      const value = data.getInt16(offset, true);
      return normalized ? Math.max(value / 32767, -1) : value;
    }
    case UNSIGNED_SHORT: {
      const value = data.getUint16(offset, true);
      return normalized ? value / 65535 : value;
    }
    case UNSIGNED_INT:
      return data.getUint32(offset, true);
    case FLOAT:
    default:
      return data.getFloat32(offset, true);
  }
}

function transformFromGltfNode(raw: Record<string, unknown>): TransformData {
  const matrix = asNumberArray(raw.matrix);
  if (matrix && matrix.length === 16) {
    return matrixToTransform(new Matrix4(matrix));
  }
  const translation = asNumberArray(raw.translation) ?? [0, 0, 0];
  const rotation = asNumberArray(raw.rotation) ?? [0, 0, 0, 1];
  const scale = asNumberArray(raw.scale) ?? [1, 1, 1];
  return {
    position: { x: translation[0] ?? 0, y: translation[1] ?? 0, z: translation[2] ?? 0 },
    rotation: { x: rotation[0] ?? 0, y: rotation[1] ?? 0, z: rotation[2] ?? 0, w: rotation[3] ?? 1 },
    scale: { x: scale[0] ?? 1, y: scale[1] ?? 1, z: scale[2] ?? 1 },
  };
}

function parseAlpha(value: unknown): "opaque" | "mask" | "blend" {
  if (value === "MASK") {
    return "mask";
  }
  if (value === "BLEND") {
    return "blend";
  }
  return "opaque";
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asNumberArray(value: unknown): number[] | undefined {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "number")) {
    return undefined;
  }
  return value;
}
