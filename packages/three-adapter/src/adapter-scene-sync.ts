import { brand, type MeshId, type ObjectId } from "@modeling-kit/core";
import type { ModelingSession } from "@modeling-kit/commands";
import { getEffectiveVisibility, isMeshLikeNode, type SceneNode } from "@modeling-kit/document";
import { BufferGeometry, Group, Mesh, type Object3D } from "three";
import type { SharedGeometry, TrackedObject } from "./adapter-types";
import { applyLocalTransform, resolveDisplayTransform } from "./adapter-transform";
import { syncDerivedGeometry } from "./geometry";
import { applyFaceMaterialGroups, disposeMaterials, materialsForRecord } from "./pbr";
import { applyCpuSkin } from "./skin";

export interface SceneMirrorContext {
  readonly session: ModelingSession;
  readonly tracked: Map<ObjectId, TrackedObject>;
  readonly geometries: Map<MeshId, SharedGeometry>;
}

export function rebuildSceneGraph(context: SceneMirrorContext, root: Object3D): void {
  const live = new Set<ObjectId>();
  syncNode(context, context.session.document.scene.rootNodeId, root, live);
  for (const [id, tracked] of context.tracked) {
    if (!live.has(id)) {
      disposeTracked(context, tracked);
      context.tracked.delete(id);
    }
  }
}

export function applyTrackedTransforms(
  context: SceneMirrorContext,
  objectIds: readonly ObjectId[],
): "ok" | "rebuild" {
  for (const id of objectIds) {
    const node = context.session.document.scene.nodes.get(id);
    const tracked = context.tracked.get(id);
    if (!node || !tracked) {
      return "rebuild";
    }
    applyLocalTransform(tracked.object, resolveDisplayTransform(context.session, node));
  }
  return "ok";
}

export function applyTrackedVisibility(
  context: SceneMirrorContext,
  objectIds: readonly ObjectId[],
): "ok" | "rebuild" {
  for (const id of objectIds) {
    const node = context.session.document.scene.nodes.get(id);
    const tracked = context.tracked.get(id);
    if (!node || !tracked) {
      return "rebuild";
    }
    tracked.object.visible = getEffectiveVisibility(context.session.document, id);
  }
  return "ok";
}

export function applyTrackedNames(context: SceneMirrorContext, objectIds: readonly ObjectId[]): void {
  for (const id of objectIds) {
    const node = context.session.document.scene.nodes.get(id);
    const tracked = context.tracked.get(id);
    if (!node || !tracked) {
      return;
    }
    tracked.object.name = node.name;
  }
}

export function syncMeshesById(context: SceneMirrorContext, meshIds: readonly string[]): void {
  const wanted = new Set(meshIds);
  for (const [objectId, tracked] of context.tracked) {
    const meshId = tracked.object.userData.meshId as MeshId | undefined;
    if (!meshId || !wanted.has(meshId) || !(tracked.object instanceof Mesh)) {
      continue;
    }
    const node = context.session.document.scene.nodes.get(objectId);
    if (node) {
      syncMesh(context, node, tracked.object);
    }
  }
}

export function syncMaterialsOnly(context: SceneMirrorContext): void {
  for (const [objectId, tracked] of context.tracked) {
    if (!(tracked.object instanceof Mesh)) {
      continue;
    }
    const node = context.session.document.scene.nodes.get(objectId);
    if (!node || !isMeshLikeNode(node) || !node.payloadRef) {
      continue;
    }
    const meshId = brand<string, "MeshId">(node.payloadRef);
    const kernel = context.session.meshes.get(meshId);
    const record = context.session.document.meshes.get(meshId);
    if (!kernel || !record || !tracked.geometry || !tracked.mapping) {
      continue;
    }
    const materialKey = `${context.session.document.materials.revision}:${record.materialIds.join(",")}`;
    applyFaceMaterialGroups(tracked.geometry, kernel, tracked.mapping);
    if (tracked.materialKey !== materialKey) {
      const nextMaterials = materialsForRecord(context.session.document, record);
      disposeMaterials(tracked.material);
      tracked.object.material = nextMaterials.length === 1 ? nextMaterials[0]! : nextMaterials;
      tracked.material = tracked.object.material;
      tracked.materialKey = materialKey;
    }
  }
}

export function disposeTracked(context: SceneMirrorContext, tracked: TrackedObject): void {
  tracked.object.removeFromParent();
  if (tracked.geometry) {
    releaseGeometry(context, tracked.object.userData.meshId as MeshId | undefined, tracked.geometry);
  }
  disposeMaterials(tracked.material);
}

