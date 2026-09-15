import {
  CyclicHierarchyError,
  HierarchyError,
  NodeNotFoundError,
  type MeshId,
  type MaterialId,
  type NodeId,
  type SkeletonId,
  type TextureId,
} from "@modeling-kit/core";
import { identityTransform, type TransformData } from "@modeling-kit/math";
import type { ModelDocument, SceneNode, SceneNodeType } from "./types";
import { cloneSceneNode, canonicalizeSceneNodeType, isMeshLikeNode, nodeMeshId, nodeSkeletonId } from "./scene-node";
import { cloneTransform, localFromWorld, normalizeStoredTransform } from "./transforms";
import { getWorldMatrix, worldTransformCache } from "./transform-cache";
import { MAX_HIERARCHY_TRAVERSAL } from "./transform-cache";
import { collectAncestors, collectDescendants, hierarchyIndex } from "./hierarchy-index";
import { recordNodeChange, type ActiveMutation } from "./transaction";

export type ReparentMode = "keep-local-transform" | "preserve-world-transform";
export type ReparentTransformPolicy = "preserve-local" | "preserve-world";
export type RemoveNodePolicy = "recursive" | "preserve-children" | "reject-non-empty";
export type DuplicateMeshPolicy = "link" | "independent";

export interface AddNodeInput {
  readonly name: string;
  readonly type?: SceneNodeType;
  readonly parentId?: NodeId;
  readonly localTransform?: TransformData;
  readonly payloadRef?: string;
  readonly meshId?: MeshId;
  readonly metadata?: Record<string, unknown>;
  readonly tags?: readonly string[];
}

export interface RemoveNodeResult {
  readonly removed: SceneNode[];
}

export interface DuplicateOptions {
  readonly mesh?: DuplicateMeshPolicy;
  readonly nextMeshId?: () => MeshId;
}

export interface DuplicateRemap {
  readonly rootId: NodeId;
  readonly nodeIds: ReadonlyMap<NodeId, NodeId>;
}

export function getNode(document: ModelDocument, id: NodeId): SceneNode {
  const node = document.scene.nodes.get(id);
  if (!node) {
    throw new NodeNotFoundError(id);
  }
  return node;
}

export function getParent(document: ModelDocument, id: NodeId): SceneNode | undefined {
  const parentId = getNode(document, id).parentId;
  return parentId ? getNode(document, parentId) : undefined;
}

export function getChildren(document: ModelDocument, id: NodeId): SceneNode[] {
  return getNode(document, id).childIds.map((childId) => getNode(document, childId));
}

export function getRoots(document: ModelDocument): NodeId[] {
  return [...document.scene.rootIds];
}

export function getAncestors(document: ModelDocument, id: NodeId): NodeId[] {
  return collectAncestors(document, id);
}

export function getDescendants(document: ModelDocument, id: NodeId): NodeId[] {
  return collectDescendants(document, id);
}

export function ancestors(document: ModelDocument, id: NodeId): NodeId[] {
  return getAncestors(document, id);
}

export function descendants(document: ModelDocument, id: NodeId): NodeId[] {
  return getDescendants(document, id);
}

export function isAncestorOf(document: ModelDocument, ancestorId: NodeId, maybeChild: NodeId): boolean {
  return isDescendant(document, ancestorId, maybeChild);
}

export function isDescendant(document: ModelDocument, ancestorId: NodeId, maybeChild: NodeId): boolean {
  return descendants(document, ancestorId).includes(maybeChild);
}

export function syncRootIds(document: ModelDocument): void {
  const root = getNode(document, document.scene.rootNodeId);
  document.scene.rootIds = [...root.childIds];
}

