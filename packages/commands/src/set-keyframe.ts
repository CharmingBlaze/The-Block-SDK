import type { AnimationId } from "@modeling-kit/core";
import type {
  AnimationChannel,
  AnimationClipData,
  AnimationInterpolation,
  AnimationKeyframe,
  AnimationTargetKind,
} from "@modeling-kit/document";
import type { Command, CommandContext } from "@modeling-kit/history";

export interface SetKeyframeParams {
  readonly clipId: AnimationId;
  readonly targetKind: AnimationTargetKind;
  readonly targetId: string;
  readonly channel: AnimationChannel;
  readonly time: number;
  readonly value: readonly number[];
  readonly interpolation?: AnimationInterpolation;
}

export class SetKeyframeCommand implements Command<void> {
  readonly id = crypto.randomUUID();
  readonly label = "Set Keyframe";
  private before: AnimationClipData | null = null;
  private after: AnimationClipData | null = null;

  constructor(readonly params: SetKeyframeParams) {}

  execute(context: CommandContext): void {
    const clip = context.document.animations.get(this.params.clipId);
    if (!clip) {
      throw new RangeError("SetKeyframeCommand could not resolve a clip");
    }
    if (this.after) {
      context.document.animations.set(this.after);
      return;
    }
    this.before = clip;
    const key: AnimationKeyframe = { time: this.params.time, value: this.params.value };
    const interpolation = this.params.interpolation ?? "linear";
    const tracks = [...clip.tracks];
    const index = tracks.findIndex(
      (track) =>
        track.targetKind === this.params.targetKind &&
        track.targetId === this.params.targetId &&
        track.channel === this.params.channel,
    );
    if (index >= 0) {
      const track = tracks[index]!;
      const keys = track.keys.filter((item) => item.time !== key.time);
      keys.push(key);
      keys.sort((a, b) => a.time - b.time);
      tracks[index] = { ...track, keys, interpolation };
    } else {
      tracks.push({
        id: `track-${tracks.length}`,
        targetKind: this.params.targetKind,
        targetId: this.params.targetId,
        channel: this.params.channel,
        interpolation,
        keys: [key],
      });
    }
    this.after = { ...clip, tracks };
    context.document.animations.set(this.after);
    context.events.emit("document:changed", { aspect: "animation", entityIds: [clip.id] });
  }

  undo(context: CommandContext): void {
    if (!this.before) {
      return;
    }
    context.document.animations.set(this.before);
    context.events.emit("document:changed", { aspect: "animation", entityIds: [this.before.id] });
  }

  redo(context: CommandContext): void {
    this.execute(context);
  }
}
