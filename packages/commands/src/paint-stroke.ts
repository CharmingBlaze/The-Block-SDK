import type { TextureId } from "@modeling-kit/core";
import type { Command, CommandContext } from "@modeling-kit/history";
import { applyTextureTilePatches, type TextureTilePatch } from "@modeling-kit/paint";

export interface PaintStrokeParams {
  readonly textureId: TextureId;
  readonly patches?: readonly TextureTilePatch[];
  readonly before?: Uint8ClampedArray;
  readonly after?: Uint8ClampedArray;
}

export class PaintStrokeCommand implements Command<void> {
  readonly id = crypto.randomUUID();
  readonly label = "Paint Stroke";

  constructor(readonly params: PaintStrokeParams) {}

  execute(context: CommandContext): void {
    this.apply(context, true);
  }

  undo(context: CommandContext): void {
    this.apply(context, false);
  }

  redo(context: CommandContext): void {
    this.execute(context);
  }

  private apply(context: CommandContext, forward: boolean): void {
    const buffer = context.textures.get(this.params.textureId);
    if (!buffer) {
      throw new RangeError("PaintStrokeCommand could not resolve a texture buffer");
    }
    if (this.params.patches && this.params.patches.length > 0) {
      applyTextureTilePatches(buffer, this.params.patches, forward);
    } else {
      const pixels = forward ? this.params.after : this.params.before;
      if (!pixels) {
        throw new RangeError("PaintStrokeCommand is missing pixel data");
      }
      buffer.data.set(pixels);
    }
    context.events.emit("document:changed", {
      aspect: "texture",
      kind: "positions",
      entityIds: [this.params.textureId],
    });
  }
}

export function snapshotTexturePixels(buffer: { data: Uint8ClampedArray }): Uint8ClampedArray {
  return new Uint8ClampedArray(buffer.data);
}