export function addNode(document: ModelDocument, id: NodeId, input: AddNodeInput): SceneNode {
  if (document.scene.nodes.has(id)) {
    throw new HierarchyError("DUPLICATE_ID", `Node id '${id}' already exists`);
  }
  const parentId = input.parentId ?? document.scene.rootNodeId;
  const parent = getNode(document, parentId);
  const transform = normalizeStoredTransform(input.localTransform ?? identityTransform());
  const node: SceneNode = {
    id,
    name: input.name,
    type: canonicalizeSceneNodeType(input.type ?? "empty"),
    parentId,
    childIds: [],
    visible: true,
    locked: false,
    selectable: true,
    localTransform: transform,
    tags: input.tags ? [...input.tags] : [],
    metadata: { ...input.metadata },
    ...(input.payloadRef !== undefined ? { payloadRef: input.payloadRef } : {}),
    ...(input.meshId !== undefined ? { meshId: input.meshId, payloadRef: input.meshId } : {}),
  };
  document.scene.nodes.add(node);
  replaceNode(document, parentId, { childIds: [...parent.childIds, id] });
  syncRootIds(document);
  invalidateAfterHierarchy(document, [id, parentId]);
  recordNodeChange(document, { type: "added", nodeId: id, parentId });
  return getNode(document, id);
}

export function removeNode(
  document: ModelDocument,
  id: NodeId,
  options: { preserveChildren?: boolean; policy?: RemoveNodePolicy; preserveWorld?: boolean } = {},
): SceneNode[] {
  if (id === document.scene.rootNodeId) {
    throw new NodeNotFoundError(id);
  }
  const policy: RemoveNodePolicy =
    options.policy ?? (options.preserveChildren ? "preserve-children" : "recursive");
  const node = getNode(document, id);
  if (policy === "reject-non-empty" && node.childIds.length > 0) {
    throw new HierarchyError("NONEMPTY", `Node '${id}' still has children`);
  }
  const removed: SceneNode[] = [];
  if (policy === "preserve-children") {
    const parentId = node.parentId ?? document.scene.rootNodeId;
    const preserveWorld = options.preserveWorld ?? true;
    for (const childId of [...node.childIds]) {
      reparent(document, childId, parentId, {
        preserveWorld,
        mode: preserveWorld ? "preserve-world-transform" : "keep-local-transform",
      });
    }
  } else {
    for (const childId of [...node.childIds]) {
      removed.push(...removeNode(document, childId, { policy: "recursive" }));
    }
  }
  const parentId = node.parentId;
  if (parentId) {
    const parent = getNode(document, parentId);
    replaceNode(document, parentId, {
      childIds: parent.childIds.filter((child) => child !== id),
    });
  }
  removed.push(cloneSceneNode(getNode(document, id)));
  document.scene.nodes.delete(id);
  syncRootIds(document);
  invalidateAfterHierarchy(document, [id, parentId].filter((value): value is NodeId => value !== null));
  recordNodeChange(document, { type: "removed", nodeId: id, parentId });
  return removed;
}

export function clearSceneChildren(document: ModelDocument): void {
  const root = getNode(document, document.scene.rootNodeId);
  for (const childId of [...root.childIds]) {
    removeNode(document, childId);
  }
}

export function restoreNode(document: ModelDocument, node: SceneNode): SceneNode {
  const copy = cloneSceneNode(node);
  if (document.scene.nodes.has(copy.id)) {
    document.scene.nodes.replace(copy.id, copy);
  } else {
    document.scene.nodes.add(copy);
  }
  if (copy.parentId) {
    const parent = getNode(document, copy.parentId);
    if (!parent.childIds.includes(copy.id)) {
      replaceNode(document, copy.parentId, { childIds: [...parent.childIds, copy.id] });
    }
  }
  syncRootIds(document);
  invalidateAfterHierarchy(document, [copy.id, copy.parentId].filter((value): value is NodeId => Boolean(value)));
  recordNodeChange(document, { type: "added", nodeId: copy.id, parentId: copy.parentId });
  return getNode(document, copy.id);
}

