import type { ImageDocumentId } from "@modeling-kit/core";
import { createImageDocument, type ImageDocument } from "@modeling-kit/document";
import type { Command, CommandContext } from "@modeling-kit/history";

export interface CreateImageDocumentParams {
  readonly name?: string;
  readonly width?: number;
  readonly height?: number;
}

export class CreateImageDocumentCommand implements Command<ImageDocumentId> {
  readonly id = crypto.randomUUID();
  readonly label = "Create Image Document";
  private image: ImageDocument | null = null;

  constructor(readonly params: CreateImageDocumentParams = {}) {}

  execute(context: CommandContext): ImageDocumentId {
    if (this.image) {
      context.document.images.set(this.image);
      context.events.emit("document:changed", { aspect: "texture", entityIds: [this.image.id] });
      return this.image.id;
    }
    const created = createImageDocument({
      id: context.ids.imageDocument(),
      name: this.params.name ?? "Image",
      width: this.params.width ?? 64,
      height: this.params.height ?? 64,
      ids: context.ids,
    });
    this.image = created;
    context.document.images.set(created);
    context.events.emit("document:changed", { aspect: "texture", entityIds: [created.id] });
    return created.id;
  }

  undo(context: CommandContext): void {
    if (!this.image) {
      return;
    }
    context.document.images.delete(this.image.id);
    context.events.emit("document:changed", { aspect: "texture", entityIds: [this.image.id] });
  }

  redo(context: CommandContext): ImageDocumentId {
    return this.execute(context);
  }
}
