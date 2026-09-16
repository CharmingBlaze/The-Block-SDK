import { Document as GltfDocument } from "@gltf-transform/core";
import type { ModelDocument } from "@modeling-kit/document";
import type { HalfEdgeMesh } from "@modeling-kit/mesh";
import { orderBonesStable } from "@modeling-kit/rigging";
import { DiagnosticSink } from "../diagnostics/loss-report";
import { exportMaterial } from "./export-material";
import { exportMesh } from "./export-mesh";
import { exportScene } from "./export-scene";
import { exportSkins } from "./export-skin";
import { exportAnimations } from "./export-animation";
import { exportLights } from "./export-lights";
import { exportCameras } from "./export-camera";
import { exportMetadata } from "./export-metadata";
import { resolveExportOptions, type GltfExportContext, type GltfExportOptions } from "./export-context";
import { throwIfAborted } from "../../cancel";
import { validateExport } from "../validation/validate-export";

export function buildGltfDocument(
  document: ModelDocument,
  meshes: ReadonlyMap<string, HalfEdgeMesh>,
  options: GltfExportOptions = {},
): GltfExportContext {
  const resolved = resolveExportOptions(options);
  throwIfAborted(resolved.signal, "glTF export");
  const sink = new DiagnosticSink();
  sink.loss(
    "metadata-dropped",
    "Native half-edge topology, history, selection, and branded IDs are not preserved",
  );
  const target = new GltfDocument();
  target.getRoot().getAsset().generator = resolved.generator;
  if (resolved.copyright) {
    target.getRoot().getAsset().copyright = resolved.copyright;
  }
  target.createBuffer();
  const context: GltfExportContext = {
    document,
    meshes,
    options: resolved,
    sink,
    target,
    nodeByObject: new Map(),
    meshById: new Map(),
    materialById: new Map(),
    textureById: new Map(),
    jointNodeByBone: new Map(),
    jointOrderBySkeleton: collectJointOrders(document),
  };
  if (resolved.exportMaterials) {
    for (const material of document.materials.values()) {
      exportMaterial(context, material);
    }
  }
  const referenced = new Set<string>();
  for (const node of document.scene.nodes.values()) {
    if (node.type === "mesh_instance" && node.payloadRef && meshes.has(node.payloadRef)) {
      referenced.add(node.payloadRef);
    }
  }
  if (referenced.size === 0) {
    for (const id of meshes.keys()) {
      referenced.add(id);
    }
  }
  for (const meshId of referenced) {
    const mesh = meshes.get(meshId);
    if (mesh) {
      exportMesh(context, meshId, mesh);
    }
  }
  exportScene(context);
  exportSkins(context);
  exportAnimations(context);
  exportCameras(context);
  exportLights(context);
  exportMetadata(context);
  if (!resolved.exportTextures) {
    const hasTextures = document.textures.size > 0;
    if (hasTextures) {
      sink.loss("metadata-dropped", "Material textures, images, samplers, and texture transforms are not exported");
    }
  }
  validateExport(context);
  return context;
}

function collectJointOrders(document: ModelDocument): Map<string, readonly string[]> {
  const orders = new Map<string, readonly string[]>();
  for (const skeleton of document.skeletons.values()) {
    const records = new Map(skeleton.bones.map((bone) => [bone.id, { parentId: bone.parentId }] as const));
    try {
      orders.set(skeleton.id, orderBonesStable(records));
    } catch {
      orders.set(
        skeleton.id,
        skeleton.bones.map((bone) => bone.id),
      );
    }
  }
  return orders;
}
