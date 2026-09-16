import type { BoneId } from "@modeling-kit/core";
import type { AnimationClipData } from "@modeling-kit/document";
import { identityTransform, type TransformData } from "@modeling-kit/math";
import type { PoseMap, Skeleton } from "@modeling-kit/rigging";
import { wrapTime } from "./time";
import { applyChannel } from "./evaluate-track";
import { evaluateVisibility } from "./evaluate-visibility";
import { validateClip } from "../validation/validate-clip";

export interface EvaluatedPose {
  readonly time: number;
  readonly boneLocals: PoseMap;
  readonly objectLocals: ReadonlyMap<string, TransformData>;
  readonly visibility: ReadonlyMap<string, boolean>;
  readonly missingTargets: readonly string[];
}

export function evaluateDocumentClip(
  clip: AnimationClipData,
  time: number,
  skeleton?: Skeleton,
): EvaluatedPose {
  validateClip(clip);
  const wrapped = wrapTime(time, clip.duration, clip.loopMode);
  const boneLocals = new Map<BoneId, TransformData>();
  if (skeleton) {
    for (const bone of skeleton.bones.values()) {
      boneLocals.set(bone.id, bone.restTransform);
    }
  }
  const objectLocals = new Map<string, TransformData>();
  const visibility = new Map<string, boolean>();
  const missingTargets: string[] = [];

  const ensureBone = (id: BoneId): TransformData => {
    const existing = boneLocals.get(id);
    if (existing) {
      return existing;
    }
    missingTargets.push(id);
    const created = identityTransform();
    boneLocals.set(id, created);
    return created;
  };

  for (const track of clip.tracks) {
    if (track.keys.length === 0) {
      continue;
    }
    if (track.channel === "visibility") {
      visibility.set(track.targetId, evaluateVisibility(track.keys, wrapped, track.interpolation));
      continue;
    }
    if (track.targetKind === "bone") {
      if (skeleton && !skeleton.bones.has(track.targetId as BoneId)) {
        missingTargets.push(track.targetId);
      }
      const current = ensureBone(track.targetId as BoneId);
      boneLocals.set(
        track.targetId as BoneId,
        applyChannel(current, track.channel, track.keys, wrapped, track.interpolation),
      );
      continue;
    }
    const current = objectLocals.get(track.targetId) ?? identityTransform();
    objectLocals.set(
      track.targetId,
      applyChannel(current, track.channel, track.keys, wrapped, track.interpolation),
    );
  }
  return { time: wrapped, boneLocals, objectLocals, visibility, missingTargets };
}
