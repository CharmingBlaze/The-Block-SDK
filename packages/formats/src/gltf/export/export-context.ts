import type {
  Document as GltfDocument,
  Material as GltfMaterial,
  Mesh as GltfMesh,
  Node as GltfNode,
  Texture as GltfTexture,
} from "@gltf-transform/core";
import type { ObjectId } from "@modeling-kit/core";
import type { ModelDocument } from "@modeling-kit/document";
import type { HalfEdgeMesh } from "@modeling-kit/mesh";
import type { DiagnosticSink } from "../diagnostics/loss-report";

export interface GltfExportOptions {
  readonly format?: "gltf" | "glb";
  readonly resourceMode?: "embedded" | "external";
  readonly exportMaterials?: boolean;
  readonly exportTextures?: boolean;
  readonly exportSkins?: boolean;
  readonly exportAnimations?: boolean;
  readonly validate?: boolean;
  readonly copyright?: string;
  readonly generator?: string;
  readonly signal?: AbortSignal;
}

export interface ResolvedGltfExportOptions {
  readonly format: "gltf" | "glb";
  readonly resourceMode: "embedded" | "external";
  readonly exportMaterials: boolean;
  readonly exportTextures: boolean;
  readonly exportSkins: boolean;
  readonly exportAnimations: boolean;
  readonly generator: string;
  readonly copyright?: string;
  readonly signal?: AbortSignal;
}

export function resolveExportOptions(options: GltfExportOptions): ResolvedGltfExportOptions {
  return {
    format: options.format ?? "gltf",
    resourceMode: options.resourceMode ?? "embedded",
    exportMaterials: options.exportMaterials !== false,
    exportTextures: options.exportTextures !== false,
    exportSkins: options.exportSkins !== false,
    exportAnimations: options.exportAnimations !== false,
    generator: options.generator ?? "@modeling-kit/formats glTF Exporter",
    ...(options.copyright ? { copyright: options.copyright } : {}),
    ...(options.signal ? { signal: options.signal } : {}),
  };
}

export interface GltfExportContext {
  readonly document: ModelDocument;
  readonly meshes: ReadonlyMap<string, HalfEdgeMesh>;
  readonly options: ResolvedGltfExportOptions;
  readonly sink: DiagnosticSink;
  readonly target: GltfDocument;
  readonly nodeByObject: Map<ObjectId, GltfNode>;
  readonly meshById: Map<string, GltfMesh>;
  readonly materialById: Map<string, GltfMaterial>;
  readonly textureById: Map<string, GltfTexture>;
  readonly jointNodeByBone: Map<string, GltfNode>;
  /** Stable glTF `skin.joints` order keyed by skeleton id. */
  readonly jointOrderBySkeleton: Map<string, readonly string[]>;
}
