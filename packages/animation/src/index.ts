export { evaluateDocumentClip, type EvaluatedPose as DocumentEvaluatedPose } from "./evaluation/evaluate-clip";
export { validateClip, validateDocumentClip } from "./validation/validate-clip";
export { validateTrack } from "./validation/validate-track";
export { validateBinding } from "./validation/validate-binding";
export { interpolateNumbers, interpolateHermite } from "./evaluation/interpolation";
export { interpolateRotation } from "./evaluation/evaluate-rotation";
export { interpolateVector, evaluatePosition } from "./evaluation/evaluate-position";
export { evaluateScale } from "./evaluation/evaluate-scale";
export { evaluateVisibility } from "./evaluation/evaluate-visibility";
export { wrapTime } from "./evaluation/time";
export { evaluateTrackValue } from "./evaluation/evaluate-track";
export { AnimationPlayer, reverseClip, scaleClipTime } from "./playback/player";
export { CanonicalClipBuilder } from "./model/clip";
export { keyframe } from "./model/keyframe";
export { marker } from "./model/marker";
export { isLooping, type LoopPolicy } from "./playback/loop-policy";
export { AnimationClipBuilder, evaluateClip, type EvaluatedTransform } from "./compatibility/legacy-clip";
export { findKeyframeIndex, sampleTrack, validateKeyframeTrack } from "./compatibility/sample-legacy";
export {
  animationClipToDocumentClip,
  keyframeTrackToDocumentTrack,
} from "./compatibility/gltf-track";
export type { AnimationClip, AnimationInterpolation, AnimationPath, KeyframeTrack } from "./compatibility/legacy-types";
export { expectedComponentCount, isChannelAllowed, trackIdentityKey } from "./model/binding";
