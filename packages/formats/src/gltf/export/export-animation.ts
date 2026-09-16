import type { AnimationClipData } from "@modeling-kit/document";
import { toGltfInterpolation, channelToGltfPath } from "../conversion/interpolation";
import type { GltfExportContext } from "./export-context";

export function exportAnimations(context: GltfExportContext): void {
  if (!context.options.exportAnimations) {
    if (context.document.animations.size > 0) {
      context.sink.loss("metadata-dropped", "Animation clips are not exported");
    }
    return;
  }
  const buffer = context.target.getRoot().listBuffers()[0] ?? context.target.createBuffer();
  for (const clip of context.document.animations.values()) {
    exportClip(context, clip, buffer);
  }
}

function exportClip(
  context: GltfExportContext,
  clip: AnimationClipData,
  buffer: ReturnType<GltfExportContext["target"]["createBuffer"]>,
): void {
  const animation = context.target.createAnimation(clip.name);
  if (clip.markers.length > 0) {
    context.sink.loss("markers-omitted", `Clip '${clip.name}' markers are not represented in standard glTF`, {
      suggestedCorrection: "Store markers in extras or a documented extension",
    });
  }
  for (const track of clip.tracks) {
    if (track.channel === "visibility") {
      context.sink.loss("unsupported-animation-channel", `Visibility track on '${clip.name}' is omitted from standard glTF`);
      continue;
    }
    if (track.interpolation === "cubic") {
      context.sink.loss("unsupported-interpolation", `Canonical cubic track on '${clip.name}' is exported as LINEAR`);
    }
    const targetNode =
      track.targetKind === "bone"
        ? context.jointNodeByBone.get(track.targetId)
        : context.nodeByObject.get(track.targetId as never);
    if (!targetNode) {
      context.sink.loss("unsupported-animation-channel", `Track '${track.id}' target '${track.targetId}' has no glTF node`);
      continue;
    }
    const times = track.keys.map((key) => key.time);
    const values = track.keys.flatMap((key) => [...key.value]);
    const path = channelToGltfPath(track.channel);
    if (!path) {
      continue;
    }
    const input = context.target.createAccessor().setType("SCALAR").setArray(new Float32Array(times)).setBuffer(buffer);
    const output = context.target
      .createAccessor()
      .setType(track.channel === "rotation" ? "VEC4" : "VEC3")
      .setArray(new Float32Array(values))
      .setBuffer(buffer);
    const sampler = context.target
      .createAnimationSampler()
      .setInput(input)
      .setOutput(output)
      .setInterpolation(toGltfInterpolation(track.interpolation));
    const channel = context.target
      .createAnimationChannel()
      .setSampler(sampler)
      .setTargetNode(targetNode)
      .setTargetPath(path);
    animation.addSampler(sampler).addChannel(channel);
  }
}
