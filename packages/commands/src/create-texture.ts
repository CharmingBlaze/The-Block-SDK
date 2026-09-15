import type { TextureId } from "@modeling-kit/core";
import { createTextureData, type TextureData } from "@modeling-kit/document";
import type { Command, CommandContext } from "@modeling-kit/history";
import { TextureBuffer } from "@modeling-kit/paint";

export interface CreateTextureParams {
  readonly name?: string;
  readonly width?: number;
  readonly height?: number;
}

export class CreateTextureCommand implements Command<TextureId> {
  readonly id = crypto.randomUUID();
  readonly label = "Create Texture";
  private texture: TextureData | null = null;
  private width = 16;
  private height = 16;

  constructor(readonly params: CreateTextureParams = {}) {}

  execute(context: CommandContext): TextureId {
    if (this.texture) {
      context.document.textures.set(this.texture);
      if (!context.textures.has(this.texture.id)) {
        context.textures.set(this.texture.id, TextureBuffer.create(this.width, this.height));
      }
      context.events.emit("document:changed", { aspect: "texture", entityIds: [this.texture.id] });
      return this.texture.id;
    }
    this.width = this.params.width ?? 16;
    this.height = this.params.height ?? 16;
    const created = createTextureData(context.ids.texture(), this.params.name ?? "Texture", {
      name: this.params.name ?? "Texture",
      width: this.width,
      height: this.height,
    });
    this.texture = created;
    context.document.textures.set(created);
    context.textures.set(created.id, TextureBuffer.create(this.width, this.height));
    context.events.emit("document:changed", { aspect: "texture", entityIds: [created.id] });
    return created.id;
  }

  undo(context: CommandContext): void {
    if (!this.texture) {
      return;
    }
    context.document.textures.delete(this.texture.id);
    context.textures.delete(this.texture.id);
    context.events.emit("document:changed", { aspect: "texture", entityIds: [this.texture.id] });
  }

  redo(context: CommandContext): TextureId {
    return this.execute(context);
  }
}