export function releaseGeometry(
  context: SceneMirrorContext,
  meshId: MeshId | undefined,
  geometry: BufferGeometry,
): void {
  if (!meshId) {
    geometry.dispose();
    return;
  }
  const handle = context.geometries.get(meshId);
  if (!handle || handle.geometry !== geometry) {
    geometry.dispose();
    return;
  }
  handle.refs = Math.max(0, handle.refs - 1);
  if (handle.refs === 0) {
    handle.geometry.dispose();
    context.geometries.delete(meshId);
  }
}

function syncNode(
  context: SceneMirrorContext,
  id: ObjectId,
  parent: Object3D,
  live: Set<ObjectId>,
): void {
  const node = context.session.document.scene.nodes.get(id);
  if (!node) {
    return;
  }
  live.add(id);
  const object = ensureObject(context, node);
  if (object.parent !== parent) {
    parent.add(object);
  }
  applyLocalTransform(object, resolveDisplayTransform(context.session, node));
  if (isMeshLikeNode(node) && node.payloadRef) {
    syncMesh(context, node, object as Mesh);
  }
  for (const childId of node.childIds) {
    syncNode(context, childId, object, live);
  }
}

function ensureObject(context: SceneMirrorContext, node: SceneNode): Object3D {
  const existing = context.tracked.get(node.id);
  if (existing) {
    return existing.object;
  }
  const object = isMeshLikeNode(node) ? new Mesh() : new Group();
  object.name = node.name;
  object.userData.objectId = node.id;
  if (isMeshLikeNode(node) && node.payloadRef) {
    object.userData.meshId = brand<string, "MeshId">(node.payloadRef);
  }
  if (node.type === "bone" && node.payloadRef) {
    object.userData.boneId = node.payloadRef;
  }
  context.tracked.set(node.id, { object });
  return object;
}

function syncMesh(context: SceneMirrorContext, node: SceneNode, object: Mesh): void {
  const meshId = brand<string, "MeshId">(node.payloadRef!);
  const kernel = context.session.meshes.get(meshId);
  const tracked = context.tracked.get(node.id);
  if (!kernel || !tracked) {
    return;
  }
  object.userData.meshId = meshId;
  const record = context.session.document.meshes.get(meshId);
  const materialKey = record
    ? `${context.session.document.materials.revision}:${record.materialIds.join(",")}`
    : "";
  const poseKey = `${context.session.animationTime}:${context.session.poseLocals.size}`;
  let handle = context.geometries.get(meshId);
  if (!handle) {
    const next = syncDerivedGeometry(kernel);
    handle = {
      geometry: next.geometry,
      mapping: next.mapping,
      revision: kernel.revision,
      topologyRevision: kernel.topologyRevision,
      uvRevision: kernel.uvRevision,
      refs: 0,
    };
    context.geometries.set(meshId, handle);
  } else if (handle.revision !== kernel.revision) {
    const next = syncDerivedGeometry(kernel, { geometry: handle.geometry, mapping: handle.mapping });
    if (!next.reused) {
      handle.geometry.dispose();
    }
    handle.geometry = next.geometry;
    handle.mapping = next.mapping;
    handle.revision = kernel.revision;
    handle.topologyRevision = kernel.topologyRevision;
    handle.uvRevision = kernel.uvRevision;
  }
  if (tracked.geometry !== handle.geometry) {
    if (tracked.geometry) {
      releaseGeometry(context, tracked.object.userData.meshId as MeshId | undefined, tracked.geometry);
    }
    handle.refs += 1;
    object.geometry = handle.geometry;
    tracked.geometry = handle.geometry;
    tracked.mapping = handle.mapping;
  }
  tracked.meshRevision = kernel.revision;
  if (record && tracked.geometry && tracked.mapping) {
    applyFaceMaterialGroups(tracked.geometry, kernel, tracked.mapping);
    if (tracked.materialKey !== materialKey) {
      const nextMaterials = materialsForRecord(context.session.document, record);
      disposeMaterials(tracked.material);
      object.material = nextMaterials.length === 1 ? nextMaterials[0]! : nextMaterials;
      tracked.material = object.material;
      tracked.materialKey = materialKey;
    }
    if (context.session.poseLocals.size > 0 && tracked.poseKey !== poseKey) {
      applyCpuSkin(context.session, record, kernel, tracked.geometry, tracked.mapping);
    }
    tracked.poseKey = poseKey;
  }
}
