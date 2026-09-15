import type { BoneId, SkeletonId, VertexId } from "@modeling-kit/core";
import type { Matrix4, TransformData } from "@modeling-kit/math";

export interface Bone {
  readonly id: BoneId;
  readonly name: string;
  readonly parentId: BoneId | null;
  readonly childIds: readonly BoneId[];
  readonly restTransform: TransformData;
  readonly inverseBindMatrix: Matrix4;
}

export interface Skeleton {
  readonly id: SkeletonId;
  readonly name: string;
  readonly bones: ReadonlyMap<BoneId, Bone>;
  readonly rootBoneIds: readonly BoneId[];
}

export interface BoneWeight {
  readonly boneId: BoneId;
  readonly weight: number;
}

export interface VertexSkinWeights {
  readonly vertexId: VertexId;
  readonly influences: readonly BoneWeight[];
}

export interface MeshSkinningData {
  readonly skeletonId: SkeletonId;
  readonly maxInfluences: number;
  readonly weights: ReadonlyMap<VertexId, readonly BoneWeight[]>;
}

export type PoseMap = ReadonlyMap<BoneId, TransformData>;
export type WorldPose = ReadonlyMap<BoneId, Matrix4>;
