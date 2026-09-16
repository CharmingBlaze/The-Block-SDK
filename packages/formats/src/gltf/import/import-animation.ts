import type { Animation as GltfAnimation, Node as GltfNode } from "@gltf-transform/core";
import { createAnimationClipData, type AnimationTrackData } from "@modeling-kit/document";
import { fromGltfInterpolation, approximateCubicSpline, gltfPathToChannel } from "../conversion/interpolation";
import { accessorToNumbers } from "../conversion/accessors";
import { isStrict, type GltfImportContext } from "./import-context";

function targetForNode(
  context: GltfImportContext,
  node: GltfNode | null,
): { targetKind: "bone" | "object"; targetId: string } | undefined {
  if (!node) {
    return undefined;
  }
  const boneId = context.boneByNode.get(node);
  if (boneId) {
    return { targetKind: "bone", targetId: boneId };
  }
  const objectId = context.objectByNode.get(node);
  if (objectId) {
    return { targetKind: "object", targetId: objectId };
  }
  return undefined;
}

export function importAnimations(context: GltfImportContext): void {
  const animations = context.source.getRoot().listAnimations();
  if (animations.length === 0) {
    return;
  }
  if (!context.options.importAnimations) {
    context.sink.loss("metadata-dropped", "glTF animations were not imported");
    return;
  }
  for (const animation of animations) {
    importAnimation(context, animation);
  }
}

export function importAnimation(context: GltfImportContext, animation: GltfAnimation): void {
  const tracks: AnimationTrackData[] = [];
  let duration = 0;
  const seen = new Set<string>();
  for (const [index, gltfChannel] of animation.listChannels().entries()) {
    const sampler = gltfChannel.getSampler();
    const path = gltfChannel.getTargetPath();
    const node = gltfChannel.getTargetNode();
    if (!sampler || !path) {
      context.sink.loss("unsupported-animation-channel", `Animation '${animation.getName()}' channel ${index} is missing a sampler or path`);
      continue;
    }
    if (path === "weights") {
      context.sink.loss("unsupported-animation-channel", `Animation path '${path}' on '${animation.getName()}' is not imported`, {
        suggestedCorrection: "Convert to a supported translation/rotation/scale channel",
      });
      continue;
    }
    const mappedChannel = gltfPathToChannel(path);
    if (!mappedChannel) {
      context.sink.loss("unsupported-animation-channel", `Animation '${animation.getName()}' channel ${index} uses unsupported path '${path}'`);
      continue;
    }
    const target = targetForNode(context, node);
    if (!target) {
      context.sink.loss("unsupported-animation-channel", `Animation '${animation.getName()}' channel ${index} has a missing target`);
      continue;
    }
    const identity = `${target.targetKind}:${target.targetId}:${mappedChannel}`;
    if (seen.has(identity)) {
      context.sink.warn("duplicate-channel", `Duplicate ${path} channel for ${target.targetId}`);
      continue;
    }
    seen.add(identity);
    const times = accessorToNumbers(sampler.getInput());
    let values = accessorToNumbers(sampler.getOutput());
    const interpolation = fromGltfInterpolation(sampler.getInterpolation());
    const components = mappedChannel === "rotation" ? 4 : 3;
    let documentInterpolation: AnimationTrackData["interpolation"] = "linear";
    if (interpolation === "constant") {
      documentInterpolation = "constant";
    } else if (interpolation === "cubicspline") {
      if (isStrict(context)) {
        context.sink.loss("unsupported-interpolation", `CUBICSPLINE on '${animation.getName()}' was rejected in strict mode`, {
          suggestedCorrection: "Re-export as LINEAR or import with mode: 'repair'",
        });
        continue;
      }
      const sampled = approximateCubicSpline(times, values, components);
      values = sampled.values;
      times.length = 0;
      times.push(...sampled.times);
      documentInterpolation = "linear";
      context.sink.loss("unsupported-interpolation", `CUBICSPLINE on '${animation.getName()}' was approximated as LINEAR keys`, {
        suggestedCorrection: "Author LINEAR keys for lossless round-trip",
      });
    }
    const keys = times.map((time, keyIndex) => ({
      time,
      value: values.slice(keyIndex * components, (keyIndex + 1) * components),
    })).filter((key) => key.value.length === components);
    const last = keys[keys.length - 1]?.time ?? 0;
    if (last > duration) {
      duration = last;
    }
    tracks.push({
      id: `${animation.getName()}-${index}`,
      targetKind: target.targetKind,
      targetId: target.targetId,
      channel: mappedChannel,
      interpolation: documentInterpolation,
      keys,
    });
  }
  const clip = createAnimationClipData(context.ids.animation(), animation.getName() || "Clip", {
    duration,
    tracks,
  });
  context.document.animations.set(clip);
}
