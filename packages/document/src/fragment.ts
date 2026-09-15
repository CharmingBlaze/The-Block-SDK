import type { IdFactory, MeshId, NodeId } from "@modeling-kit/core";
import type {
  AnimationClipData,
  ImageDocument,
  MaterialData,
  MaterialInstance,
  MeshRecord,
  ModelDocument,
  SceneNode,
  SkeletonData,
  TextureData,
  TextureSet,
} from "./types";
import { cloneSceneNode, nodeMeshId, nodeSkeletonId } from "./scene-node";
import { addNode, getNode } from "./scene-graph";

export interface DocumentFragment {
  rootNodeIds: NodeId[];
  nodes: SceneNode[];
  meshes: MeshRecord[];
  materials: MaterialData[];
  materialInstances: MaterialInstance[];
  textures: TextureData[];
  textureSets: TextureSet[];
  images: ImageDocument[];
  skeletons: SkeletonData[];
  animations: AnimationClipData[];
}

export interface FragmentInsertResult {
  readonly rootNodeIds: NodeId[];
  readonly nodeIds: ReadonlyMap<NodeId, NodeId>;
  readonly meshIds: ReadonlyMap<MeshId, MeshId>;
}

export function extractFragment(document: ModelDocument, rootNodeIds: readonly NodeId[]): DocumentFragment {
  const nodeIds = new Set<NodeId>();
  const stack = [...rootNodeIds];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (nodeIds.has(id)) {
      continue;
    }
    nodeIds.add(id);
    const node = getNode(document, id);
    stack.push(...node.childIds);
  }
  const nodes: SceneNode[] = [];
  for (const id of nodeIds) {
    nodes.push(cloneSceneNode(getNode(document, id)));
  }
  const meshIds = new Set<MeshId>();
  const skeletonIds = new Set<string>();
  for (const node of nodes) {
    const meshId = nodeMeshId(node);
    if (meshId) {
      meshIds.add(meshId);
    }
    const skeletonId = nodeSkeletonId(node);
    if (skeletonId) {
      skeletonIds.add(skeletonId);
    }
  }
  const meshes = [...meshIds].map((id) => document.meshes.require(id));
  const materialIds = new Set(meshes.flatMap((mesh) => [...mesh.materialIds]));
  const materials = [...materialIds]
    .map((id) => document.materials.get(id))
    .filter((item): item is MaterialData => Boolean(item));
  const textureIds = new Set<string>();
  for (const material of materials) {
    for (const id of [
      material.baseColorTexture,
      material.normalTexture,
      material.metallicRoughnessTexture,
      material.emissiveTexture,
      material.occlusionTexture,
    ]) {
      if (id) {
        textureIds.add(id);
      }
    }
    if (material.textureBindings) {
      for (const binding of Object.values(material.textureBindings)) {
        if (binding?.textureId) {
          textureIds.add(binding.textureId);
        }
      }
    }
  }
  const textureSets = [...document.textureSets.values()].filter((set) =>
    set.textureIds.some((id) => textureIds.has(id)),
  );
  const imageIds = new Set(
    [...document.textures.values()]
      .filter((texture) => textureIds.has(texture.id) && texture.imageDocumentId)
      .map((texture) => texture.imageDocumentId!),
  );
  return {
    rootNodeIds: [...rootNodeIds],
    nodes,
    meshes,
    materials,
    materialInstances: [...document.materialInstances.values()].filter((instance) =>
      materials.some((material) => material.id === instance.materialId),
    ),
    textures: [...textureIds]
      .map((id) => document.textures.get(id as TextureData["id"]))
      .filter((item): item is TextureData => Boolean(item)),
    textureSets,
    images: [...imageIds]
      .map((id) => document.images.get(id))
      .filter((item): item is ImageDocument => Boolean(item)),
    skeletons: [...skeletonIds]
      .map((id) => document.skeletons.get(id as SkeletonData["id"]))
      .filter((item): item is SkeletonData => Boolean(item)),
    animations: [],
  };
}

