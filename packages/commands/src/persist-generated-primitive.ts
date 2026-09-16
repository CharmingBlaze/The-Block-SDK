import { type FaceId, type MeshId } from "@modeling-kit/core";
import type { CommandContext } from "@modeling-kit/history";
import {
  deserializeMesh,
  serializeMesh,
  type CubeFaceIds,
  type SerializedMesh,
} from "@modeling-kit/mesh";
import type { PrimitiveFaceGroups, PrimitiveResult } from "@modeling-kit/primitives";
import { addNode, removeNode } from "@modeling-kit/scene";
import type { CreatePrimitiveResult } from "./create-primitive-result";
import { FACE_GROUPS_METADATA_KEY, serializeFaceGroups } from "./face-groups";

export function persistGeneratedPrimitive(
  context: CommandContext,
  generated: PrimitiveResult,
  name: string,
  meshId: MeshId,
  allocated?: CubeFaceIds,
): CreatePrimitiveResult {
  const objectId = context.ids.object();
  const kernel = serializeMesh(generated.mesh);
  context.meshes.set(meshId, generated.mesh);
  context.document.meshes.set({
    id: meshId,
    name,
    kernel,
    materialIds: [],
    metadata: { [FACE_GROUPS_METADATA_KEY]: serializeFaceGroups(generated.groups) },
  });
  addNode(context.document, objectId, {
    name,
    type: "mesh_instance",
    payloadRef: meshId,
  });
  const result: CreatePrimitiveResult = {
    objectId,
    meshId,
    groups: generated.groups,
    faceIds: cubeFaceIdsFromGroups(generated.groups, allocated),
  };
  context.events.emit("document:changed", { aspect: "scene", objectIds: [objectId] });
  context.events.emit("mesh:changed", { meshIds: [meshId] });
  return result;
}

export function restoreGeneratedPrimitive(
  context: CommandContext,
  result: CreatePrimitiveResult,
  kernel: SerializedMesh,
  name: string,
): void {
  const mesh = deserializeMesh(kernel);
  context.meshes.set(result.meshId, mesh);
  context.document.meshes.set({
    id: result.meshId,
    name,
    kernel,
    materialIds: [],
    metadata: { [FACE_GROUPS_METADATA_KEY]: serializeFaceGroups(result.groups) },
  });
  if (!context.document.scene.nodes.has(result.objectId)) {
    addNode(context.document, result.objectId, {
      name,
      type: "mesh_instance",
      payloadRef: result.meshId,
    });
  }
}

export function unpersistGeneratedPrimitive(context: CommandContext, result: CreatePrimitiveResult): void {
  removeNode(context.document, result.objectId);
  context.document.meshes.delete(result.meshId);
  context.meshes.delete(result.meshId);
  context.events.emit("document:changed", { aspect: "scene", objectIds: [result.objectId] });
}

function cubeFaceIdsFromGroups(
  groups: PrimitiveFaceGroups,
  allocated: CubeFaceIds | undefined,
): CubeFaceIds & { top: FaceId; bottom: FaceId } {
  if (allocated) {
    return { ...allocated, top: allocated.posY, bottom: allocated.negY };
  }
  const fallback =
    groups.top[0] ??
    groups.sides[0] ??
    groups.bottom[0] ??
    groups.caps[0] ??
    groups.front[0];
  if (!fallback) {
    throw new Error("Primitive produced no faces");
  }
  return {
    posX: groups.posX ?? fallback,
    negX: groups.negX ?? fallback,
    posY: groups.posY ?? groups.top[0] ?? fallback,
    negY: groups.negY ?? groups.bottom[0] ?? fallback,
    posZ: groups.posZ ?? groups.front[0] ?? fallback,
    negZ: groups.negZ ?? groups.back[0] ?? fallback,
    top: groups.top[0] ?? fallback,
    bottom: groups.bottom[0] ?? fallback,
  };
}