export function reparent(
  document: ModelDocument,
  id: NodeId,
  newParentId: NodeId,
  options: {
    preserveWorld?: boolean;
    mode?: ReparentMode;
    policy?: ReparentTransformPolicy;
    index?: number;
  } = {},
): void {
  if (id === document.scene.rootNodeId) {
    throw new CyclicHierarchyError(id, newParentId);
  }
  const node = getNode(document, id);
  getNode(document, newParentId);
  if (id === newParentId || isDescendant(document, id, newParentId)) {
    throw new CyclicHierarchyError(id, newParentId);
  }
  const policy: ReparentTransformPolicy =
    options.policy ??
    (options.mode === "keep-local-transform"
      ? "preserve-local"
      : options.preserveWorld === false
        ? "preserve-local"
        : "preserve-world");
  let nextLocal = node.localTransform;
  if (policy === "preserve-world") {
    const world = getWorldMatrix(document, id);
    const parentWorld = getWorldMatrix(document, newParentId);
    nextLocal = localFromWorld(parentWorld, world);
  }
  const oldParentId = node.parentId;
  const oldIndex = oldParentId ? getNode(document, oldParentId).childIds.indexOf(id) : -1;
  if (oldParentId) {
    const oldParent = getNode(document, oldParentId);
    replaceNode(document, oldParentId, {
      childIds: oldParent.childIds.filter((child) => child !== id),
    });
  }
  const newParent = getNode(document, newParentId);
  if (newParent.childIds.includes(id)) {
    throw new HierarchyError("DUPLICATE_CHILD", `Parent already contains '${id}'`);
  }
  const childIds = [...newParent.childIds];
  const index = options.index ?? childIds.length;
  if (index < 0 || index > childIds.length) {
    throw new HierarchyError("INVALID_INDEX", `Child index ${index} is out of range`);
  }
  childIds.splice(index, 0, id);
  replaceNode(document, newParentId, { childIds });
  replaceNode(document, id, { parentId: newParentId, localTransform: nextLocal });
  syncRootIds(document);
  invalidateAfterHierarchy(document, [id, oldParentId, newParentId].filter((value): value is NodeId => Boolean(value)));
  recordNodeChange(document, {
    type: "reparent",
    nodeId: id,
    parentId: newParentId,
    previousParentId: oldParentId,
    previousIndex: oldIndex,
    nextIndex: index,
  });
}

export function reorderChildren(
  document: ModelDocument,
  parentId: NodeId,
  childIds: readonly NodeId[],
): void {
  const parent = getNode(document, parentId);
  if (childIds.length !== parent.childIds.length) {
    throw new NodeNotFoundError(parentId);
  }
  const current = new Set(parent.childIds);
  const seen = new Set<string>();
  for (const childId of childIds) {
    if (!current.has(childId) || seen.has(childId)) {
      throw new HierarchyError("DUPLICATE_CHILD", `Invalid reorder for '${childId}'`);
    }
    seen.add(childId);
  }
  replaceNode(document, parentId, { childIds: [...childIds] });
  syncRootIds(document);
  invalidateAfterHierarchy(document, [parentId]);
  recordNodeChange(document, { type: "reorder", nodeId: parentId, parentId });
}

export function reorderNode(document: ModelDocument, id: NodeId, index: number): void {
  const node = getNode(document, id);
  const parentId = node.parentId;
  if (!parentId) {
    throw new HierarchyError("INVALID_ROOT", "Cannot reorder the scene origin");
  }
  const parent = getNode(document, parentId);
  const childIds = parent.childIds.filter((child) => child !== id);
  if (index < 0 || index > childIds.length) {
    throw new HierarchyError("INVALID_INDEX", `Child index ${index} is out of range`);
  }
  childIds.splice(index, 0, id);
  reorderChildren(document, parentId, childIds);
}

export function renameNode(document: ModelDocument, id: NodeId, name: string): void {
  replaceNode(document, id, { name });
  recordNodeChange(document, { type: "changed", nodeId: id, kind: "name" });
}

export function setNodeVisible(document: ModelDocument, id: NodeId, visible: boolean): void {
  replaceNode(document, id, { visible });
  const affected = [id, ...descendants(document, id)];
  const index = hierarchyIndex(document);
  index.bumpFlags(id);
  index.invalidateMany(affected);
  recordNodeChange(document, { type: "changed", nodeId: id, kind: "visibility" });
}

