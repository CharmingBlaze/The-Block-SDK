import {
  brand,
  type AnimationId,
  type BoneId,
  type CornerId,
  type DocumentId,
  type EdgeId,
  type FaceId,
  type HalfEdgeId,
  type ImageDocumentId,
  type MeshId,
  type NodeId,
  type ObjectId,
  type MaterialId,
  type MaterialInstanceId,
  type MaterialSlotId,
  type SkeletonId,
  type TextureId,
  type TextureAssetId,
  type TextureSetId,
  type SamplerId,
  type UVChannelId,
  type LayerId,
  type JobId,
  type StrokeId,
  type VertexId,
} from "./brand";

export interface IdFactory {
  document(): DocumentId;
  object(): ObjectId;
  node(): NodeId;
  imageDocument(): ImageDocumentId;
  mesh(): MeshId;
  vertex(): VertexId;
  edge(): EdgeId;
  halfEdge(): HalfEdgeId;
  face(): FaceId;
  corner(): CornerId;
  material(): MaterialId;
  materialInstance(): MaterialInstanceId;
  materialSlot(): MaterialSlotId;
  texture(): TextureId;
  textureAsset(): TextureAssetId;
  textureSet(): TextureSetId;
  sampler(): SamplerId;
  uvChannel(): UVChannelId;
  layer(): LayerId;
  job(): JobId;
  stroke(): StrokeId;
  bone(): BoneId;
  skeleton(): SkeletonId;
  animation(): AnimationId;
}

export function createIdFactory(random: () => string = defaultRandom): IdFactory {
  return {
    document: () => brand(random()),
    object: () => brand(random()),
    node: () => brand(random()),
    imageDocument: () => brand(random()),
    mesh: () => brand(random()),
    vertex: () => brand(random()),
    edge: () => brand(random()),
    halfEdge: () => brand(random()),
    face: () => brand(random()),
    corner: () => brand(random()),
    material: () => brand(random()),
    materialInstance: () => brand(random()),
    materialSlot: () => brand(random()),
    texture: () => brand(random()),
    textureAsset: () => brand(random()),
    textureSet: () => brand(random()),
    sampler: () => brand(random()),
    uvChannel: () => brand(random()),
    layer: () => brand(random()),
    job: () => brand(random()),
    stroke: () => brand(random()),
    bone: () => brand(random()),
    skeleton: () => brand(random()),
    animation: () => brand(random()),
  };
}

export function createSequenceIdFactory(prefix = "id"): IdFactory {
  let n = 0;
  const next = (): string => `${prefix}-${++n}`;
  return createIdFactory(next);
}

function defaultRandom(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  throw new Error("crypto.randomUUID is required to generate IDs");
}
