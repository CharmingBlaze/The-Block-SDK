import { Accessor, type TypedArray } from "@gltf-transform/core";
import type { MaterialId } from "@modeling-kit/core";
import { triangulateMesh, type HalfEdgeMesh } from "@modeling-kit/mesh";
import type { MeshSkinBinding } from "@modeling-kit/document";
import { DEFAULT_MAX_BONE_INFLUENCES, normalizeWeights } from "@modeling-kit/rigging";
import { countNgons } from "../../conversion";
import { PRIMITIVE_MODE_TRIANGLES } from "../conversion/topology";
import { writeTrianglePrimitive } from "./export-primitive";
import type { GltfExportContext } from "./export-context";

export function exportMesh(context: GltfExportContext, meshId: string, mesh: HalfEdgeMesh) {
  if (mesh.vertices.size === 0) {
    context.sink.warn("empty-mesh", `Skipped empty mesh ${meshId}`);
    return undefined;
  }
  const nGons = countNgons([...mesh.faces.values()].map((face) => mesh.getFaceVertices(face.id).length));
  if (nGons > 0) {
    context.sink.loss("metadata-dropped", `${nGons} n-gon faces were triangulated for the interchange mesh`);
  }
  const tri = triangulateMesh(mesh);
  const target = context.target;
  const buffer = target.getRoot().listBuffers()[0] ?? target.createBuffer();
  const position = target
    .createAccessor()
    .setType("VEC3")
    .setArray(asAccessorArray(tri.positions))
    .setBuffer(buffer);
  const normal = target.createAccessor().setType("VEC3").setArray(asAccessorArray(tri.normals)).setBuffer(buffer);
  const uv = target.createAccessor().setType("VEC2").setArray(asAccessorArray(tri.uvs)).setBuffer(buffer);
  const attributes: Record<string, Accessor> = {
    POSITION: position,
    NORMAL: normal,
    TEXCOORD_0: uv,
  };
  const record = context.document.meshes.get(meshId as never);
  maybeWriteSkinAttributes(context, record?.skin, tri.vertexIdMap, attributes, buffer);
  const indicesBySlot = new Map<number, number[]>();
  for (let triangle = 0; triangle < tri.triangleFaceIds.length; triangle++) {
    const face = mesh.faces.get(tri.triangleFaceIds[triangle]!);
    const slot = face?.materialSlot ?? 0;
    const list = indicesBySlot.get(slot) ?? [];
    list.push(tri.indices[triangle * 3]!, tri.indices[triangle * 3 + 1]!, tri.indices[triangle * 3 + 2]!);
    indicesBySlot.set(slot, list);
  }
  if (indicesBySlot.size === 0) {
    indicesBySlot.set(0, [...tri.indices]);
  }
  const gltfMesh = target.createMesh(record?.name ?? meshId);
  const slots = [...indicesBySlot.keys()].sort((a, b) => a - b);
  for (const slot of slots) {
    const slotIndices = indicesBySlot.get(slot) ?? [];
    if (slotIndices.length === 0) {
      continue;
    }
    const indexAccessor = target
      .createAccessor()
      .setType("SCALAR")
      .setArray(asAccessorArray(maxIndex(slotIndices) > 65535 ? new Uint32Array(slotIndices) : new Uint16Array(slotIndices)))
      .setBuffer(buffer);
    const primitive = writeTrianglePrimitive(target, indexAccessor, attributes, PRIMITIVE_MODE_TRIANGLES);
    const materialId = record?.materialIds[slot] as MaterialId | undefined;
    if (materialId) {
      const material = context.materialById.get(materialId);
      if (material) {
        primitive.setMaterial(material);
      }
    }
    gltfMesh.addPrimitive(primitive);
  }
  context.meshById.set(meshId, gltfMesh);
  return gltfMesh;
}

function maybeWriteSkinAttributes(
  context: GltfExportContext,
  skin: MeshSkinBinding | undefined,
  vertexIdMap: readonly string[],
  attributes: Record<string, Accessor>,
  buffer: ReturnType<GltfExportContext["target"]["createBuffer"]>,
): void {
  if (!skin || !context.options.exportSkins) {
    return;
  }
  const joints: number[] = [];
  const weights: number[] = [];
  const ordered =
    context.jointOrderBySkeleton.get(skin.skeletonId) ??
    skin.vertices.flatMap((entry) => entry.influences.map((item) => item.boneId)).filter((id, index, all) => all.indexOf(id) === index);
  const boneIndex = new Map(ordered.map((id, index) => [id, index]));
  for (const vertexId of vertexIdMap) {
    const entry = skin.vertices.find((item) => item.vertexId === vertexId);
    const normalized = normalizeWeights(entry?.influences ?? [], DEFAULT_MAX_BONE_INFLUENCES);
    if ((entry?.influences.length ?? 0) > DEFAULT_MAX_BONE_INFLUENCES) {
      context.sink.loss("skin-influence-truncated", `Export reduced influences to ${DEFAULT_MAX_BONE_INFLUENCES} for ${vertexId}`);
    }
    for (let i = 0; i < 4; i += 1) {
      const influence = normalized[i];
      joints.push(influence ? (boneIndex.get(influence.boneId) ?? 0) : 0);
      weights.push(influence?.weight ?? 0);
    }
  }
  attributes.JOINTS_0 = context.target
    .createAccessor()
    .setType("VEC4")
    .setArray(asAccessorArray(new Uint16Array(joints)))
    .setBuffer(buffer);
  attributes.WEIGHTS_0 = context.target
    .createAccessor()
    .setType("VEC4")
    .setArray(asAccessorArray(new Float32Array(weights)))
    .setBuffer(buffer);
}

function asAccessorArray(array: Float32Array | Uint16Array | Uint32Array): TypedArray {
  return array as unknown as TypedArray;
}

function maxIndex(values: readonly number[]): number {
  return values.reduce((max, value) => Math.max(max, value), 0);
}
