import { brand, type NodeId } from "@modeling-kit/core";

export type {
  AnimationId,
  DocumentId,
  ImageDocumentId,
  MaterialId,
  MaterialInstanceId,
  MeshId,
  NodeId,
  ObjectId,
  SkeletonId,
  TextureAssetId,
  TextureId,
  ViewportId,
} from "@modeling-kit/core";

export function nodeId(value: string): NodeId {
  return brand(value);
}