export function setNodeLocked(document: ModelDocument, id: NodeId, locked: boolean): void {
  replaceNode(document, id, { locked });
  const affected = [id, ...descendants(document, id)];
  const index = hierarchyIndex(document);
  index.bumpFlags(id);
  index.invalidateMany(affected);
  recordNodeChange(document, { type: "changed", nodeId: id, kind: "locking" });
}

export function setNodeSelectable(document: ModelDocument, id: NodeId, selectable: boolean): void {
  replaceNode(document, id, { selectable });
  hierarchyIndex(document).bumpFlags(id);
  hierarchyIndex(document).invalidate(id);
  recordNodeChange(document, { type: "changed", nodeId: id, kind: "locking" });
}

export function setVisibility(document: ModelDocument, id: NodeId, visible: boolean): void {
  setNodeVisible(document, id, visible);
}

export function setLocked(document: ModelDocument, id: NodeId, locked: boolean): void {
  setNodeLocked(document, id, locked);
}

export function setSelectable(document: ModelDocument, id: NodeId, selectable: boolean): void {
  setNodeSelectable(document, id, selectable);
}

export function setLocalTransform(
  document: ModelDocument,
  id: NodeId,
  localTransform: TransformData,
): void {
  const normalized = normalizeStoredTransform(localTransform);
  replaceNode(document, id, { localTransform: normalized });
  const cache = worldTransformCache(document);
  cache.bumpLocal(id);
  cache.invalidateSubtree([id, ...descendants(document, id)]);
  recordNodeChange(document, { type: "changed", nodeId: id, kind: "transform" });
}

export function duplicateSubtree(
  document: ModelDocument,
  id: NodeId,
  nextId: () => NodeId,
  options: DuplicateOptions = {},
): NodeId {
  return duplicateHierarchy(document, id, nextId, options).rootId;
}

export function duplicateNode(
  document: ModelDocument,
  id: NodeId,
  nextId: () => NodeId,
  options: DuplicateOptions = {},
): DuplicateRemap {
  return duplicateHierarchy(document, id, nextId, options);
}

export function duplicateHierarchy(
  document: ModelDocument,
  id: NodeId,
  nextId: () => NodeId,
  options: DuplicateOptions = {},
): DuplicateRemap {
  if (id === document.scene.rootNodeId) {
    throw new NodeNotFoundError(id);
  }
  const source = getNode(document, id);
  const parentId = source.parentId ?? document.scene.rootNodeId;
  const remap = new Map<NodeId, NodeId>();
  const walk = (sourceId: NodeId, destParent: NodeId): NodeId => {
    const src = getNode(document, sourceId);
    const destId = nextId();
    remap.set(sourceId, destId);
    const independent = options.mesh === "independent";
    const sourceMeshId = nodeMeshId(src);
    let payloadRef = src.payloadRef;
    let meshId = independent ? undefined : src.meshId;
    if (independent && sourceMeshId && options.nextMeshId) {
      const copyId = options.nextMeshId();
      const record = document.meshes.get(sourceMeshId);
      if (record) {
        document.meshes.set({
          ...record,
          id: copyId,
          name: `${record.name} Copy`,
        });
      }
      payloadRef = copyId;
      meshId = copyId;
    }
    addNode(document, destId, {
      name: src.name,
      type: src.type,
      parentId: destParent,
      localTransform: cloneTransform(src.localTransform),
      ...(payloadRef !== undefined ? { payloadRef } : {}),
      ...(meshId !== undefined ? { meshId } : {}),
      metadata: { ...src.metadata },
      tags: src.tags,
    });
    for (const childId of src.childIds) {
      walk(childId, destId);
    }
    return destId;
  };
  return { rootId: walk(id, parentId), nodeIds: remap };
}

export function groupNodes(
  document: ModelDocument,
  ids: readonly NodeId[],
  groupId: NodeId,
  name = "Group",
): NodeId {
  if (ids.length === 0) {
    throw new NodeNotFoundError("empty-group");
  }
  const first = getNode(document, ids[0]!);
  const parentId = first.parentId ?? document.scene.rootNodeId;
  addNode(document, groupId, { name, type: "group", parentId });
  for (const id of ids) {
    reparent(document, id, groupId, { preserveWorld: true });
  }
  return groupId;
}

