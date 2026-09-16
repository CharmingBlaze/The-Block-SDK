import type { AnimationClipData } from "@modeling-kit/document";
import type { ThreeSkeletonResources } from "../rigging/create-skeleton";
import {
  AnimationClip,
  InterpolateDiscrete,
  InterpolateLinear,
  QuaternionKeyframeTrack,
  VectorKeyframeTrack,
  type InterpolationModes,
  type KeyframeTrack,
  type Object3D,
} from "three";

function interpolation(value: AnimationClipData["tracks"][number]["interpolation"]): InterpolationModes {
  return value === "constant" ? InterpolateDiscrete : InterpolateLinear;
}

function timesAndValues(track: AnimationClipData["tracks"][number]): { times: number[]; values: number[] } {
  const times: number[] = [];
  const values: number[] = [];
  for (const key of track.keys) {
    times.push(key.time);
    values.push(...key.value);
  }
  return { times, values };
}

function objectName(root: Object3D, objectId: string): string | undefined {
  let found: string | undefined;
  root.traverse((child) => {
    if (child.userData.objectId === objectId || child.name === objectId) {
      found = child.name;
    }
  });
  return found;
}

/**
 * Converts a canonical clip to THREE.AnimationClip. Quaternion tracks stay normalized at key authoring time.
 */
export function createThreeAnimationClip(
  clip: AnimationClipData,
  options: {
    readonly skeleton?: ThreeSkeletonResources;
    readonly root?: Object3D;
  } = {},
): AnimationClip {
  const tracks: KeyframeTrack[] = [];
  for (const track of clip.tracks) {
    if (track.channel === "visibility") {
      continue;
    }
    const { times, values } = timesAndValues(track);
    if (times.length === 0) {
      continue;
    }
    let targetName: string | undefined;
    if (track.targetKind === "bone") {
      targetName = options.skeleton?.boneById.get(track.targetId as never)?.name;
    } else if (options.root) {
      targetName = objectName(options.root, track.targetId);
    } else {
      targetName = track.targetId;
    }
    if (!targetName) {
      continue;
    }
    const path =
      track.channel === "rotation" ? "quaternion" : track.channel === "scale" ? "scale" : "position";
    const name = `${targetName}.${path}`;
    if (track.channel === "rotation") {
      tracks.push(
        new QuaternionKeyframeTrack(name, times, values).setInterpolation(interpolation(track.interpolation)),
      );
    } else {
      tracks.push(
        new VectorKeyframeTrack(name, times, values).setInterpolation(interpolation(track.interpolation)),
      );
    }
  }
  return new AnimationClip(clip.name, clip.duration, tracks);
}