export function insertFragment(
  document: ModelDocument,
  fragment: DocumentFragment,
  parentId: NodeId,
  ids: IdFactory,
  options: { shareResources?: boolean } = {},
): FragmentInsertResult {
  const share = options.shareResources ?? true;
  const meshIds = new Map<MeshId, MeshId>();
  for (const mesh of fragment.meshes) {
    if (share && document.meshes.has(mesh.id)) {
      meshIds.set(mesh.id, mesh.id);
      continue;
    }
    const nextId = ids.mesh();
    meshIds.set(mesh.id, nextId);
    document.meshes.set({ ...mesh, id: nextId });
  }
  for (const material of fragment.materials) {
    if (!document.materials.has(material.id)) {
      document.materials.set(material);
    }
  }
  for (const texture of fragment.textures) {
    if (!document.textures.has(texture.id)) {
      document.textures.set(texture);
    }
  }
  for (const set of fragment.textureSets) {
    if (!document.textureSets.has(set.id)) {
      document.textureSets.set(set);
    }
  }
  for (const image of fragment.images) {
    if (!document.images.has(image.id)) {
      document.images.set(image);
    }
  }
  for (const instance of fragment.materialInstances) {
    if (!document.materialInstances.has(instance.id)) {
      document.materialInstances.set(instance);
    }
  }
  for (const skeleton of fragment.skeletons) {
    if (!document.skeletons.has(skeleton.id)) {
      document.skeletons.set(skeleton);
    }
  }
  const nodeIds = new Map<NodeId, NodeId>();
  for (const node of fragment.nodes) {
    nodeIds.set(node.id, ids.node());
  }
  const sorted = topologicalFragmentNodes(fragment);
  for (const node of sorted) {
    const nextId = nodeIds.get(node.id)!;
    const nextParent =
      node.parentId && nodeIds.has(node.parentId)
        ? nodeIds.get(node.parentId)!
        : parentId;
    const meshId = nodeMeshId(node);
    const remappedMesh = meshId ? meshIds.get(meshId) : undefined;
    addNode(document, nextId, {
      name: node.name,
      type: node.type,
      parentId: nextParent,
      localTransform: node.localTransform,
      tags: node.tags,
      metadata: { ...node.metadata },
      ...(remappedMesh ? { meshId: remappedMesh, payloadRef: remappedMesh } : {}),
    });
  }
  return {
    rootNodeIds: fragment.rootNodeIds.map((id) => nodeIds.get(id)!),
    nodeIds,
    meshIds,
  };
}

function topologicalFragmentNodes(fragment: DocumentFragment): SceneNode[] {
  const byId = new Map(fragment.nodes.map((node) => [node.id, node]));
  const result: SceneNode[] = [];
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const walk = (id: NodeId): void => {
    if (visited.has(id) || !byId.has(id)) {
      return;
    }
    if (visiting.has(id)) {
      return;
    }
    visiting.add(id);
    const node = byId.get(id)!;
    if (node.parentId && byId.has(node.parentId)) {
      walk(node.parentId);
    }
    visiting.delete(id);
    visited.add(id);
    result.push(node);
  };
  for (const id of fragment.rootNodeIds) {
    walk(id);
  }
  for (const node of fragment.nodes) {
    walk(node.id);
  }
  return result;
}

export function cloneFragment(fragment: DocumentFragment): DocumentFragment {
  return {
    rootNodeIds: [...fragment.rootNodeIds],
    nodes: fragment.nodes.map(cloneSceneNode),
    meshes: [...fragment.meshes],
    materials: [...fragment.materials],
    materialInstances: [...fragment.materialInstances],
    textures: [...fragment.textures],
    textureSets: [...fragment.textureSets],
    images: [...fragment.images],
    skeletons: [...fragment.skeletons],
    animations: [...fragment.animations],
  };
}
