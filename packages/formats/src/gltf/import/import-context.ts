import type { IdFactory, MaterialId, MeshId, ObjectId, TextureId } from "@modeling-kit/core";
import type { InverseBindMatrix, ModelDocument } from "@modeling-kit/document";
import type { HalfEdgeMesh } from "@modeling-kit/mesh";
import type { Document as GltfDocument, Material as GltfMaterial, Mesh as GltfMesh, Node as GltfNode, Skin as GltfSkin, Texture as GltfTexture } from "@gltf-transform/core";
import type { DiagnosticSink } from "../diagnostics/loss-report";
import type { ExternalResourceResolver, GltfResourceLimits } from "../resources/resource-resolver";
import { DEFAULT_GLTF_RESOURCE_LIMITS } from "../resources/resource-resolver";
import type { GltfWeldMode } from "../conversion/attributes";
import type { PrimitiveSkinWeights } from "./primitive-skin-weights";

export type GltfImportMode = "strict" | "repair";

export interface GltfImportOptions {
  readonly name?: string;
  readonly weldEpsilon?: number;
  readonly weldMode?: GltfWeldMode;
  readonly strict?: boolean;
  readonly mode?: GltfImportMode;
  readonly resourceResolver?: ExternalResourceResolver;
  readonly documentUri?: string;
  readonly rootDir?: string;
  readonly importScenes?: boolean;
  readonly importMaterials?: boolean;
  readonly importTextures?: boolean;
  readonly importSkins?: boolean;
  readonly importAnimations?: boolean;
  readonly preserveUnknownExtensions?: boolean;
  readonly resourceLimits?: Partial<GltfResourceLimits>;
  readonly signal?: AbortSignal;
}

export interface ResolvedGltfImportOptions {
  readonly name: string;
  readonly weldEpsilon: number;
  readonly weldMode: GltfWeldMode;
  readonly mode: GltfImportMode;
  readonly importScenes: boolean;
  readonly importMaterials: boolean;
  readonly importTextures: boolean;
  readonly importSkins: boolean;
  readonly importAnimations: boolean;
  readonly preserveUnknownExtensions: boolean;
  readonly limits: GltfResourceLimits;
  readonly resourceResolver?: ExternalResourceResolver;
  readonly documentUri?: string;
  readonly rootDir?: string;
  readonly signal?: AbortSignal;
}

export function resolveImportOptions(options: GltfImportOptions): ResolvedGltfImportOptions {
  const mode: GltfImportMode = options.mode ?? (options.strict === false ? "repair" : "strict");
  return {
    name: options.name ?? "glTF Import",
    weldEpsilon: options.weldEpsilon ?? 1e-5,
    weldMode: options.weldMode ?? "position",
    mode,
    importScenes: options.importScenes !== false,
    importMaterials: options.importMaterials !== false,
    importTextures: options.importTextures !== false,
    importSkins: options.importSkins !== false,
    importAnimations: options.importAnimations !== false,
    preserveUnknownExtensions: options.preserveUnknownExtensions !== false,
    limits: { ...DEFAULT_GLTF_RESOURCE_LIMITS, ...options.resourceLimits },
    ...(options.resourceResolver ? { resourceResolver: options.resourceResolver } : {}),
    ...(options.documentUri ? { documentUri: options.documentUri } : {}),
    ...(options.rootDir ? { rootDir: options.rootDir } : {}),
    ...(options.signal ? { signal: options.signal } : {}),
  };
}

export interface GltfImportContext {
  readonly ids: IdFactory;
  readonly options: ResolvedGltfImportOptions;
  readonly sink: DiagnosticSink;
  readonly source: GltfDocument;
  readonly document: ModelDocument;
  readonly meshes: Map<MeshId, HalfEdgeMesh>;
  readonly meshByGltf: Map<GltfMesh, MeshId>;
  readonly materialByGltf: Map<GltfMaterial, MaterialId>;
  readonly textureByGltf: Map<GltfTexture, TextureId>;
  readonly objectByNode: Map<GltfNode, ObjectId>;
  readonly boneByNode: Map<GltfNode, string>;
  readonly skeletonBySkin: Map<GltfSkin, string>;
  readonly jointIndexBySkin: Map<string, readonly string[]>;
  readonly ibmBySkeleton: Map<string, InverseBindMatrix[]>;
  readonly meshSkinWeights: Map<MeshId, PrimitiveSkinWeights>;
}

export function isStrict(context: GltfImportContext): boolean {
  return context.options.mode === "strict";
}