export function ungroupNode(document: ModelDocument, groupId: NodeId): void {
  const group = getNode(document, groupId);
  if (group.type !== "group") {
    throw new NodeNotFoundError(groupId);
  }
  const parentId = group.parentId ?? document.scene.rootNodeId;
  for (const childId of [...group.childIds]) {
    reparent(document, childId, parentId, { preserveWorld: true });
  }
  removeNode(document, groupId);
}

export function traverse(document: ModelDocument, visit: (node: SceneNode) => void): void {
  const stack: NodeId[] = [document.scene.rootNodeId];
  const seen = new Set<string>();
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (seen.has(id)) {
      throw new CyclicHierarchyError(id, id);
    }
    seen.add(id);
    const node = getNode(document, id);
    visit(node);
    for (let i = node.childIds.length - 1; i >= 0; i--) {
      stack.push(node.childIds[i]!);
    }
    if (seen.size > MAX_HIERARCHY_TRAVERSAL) {
      throw new CyclicHierarchyError(id, id);
    }
  }
}

export function findByName(document: ModelDocument, name: string): SceneNode[] {
  return [...document.scene.nodes.values()].filter((node) => node.name === name);
}

export function findByType(document: ModelDocument, type: SceneNodeType): SceneNode[] {
  return [...document.scene.nodes.values()].filter((node) => node.type === type);
}

export function findByTag(document: ModelDocument, tag: string): SceneNode[] {
  return [...document.scene.nodes.values()].filter((node) => node.tags.includes(tag));
}

export function effectiveVisibility(document: ModelDocument, id: NodeId): boolean {
  return hierarchyIndex(document).get(document, id).visible;
}

export function effectiveLocked(document: ModelDocument, id: NodeId): boolean {
  return hierarchyIndex(document).get(document, id).locked;
}

export function getEffectiveVisibility(document: ModelDocument, id: NodeId): boolean {
  return effectiveVisibility(document, id);
}

export function getEffectiveLocked(document: ModelDocument, id: NodeId): boolean {
  return effectiveLocked(document, id);
}

export function getEffectiveSelectable(document: ModelDocument, id: NodeId): boolean {
  return hierarchyIndex(document).get(document, id).selectable;
}

export function worldMatrix(document: ModelDocument, id: NodeId) {
  return getWorldMatrix(document, id);
}

export { getWorldTransform } from "./transform-cache";

export interface ResourceUsageIndex {
  meshUsers(meshId: MeshId): ReadonlySet<NodeId>;
  materialUsers(materialId: MaterialId): ReadonlySet<NodeId>;
  textureUsers(textureId: TextureId): ReadonlySet<MaterialId>;
  skeletonUsers(skeletonId: SkeletonId): ReadonlySet<NodeId>;
}

export function buildResourceUsageIndex(document: ModelDocument): ResourceUsageIndex {
  const meshes = new Map<string, Set<NodeId>>();
  const materials = new Map<string, Set<NodeId>>();
  const skeletons = new Map<string, Set<NodeId>>();
  const textures = new Map<string, Set<MaterialId>>();
  for (const node of document.scene.nodes.values()) {
    const meshId = nodeMeshId(node);
    if (meshId) {
      let set = meshes.get(meshId);
      if (!set) {
        set = new Set();
        meshes.set(meshId, set);
      }
      set.add(node.id);
    }
    const skeletonId = nodeSkeletonId(node);
    if (skeletonId) {
      let set = skeletons.get(skeletonId);
      if (!set) {
        set = new Set();
        skeletons.set(skeletonId, set);
      }
      set.add(node.id);
    }
    const mesh = meshId ? document.meshes.get(meshId) : undefined;
    for (const materialId of mesh?.materialIds ?? []) {
      let set = materials.get(materialId);
      if (!set) {
        set = new Set();
        materials.set(materialId, set);
      }
      set.add(node.id);
    }
  }
  for (const material of document.materials.values()) {
    const ids = [
      material.baseColorTexture,
      material.normalTexture,
      material.metallicRoughnessTexture,
      material.emissiveTexture,
      material.occlusionTexture,
    ];
    for (const textureId of ids) {
      if (!textureId) {
        continue;
      }
      let set = textures.get(textureId);
      if (!set) {
        set = new Set();
        textures.set(textureId, set);
      }
      set.add(material.id);
    }
  }
  return {
    meshUsers: (meshId) => meshes.get(meshId) ?? new Set(),
    materialUsers: (materialId) => materials.get(materialId) ?? new Set(),
    textureUsers: (textureId) => textures.get(textureId) ?? new Set(),
    skeletonUsers: (skeletonId) => skeletons.get(skeletonId) ?? new Set(),
  };
}

