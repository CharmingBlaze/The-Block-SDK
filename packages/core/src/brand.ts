export type Brand<T, Name extends string> = T & { readonly __brand: Name };

export type DocumentId = Brand<string, "DocumentId">;
export type ObjectId = Brand<string, "ObjectId">;
/** Scene-graph identity. Same brand as `ObjectId` so existing APIs remain compatible. */
export type NodeId = ObjectId;
export type ImageDocumentId = Brand<string, "ImageDocumentId">;
export type ViewportId = Brand<string, "ViewportId">;
export type MeshId = Brand<string, "MeshId">;
export type VertexId = Brand<string, "VertexId">;
export type EdgeId = Brand<string, "EdgeId">;
export type HalfEdgeId = Brand<string, "HalfEdgeId">;
export type FaceId = Brand<string, "FaceId">;
export type CornerId = Brand<string, "CornerId">;
export type MaterialId = Brand<string, "MaterialId">;
export type MaterialInstanceId = Brand<string, "MaterialInstanceId">;
export type MaterialSlotId = Brand<string, "MaterialSlotId">;
export type TextureId = Brand<string, "TextureId">;
export type TextureAssetId = Brand<string, "TextureAssetId">;
export type TextureSetId = Brand<string, "TextureSetId">;
export type SamplerId = Brand<string, "SamplerId">;
export type UVChannelId = Brand<string, "UVChannelId">;
export type UVVertexId = Brand<string, "UVVertexId">;
export type UVEdgeId = Brand<string, "UVEdgeId">;
export type UVFaceId = Brand<string, "UVFaceId">;
export type UVIslandId = Brand<string, "UVIslandId">;
export type LayerId = Brand<string, "LayerId">;
export type JobId = Brand<string, "JobId">;
export type StrokeId = Brand<string, "StrokeId">;
export type TileKey = Brand<string, "TileKey">;
export type BoneId = Brand<string, "BoneId">;
export type SkeletonId = Brand<string, "SkeletonId">;
export type AnimationId = Brand<string, "AnimationId">;
export type ToolId = Brand<string, "ToolId">;

export function brand<T extends string, Name extends string>(value: T): Brand<T, Name> {
  return value as Brand<T, Name>;
}

