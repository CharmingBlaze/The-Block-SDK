export type {
  Bone,
  BoneWeight,
  MeshSkinningData,
  PoseMap,
  Skeleton,
  VertexSkinWeights,
  WorldPose,
} from "./types";
export { DEFAULT_MAX_BONE_INFLUENCES, WEIGHT_SUM_EPSILON, WEIGHT_ZERO_EPSILON } from "./constants";
export {
  SkeletonBuilder,
  reparentBone,
  skeletonFromData,
  skeletonToData,
  type AddBoneOptions,
} from "./skeleton/skeleton";
export {
  collectRootBoneIds,
  orderBonesStable,
  assertNoParentCycles,
} from "./skeleton/hierarchy";
export {
  assertValidSkeletonData,
  validateSkeletonData,
  validateRestTransform,
  type SkeletonIssue,
} from "./skeleton/validation";
export { restPose, identityLocalPose } from "./skeleton/rest-pose";
export {
  inverseBindEntriesFromSkeleton,
  skinBindingWithRestIbm,
} from "./skeleton/serialization";
export { evaluateWorldPose, evaluateWorldPose as evaluateSkeletonPose } from "./evaluation/world-pose";
export { localPoseOrRest } from "./evaluation/local-pose";
export {
  evaluateSkinMatrices,
  resolveInverseBindMatrix,
  restInverseBindMatrices,
  inverseBindMatchesRest,
} from "./evaluation/skin-matrices";
export { transformToMatrix } from "@modeling-kit/math";
export type { BoneId } from "@modeling-kit/core";
export type { PoseMap as SkeletonPose, WorldPose as EvaluatedPose } from "./types";
export {
  assignNearestBoneWeights,
  assignRigidWeights,
  skinningFromEntries,
} from "./skin/automatic-weights";
export { copyWeights, mirrorWeightBones, remapWeights } from "./skin/remap-weights";
export {
  normalizeWeights,
  normalizeWeightsWithReport,
  type NormalizeWeightsOptions,
  type NormalizeWeightsResult,
} from "./skin/normalize-weights";
export {
  validateInverseBindMatrices,
  validateSkinBinding,
  validateWeightIssues,
  validateWeights,
  type WeightIssue,
} from "./skin/validate-weights";
export { skinPositions, skinPositions as evaluateLinearBlendSkinning } from "./evaluation/skin-positions";
export { skinFromBinding, skinToBinding } from "./skin/skin-binding";
export {
  dilateWeights,
  paintWeights,
  pruneWeights,
  smoothWeights,
  type DilateWeightsOptions,
  type DilateWeightsResult,
  type PaintWeightsOptions,
  type PaintWeightsResult,
  type PruneWeightsOptions,
  type PruneWeightsResult,
  type SmoothWeightsOptions,
  type SmoothWeightsResult,
  type WeightPaintHit,
} from "./skin/paint-weights";
