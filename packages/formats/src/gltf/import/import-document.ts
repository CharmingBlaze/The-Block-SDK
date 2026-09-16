import { SchemaError, type IdFactory } from "@modeling-kit/core";
import { createModelDocument } from "@modeling-kit/document";
import type { Document as GltfDocument } from "@gltf-transform/core";
import { DiagnosticSink } from "../diagnostics/loss-report";
import { resolveImportOptions, type GltfImportContext, type GltfImportOptions } from "./import-context";
import { prepareSkinBones, importSkins } from "./import-skin";
import { importScenes } from "./import-scene";
import { importAnimations } from "./import-animation";
import { importCameras } from "./import-camera";
import { importLights } from "./import-lights";
import { importMetadata } from "./import-metadata";
import { importMaterial } from "./import-material";
import { importMesh } from "./import-mesh";
import { validateImport } from "../validation/validate-import";

export function importGltfDocument(
  source: GltfDocument,
  ids: IdFactory,
  options: GltfImportOptions,
): GltfImportContext {
  const resolved = resolveImportOptions(options);
  const sink = new DiagnosticSink();
  sink.loss(
    "metadata-dropped",
    "glTF import welds coincident render vertices; native IDs, history, and selection are not recovered",
  );
  const document = createModelDocument({ ids, name: resolved.name });
  const context: GltfImportContext = {
    ids,
    options: resolved,
    sink,
    source,
    document,
    meshes: new Map(),
    meshByGltf: new Map(),
    materialByGltf: new Map(),
    textureByGltf: new Map(),
    objectByNode: new Map(),
    boneByNode: new Map(),
    skeletonBySkin: new Map(),
    jointIndexBySkin: new Map(),
    ibmBySkeleton: new Map(),
    meshSkinWeights: new Map(),
  };
  const nodeCount = source.getRoot().listNodes().length;
  const primitiveCount = source.getRoot().listMeshes().reduce((sum, mesh) => sum + mesh.listPrimitives().length, 0);
  if (nodeCount > resolved.limits.maxNodeCount || primitiveCount > resolved.limits.maxPrimitiveCount) {
    throw new SchemaError("glTF exceeds configured resource limits");
  }
  if (resolved.importMaterials) {
    for (const material of source.getRoot().listMaterials()) {
      importMaterial(context, material);
    }
  }
  prepareSkinBones(context);
  importSkins(context);
  importScenes(context);
  for (const mesh of source.getRoot().listMeshes()) {
    if (!context.meshByGltf.has(mesh)) {
      importMesh(context, mesh);
    }
  }
  importCameras(context);
  importLights(context);
  importAnimations(context);
  importMetadata(context);
  validateImport(context);
  return context;
}
