export type {
  Bone,
  BoneWeight,
  MeshSkinningData,
  PoseMap,
  Skeleton,
  VertexSkinWeights,
  WorldPose,
} from "./types";
export {
  SkeletonBuilder,
  reparentBone,
  skeletonFromData,
  skeletonToData,
  type AddBoneOptions,
} from "./skeleton";
export {
  evaluateWorldPose,
  evaluateWorldPose as evaluateSkeletonPose,
  identityLocalPose,
  restPose,
} from "./pose";
export { transformToMatrix } from "@modeling-kit/math";
export type { BoneId } from "@modeling-kit/core";
export type { PoseMap as SkeletonPose, WorldPose as EvaluatedPose } from "./types";
export {
  assignNearestBoneWeights,
  assignRigidWeights,
  copyWeights,
  mirrorWeightBones,
  normalizeWeights,
  skinningFromEntries,
  validateWeights,
} from "./weights";
export { skinPositions, skinPositions as evaluateLinearBlendSkinning } from "./skin";
export { skinFromBinding, skinToBinding } from "./binding";