export function getMeshUsers(document: ModelDocument, meshId: MeshId): ReadonlySet<NodeId> {
  return buildResourceUsageIndex(document).meshUsers(meshId);
}

export function getMaterialUsers(document: ModelDocument, materialId: MaterialId): ReadonlySet<NodeId> {
  return buildResourceUsageIndex(document).materialUsers(materialId);
}

export function findUnusedResources(document: ModelDocument): {
  meshIds: MeshId[];
  materialIds: MaterialId[];
  textureIds: TextureId[];
  skeletonIds: SkeletonId[];
} {
  const usage = buildResourceUsageIndex(document);
  const meshIds = [...document.meshes.values()]
    .map((item) => item.id)
    .filter((id) => usage.meshUsers(id).size === 0);
  const usedMaterials = new Set<string>();
  for (const mesh of document.meshes.values()) {
    for (const materialId of mesh.materialIds) {
      usedMaterials.add(materialId);
    }
  }
  const materialIds = [...document.materials.values()]
    .map((item) => item.id)
    .filter((id) => !usedMaterials.has(id));
  const textureIds = [...document.textures.values()]
    .map((item) => item.id)
    .filter((id) => usage.textureUsers(id).size === 0);
  const skeletonIds = [...document.skeletons.values()]
    .map((item) => item.id)
    .filter((id) => usage.skeletonUsers(id).size === 0);
  return { meshIds, materialIds, textureIds, skeletonIds };
}

export function removeUnusedResources(document: ModelDocument): ReturnType<typeof findUnusedResources> {
  const unused = findUnusedResources(document);
  for (const id of unused.meshIds) {
    document.meshes.delete(id);
  }
  for (const id of unused.materialIds) {
    document.materials.delete(id);
  }
  for (const id of unused.textureIds) {
    document.textures.delete(id);
  }
  for (const id of unused.skeletonIds) {
    document.skeletons.delete(id);
  }
  return unused;
}

export function linkMesh(document: ModelDocument, nodeId: NodeId, meshId: MeshId): void {
  const node = getNode(document, nodeId);
  if (!isMeshLikeNode(node) && node.type !== "empty") {
    replaceNode(document, nodeId, { type: "mesh_instance", meshId, payloadRef: meshId });
  } else {
    replaceNode(document, nodeId, { meshId, payloadRef: meshId });
  }
  recordNodeChange(document, { type: "changed", nodeId, kind: "mesh-reference" });
}

function replaceNode(document: ModelDocument, id: NodeId, patch: Partial<SceneNode>): void {
  const node = getNode(document, id);
  document.scene.nodes.set(id, { ...node, ...patch, id: node.id });
}

function invalidateAfterHierarchy(document: ModelDocument, nodeIds: readonly NodeId[]): void {
  const cache = worldTransformCache(document);
  const index = hierarchyIndex(document);
  const affected = new Set<NodeId>();
  for (const id of nodeIds) {
    if (!document.scene.nodes.has(id)) {
      cache.invalidate(id);
      index.invalidate(id);
      continue;
    }
    affected.add(id);
    for (const descendant of descendants(document, id)) {
      affected.add(descendant);
    }
  }
  cache.invalidateSubtree([...affected]);
  index.invalidateMany([...affected]);
}

export type { ActiveMutation };
