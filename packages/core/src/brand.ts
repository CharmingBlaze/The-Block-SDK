/**
 * Compile-time branded type utility.
 *
 * Branded types allow nominal typing for string/number primitives — two
 * branded types are incompatible even when their underlying representation
 * is the same. This prevents accidentally passing a `FaceId` where a
 * `VertexId` is expected, catching domain errors at compile time.
 *
 * At runtime, branded values are plain strings/numbers with no overhead.
 *
 * @typeParam T  - The underlying type (typically `string` or `number`).
 * @typeParam Name - A unique string literal identifying the brand.
 *
 * @example
 * ```ts
 * type UserId = Brand<string, "UserId">;
 * type OrderId = Brand<string, "OrderId">;
 *
 * function getUser(id: UserId) { }
 * const orderId = brand<"order-1", "OrderId">("order-1");
 * // getUser(orderId); // TypeScript error: Type '"OrderId"' is not assignable
 * ```
 */
export type Brand<T, Name extends string> = T & { readonly __brand: Name };

// ---------------------------------------------------------------------------
// Document / session identity
// ---------------------------------------------------------------------------

/** Top-level document identifier. */
export type DocumentId = Brand<string, "DocumentId">;
/** Scene-graph object identity. Every transformable entity in the scene. */
export type ObjectId = Brand<string, "ObjectId">;
/** Scene-graph identity. Same brand as `ObjectId` so existing APIs remain compatible. */
export type NodeId = ObjectId;
/** Standalone image document (e.g. texture paint target). */
export type ImageDocumentId = Brand<string, "ImageDocumentId">;
/** Viewport instance identity — one per host viewport. */
export type ViewportId = Brand<string, "ViewportId">;

// ---------------------------------------------------------------------------
// Mesh topology
// ---------------------------------------------------------------------------

/** Half-edge mesh identity. */
export type MeshId = Brand<string, "MeshId">;
/** Mesh vertex identity. */
export type VertexId = Brand<string, "VertexId">;
/** Mesh edge identity. */
export type EdgeId = Brand<string, "EdgeId">;
/** Half-edge identity (directed edge from vertex A → vertex B). */
export type HalfEdgeId = Brand<string, "HalfEdgeId">;
/** Mesh face identity. */
export type FaceId = Brand<string, "FaceId">;
/** Per-corner (per-face-vertex) attribute slot identity. Maps one vertex within one face to UV/normal/color data. */
export type CornerId = Brand<string, "CornerId">;

// ---------------------------------------------------------------------------
// Materials & textures
// ---------------------------------------------------------------------------

/** Material definition identity. */
export type MaterialId = Brand<string, "MaterialId">;
/** Material instance identity (overrides on a specific mesh). */
export type MaterialInstanceId = Brand<string, "MaterialInstanceId">;
/** Material-to-mesh binding slot index identity. */
export type MaterialSlotId = Brand<string, "MaterialSlotId">;
/** Texture identity. */
export type TextureId = Brand<string, "TextureId">;
/** Texture asset (file reference) identity. */
export type TextureAssetId = Brand<string, "TextureAssetId">;
/** Texture set identity (e.g. base color + normal + roughness). */
export type TextureSetId = Brand<string, "TextureSetId">;
/** Texture sampler configuration identity. */
export type SamplerId = Brand<string, "SamplerId">;

// ---------------------------------------------------------------------------
// UV mapping
// ---------------------------------------------------------------------------

/** UV channel identity (e.g. "default", "lightmap"). */
export type UVChannelId = Brand<string, "UVChannelId">;
/** UV editor vertex identity. */
export type UVVertexId = Brand<string, "UVVertexId">;
/** UV editor edge identity. */
export type UVEdgeId = Brand<string, "UVEdgeId">;
/** UV editor face identity. */
export type UVFaceId = Brand<string, "UVFaceId">;
/** UV island (connected component) identity. */
export type UVIslandId = Brand<string, "UVIslandId">;

// ---------------------------------------------------------------------------
// Paint & layers
// ---------------------------------------------------------------------------

/** Paint layer identity. */
export type LayerId = Brand<string, "LayerId">;
/** Brush stroke identity. */
export type StrokeId = Brand<string, "StrokeId">;
/** Texture tile key (row_col). */
export type TileKey = Brand<string, "TileKey">;

// ---------------------------------------------------------------------------
// Rigging & animation
// ---------------------------------------------------------------------------

/** Skeleton bone identity. */
export type BoneId = Brand<string, "BoneId">;
/** Skeleton identity. */
export type SkeletonId = Brand<string, "SkeletonId">;
/** Animation clip identity. */
export type AnimationId = Brand<string, "AnimationId">;

// ---------------------------------------------------------------------------
// Infrastructure
// ---------------------------------------------------------------------------

/** Interactive tool identity. */
export type ToolId = Brand<string, "ToolId">;
/** Background job identity (worker tasks, async operations). */
export type JobId = Brand<string, "JobId">;

/**
 * Lift a plain string into a branded type at compile time. No runtime cost.
 *
 * @param value - The underlying string value.
 * @returns The branded value.
 *
 * @example
 * ```ts
 * const meshId = brand<"mesh-01", "MeshId">("mesh-01");
 * ```
 */
export function brand<T extends string, Name extends string>(value: T): Brand<T, Name> {
  return value as Brand<T, Name>;
}

