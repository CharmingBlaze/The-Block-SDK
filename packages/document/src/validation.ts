import { SchemaError, type NodeId, type TextureId } from "@modeling-kit/core";
import { validateTransform } from "./transforms";
import type { ModelDocument, MaterialData } from "./types";
import { sceneNodeExtensions } from "./extension-registry";
import { nodeMeshId, nodeSkeletonId } from "./scene-node";

export interface SceneGraphIssue {
  readonly severity: "info" | "warning" | "error";
  readonly code: string;
  readonly message: string;
  readonly nodeId?: NodeId;
  readonly resourceId?: string;
  readonly repairId?: string;
  readonly path?: string;
}

export type DocumentIssue = SceneGraphIssue;
export interface DocumentValidationResult {
  readonly valid: boolean;
  readonly errors: SceneGraphIssue[];
  readonly warnings: SceneGraphIssue[];
}

export function validateDocument(document: ModelDocument): DocumentValidationResult {
  const errors: SceneGraphIssue[] = [];
  const warnings: SceneGraphIssue[] = [];
  const { nodes, rootNodeId, rootIds } = document.scene;
  const ids = new Set<string>();
  for (const node of nodes.values()) {
    if (ids.has(node.id)) {
      errors.push(issue("error", "DUPLICATE_ID", "Duplicate node id", node.id));
    }
    ids.add(node.id);
  }

  const root = nodes.get(rootNodeId);
  if (!root) {
    errors.push(issue("error", "MISSING_ROOT", "Root node is missing", undefined, "scene.rootNodeId"));
  } else if (root.parentId !== null) {
    errors.push(issue("error", "ROOT_HAS_PARENT", "Root node must have parentId null", root.id));
  }

  if (root && !sameIdList(root.childIds, rootIds)) {
    errors.push(
      issue("error", "ROOT_LIST", "rootIds must match the origin node's childIds", root.id),
    );
  }

  for (const rootId of rootIds) {
    if (!nodes.has(rootId)) {
      errors.push(issue("error", "INVALID_ROOT", `Root entry ${rootId} is missing`, rootId as NodeId));
    }
  }

  for (const node of nodes.values()) {
    const path = `scene.nodes.${node.id}`;
    if (node.parentId === null && node.id !== rootNodeId) {
      errors.push(issue("error", "ORPHAN", "Non-root node has no parent", node.id, path));
    }
    if (node.parentId) {
      const parent = nodes.get(node.parentId);
      if (!parent) {
        errors.push(issue("error", "MISSING_PARENT", "Parent id does not exist", node.id, path));
      } else if (!parent.childIds.includes(node.id)) {
        errors.push(
          issue("error", "CHILD_LIST", "Parent childIds does not include this node", node.id, path),
        );
      }
    }
    const seenChildren = new Set<string>();
    for (const childId of node.childIds) {
      if (seenChildren.has(childId)) {
        errors.push(issue("error", "DUPLICATE_CHILD", `Duplicate child ${childId}`, node.id, path));
      }
      seenChildren.add(childId);
      const child = nodes.get(childId);
      if (!child) {
        errors.push(issue("error", "MISSING_CHILD", `Missing child ${childId}`, node.id, path));
      } else if (child.parentId !== node.id) {
        errors.push(issue("error", "PARENT_MISMATCH", "Child parentId does not match", node.id, path));
      }
    }
    for (const transformIssue of validateTransform(node.localTransform)) {
      errors.push(issue("error", transformIssue.code, transformIssue.message, node.id, path));
    }
    if (node.type === "extension") {
      const extensionType = node.extensionType ?? (typeof node.metadata.extensionType === "string" ? node.metadata.extensionType : undefined);
      if (!extensionType || !sceneNodeExtensions(document).has(extensionType)) {
        errors.push(
          issue("error", "INVALID_EXTENSION", "Extension node is not registered", node.id, path),
        );
      }
    }
    const meshId = nodeMeshId(node);
    if (meshId && !document.meshes.has(meshId)) {
      errors.push(issue("error", "MISSING_MESH", `Missing mesh ${meshId}`, node.id, path, meshId));
    }
    const skeletonId = nodeSkeletonId(node);
    if (skeletonId && !document.skeletons.has(skeletonId)) {
      errors.push(
        issue("error", "MISSING_SKELETON", `Missing skeleton ${skeletonId}`, node.id, path, skeletonId),
      );
    }
  }

  if (root && hasCycle(document, rootNodeId)) {
    errors.push(issue("error", "CYCLE", "Scene graph contains a cycle", undefined, "scene"));
  }

  for (const mesh of document.meshes.values()) {
    for (const materialId of mesh.materialIds) {
      if (!document.materials.has(materialId)) {
        warnings.push(
          issue(
            "warning",
            "MISSING_MATERIAL",
            `Mesh references missing material ${materialId}`,
            undefined,
            `meshes.${mesh.id}`,
            materialId,
          ),
        );
      }
    }
    for (const slot of mesh.materialSlots ?? []) {
      if (slot.target.type === "material" && !document.materials.has(slot.target.materialId)) {
        warnings.push(
          issue(
            "warning",
            "MISSING_MATERIAL",
            `Material slot ${slot.id} references missing material ${slot.target.materialId}`,
            undefined,
            `meshes.${mesh.id}.slots.${slot.id}`,
            slot.target.materialId,
          ),
        );
      }
      if (
        slot.target.type === "material-instance" &&
        !document.materialInstances.has(slot.target.materialInstanceId)
      ) {
        warnings.push(
          issue(
            "warning",
            "MISSING_MATERIAL_INSTANCE",
            `Material slot ${slot.id} references missing instance ${slot.target.materialInstanceId}`,
            undefined,
            `meshes.${mesh.id}.slots.${slot.id}`,
            slot.target.materialInstanceId,
          ),
        );
      }
    }
  }

  for (const instance of document.materialInstances.values()) {
    const parentId = instance.parentMaterialId ?? instance.materialId;
    if (!document.materials.has(parentId)) {
      errors.push(
        issue(
          "error",
          "MISSING_PARENT_MATERIAL",
          `Material instance ${instance.id} references missing parent ${parentId}`,
          undefined,
          `materialInstances.${instance.id}`,
          parentId,
        ),
      );
    }
  }

  for (const material of document.materials.values()) {
    validateMaterialResources(document, material, errors, warnings);
  }

  for (const texture of document.textures.values()) {
    if (texture.usage === "normal" && texture.colorSpace === "srgb") {
      warnings.push(
        issue(
          "warning",
          "NORMAL_MAP_SRGB",
          `Normal map texture ${texture.id} is marked sRGB`,
          undefined,
          `textures.${texture.id}`,
          texture.id,
        ),
      );
    }
    if (texture.usage === "data" && texture.colorSpace === "srgb") {
      warnings.push(
        issue(
          "warning",
          "DATA_MAP_SRGB",
          `Data map texture ${texture.id} is marked sRGB`,
          undefined,
          `textures.${texture.id}`,
          texture.id,
        ),
      );
    }
    if (texture.sourceKind === "image-document") {
      if (!texture.imageDocumentId || !document.images.has(texture.imageDocumentId)) {
        warnings.push(
          issue(
            "warning",
            "MISSING_IMAGE_DOCUMENT",
            `Texture ${texture.id} references a missing image document`,
            undefined,
            `textures.${texture.id}`,
            texture.imageDocumentId,
          ),
        );
      }
    }
  }

  for (const set of document.textureSets.values()) {
    for (const [channel, textureId] of Object.entries(set.channels)) {
      if (textureId && !document.textures.has(textureId)) {
        warnings.push(
          issue(
            "warning",
            "MISSING_TEXTURE_SET_CHANNEL",
            `Texture set ${set.id} channel ${channel} references missing texture ${textureId}`,
            undefined,
            `textureSets.${set.id}.${channel}`,
            textureId,
          ),
        );
      }
    }
  }

  const usedMeshes = new Set<string>();
  for (const node of nodes.values()) {
    const meshId = nodeMeshId(node);
    if (meshId) {
      usedMeshes.add(meshId);
    }
  }
  for (const mesh of document.meshes.values()) {
    if (!usedMeshes.has(mesh.id)) {
      warnings.push(
        issue("warning", "ORPHAN_RESOURCE", `Unused mesh ${mesh.id}`, undefined, `meshes.${mesh.id}`, mesh.id),
      );
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

function validateMaterialResources(
  document: ModelDocument,
  material: MaterialData,
  errors: SceneGraphIssue[],
  warnings: SceneGraphIssue[],
): void {
  const bindings = material.textureBindings ?? {};
  const legacy: Array<[string, TextureId | undefined]> = [
    ["baseColor", material.baseColorTexture],
    ["normal", material.normalTexture],
    ["metallicRoughness", material.metallicRoughnessTexture],
    ["emissive", material.emissiveTexture],
    ["occlusion", material.occlusionTexture],
  ];
  for (const [channel, textureId] of legacy) {
    if (textureId && !document.textures.has(textureId)) {
        warnings.push(
          issue(
            "warning",
            "MISSING_TEXTURE",
            `Material ${material.id} ${channel} texture ${textureId} is missing`,
          undefined,
          `materials.${material.id}.${channel}`,
          textureId,
        ),
      );
    }
  }
  for (const [channel, binding] of Object.entries(bindings)) {
    if (!binding?.textureId) {
      continue;
    }
    if (!document.textures.has(binding.textureId)) {
      warnings.push(
        issue(
          "warning",
          "MISSING_TEXTURE",
          `Material ${material.id} binding ${channel} references missing texture ${binding.textureId}`,
          undefined,
          `materials.${material.id}.textureBindings.${channel}`,
          binding.textureId,
        ),
      );
    }
  }
  if (material.textureSetId && !document.textureSets.has(material.textureSetId)) {
    warnings.push(
      issue(
        "warning",
        "MISSING_TEXTURE_SET",
        `Material ${material.id} references missing texture set ${material.textureSetId}`,
        undefined,
        `materials.${material.id}`,
        material.textureSetId,
      ),
    );
  }
}

function hasCycle(document: ModelDocument, rootId: NodeId): boolean {
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const walk = (id: NodeId): boolean => {
    if (visiting.has(id)) {
      return true;
    }
    if (visited.has(id)) {
      return false;
    }
    visiting.add(id);
    const node = document.scene.nodes.get(id);
    if (node) {
      for (const childId of node.childIds) {
        if (walk(childId)) {
          return true;
        }
      }
    }
    visiting.delete(id);
    visited.add(id);
    return false;
  };
  return walk(rootId);
}

function sameIdList(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  return a.every((value, index) => value === b[index]);
}

function issue(
  severity: SceneGraphIssue["severity"],
  code: string,
  message: string,
  nodeId?: NodeId,
  path?: string,
  resourceId?: string,
): SceneGraphIssue {
  return {
    severity,
    code,
    message,
    ...(nodeId !== undefined ? { nodeId } : {}),
    ...(path !== undefined ? { path } : {}),
    ...(resourceId !== undefined ? { resourceId } : {}),
  };
}

export function assertValidDocument(document: ModelDocument): void {
  const result = validateDocument(document);
  if (!result.valid) {
    throw new SchemaError(result.errors.map((e) => `${e.code}: ${e.message}`).join("; "));
  }
}
