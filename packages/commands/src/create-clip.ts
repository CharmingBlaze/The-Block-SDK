import type { AnimationId } from "@modeling-kit/core";
import { createAnimationClipData, type AnimationClipData } from "@modeling-kit/document";
import type { Command, CommandContext } from "@modeling-kit/history";

export interface CreateClipParams {
  readonly name?: string;
  readonly duration?: number;
}

export class CreateClipCommand implements Command<AnimationId> {
  readonly id = crypto.randomUUID();
  readonly label = "Create Clip";
  private clip: AnimationClipData | null = null;

  constructor(readonly params: CreateClipParams = {}) {}

  execute(context: CommandContext): AnimationId {
    if (this.clip) {
      context.document.animations.set(this.clip);
      return this.clip.id;
    }
    const clip = createAnimationClipData(context.ids.animation(), this.params.name ?? "Clip", {
      duration: this.params.duration ?? 1,
    });
    this.clip = clip;
    context.document.animations.set(clip);
    context.events.emit("document:changed", { aspect: "animation", entityIds: [clip.id] });
    return clip.id;
  }

  undo(context: CommandContext): void {
    if (!this.clip) {
      return;
    }
    context.document.animations.delete(this.clip.id);
    context.events.emit("document:changed", { aspect: "animation", entityIds: [this.clip.id] });
  }

  redo(context: CommandContext): AnimationId {
    return this.execute(context);
  }
}
