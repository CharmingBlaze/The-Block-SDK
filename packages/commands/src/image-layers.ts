import type { ImageDocumentId, LayerId } from "@modeling-kit/core";
import {
  addImageLayer,
  applyTilePatches,
  createGroupLayer,
  createRasterLayer,
  removeImageLayer,
  updateLayerProperties,
  type ImageLayer,
  type PixelTilePatch,
} from "@modeling-kit/document";
import type { Command, CommandContext } from "@modeling-kit/history";

function emitImage(context: CommandContext, imageId: ImageDocumentId): void {
  context.events.emit("document:changed", { aspect: "texture", entityIds: [imageId] });
}

export interface AddImageLayerParams {
  readonly imageDocumentId: ImageDocumentId;
  readonly name?: string;
  readonly kind?: "raster" | "group";
  readonly parentId?: LayerId;
}

export class AddImageLayerCommand implements Command<LayerId> {
  readonly id = crypto.randomUUID();
  readonly label = "Add Image Layer";
  private layerId: LayerId | null = null;

  constructor(readonly params: AddImageLayerParams) {}

  execute(context: CommandContext): LayerId {
    const image = context.document.images.get(this.params.imageDocumentId);
    if (!image) {
      throw new RangeError(`Missing image ${this.params.imageDocumentId}`);
    }
    const layerId = this.layerId ?? context.ids.layer();
    this.layerId = layerId;
    const layer =
      this.params.kind === "group"
        ? createGroupLayer(layerId, this.params.name ?? "Group")
        : createRasterLayer(layerId, this.params.name ?? "Layer");
    context.document.images.set(addImageLayer(image, layer, this.params.parentId ?? null));
    emitImage(context, image.id);
    return layerId;
  }

  undo(context: CommandContext): void {
    if (!this.layerId) {
      return;
    }
    const image = context.document.images.get(this.params.imageDocumentId);
    if (!image) {
      return;
    }
    context.document.images.set(removeImageLayer(image, this.layerId));
    emitImage(context, image.id);
  }

  redo(context: CommandContext): LayerId {
    return this.execute(context);
  }
}

export interface RemoveImageLayerParams {
  readonly imageDocumentId: ImageDocumentId;
  readonly layerId: LayerId;
}

export class RemoveImageLayerCommand implements Command<void> {
  readonly id = crypto.randomUUID();
  readonly label = "Remove Image Layer";
  private snapshot: ImageLayer | null = null;
  private parentId: LayerId | null = null;

  constructor(readonly params: RemoveImageLayerParams) {}

  execute(context: CommandContext): void {
    const image = context.document.images.require(this.params.imageDocumentId);
    const layer = image.layers.find((item) => item.id === this.params.layerId);
    if (!layer) {
      throw new RangeError(`Missing layer ${this.params.layerId}`);
    }
    if (!this.snapshot) {
      this.snapshot = layer;
      this.parentId = layer.parentId;
    }
    context.document.images.set(removeImageLayer(image, this.params.layerId));
    emitImage(context, image.id);
  }

  undo(context: CommandContext): void {
    if (!this.snapshot) {
      return;
    }
    const image = context.document.images.get(this.params.imageDocumentId);
    if (!image) {
      return;
    }
    context.document.images.set(addImageLayer(image, this.snapshot, this.parentId));
    emitImage(context, image.id);
  }

  redo(context: CommandContext): void {
    this.execute(context);
  }
}

export interface UpdateImageLayerParams {
  readonly imageDocumentId: ImageDocumentId;
  readonly layerId: LayerId;
  readonly patch: Partial<Pick<ImageLayer, "name" | "visible" | "opacity" | "blendMode" | "locked" | "alphaLock">>;
}

export class UpdateImageLayerCommand implements Command<void> {
  readonly id = crypto.randomUUID();
  readonly label = "Update Image Layer";
  private before: UpdateImageLayerParams["patch"] | null = null;

  constructor(readonly params: UpdateImageLayerParams) {}

  execute(context: CommandContext): void {
    const image = context.document.images.require(this.params.imageDocumentId);
    const layer = image.layers.find((item) => item.id === this.params.layerId);
    if (!layer) {
      throw new RangeError(`Missing layer ${this.params.layerId}`);
    }
    if (!this.before) {
      this.before = {
        name: layer.name,
        visible: layer.visible,
        opacity: layer.opacity,
        blendMode: layer.blendMode,
        locked: layer.locked,
        alphaLock: layer.alphaLock,
      };
    }
    context.document.images.set(updateLayerProperties(image, this.params.layerId, this.params.patch));
    emitImage(context, image.id);
  }

  undo(context: CommandContext): void {
    if (!this.before) {
      return;
    }
    const image = context.document.images.get(this.params.imageDocumentId);
    if (!image) {
      return;
    }
    context.document.images.set(updateLayerProperties(image, this.params.layerId, this.before));
    emitImage(context, image.id);
  }

  redo(context: CommandContext): void {
    this.execute(context);
  }
}

export interface ApplyImageTilePatchesParams {
  readonly imageDocumentId: ImageDocumentId;
  readonly patches: readonly PixelTilePatch[];
}

export class ApplyImageTilePatchesCommand implements Command<void> {
  readonly id = crypto.randomUUID();
  readonly label = "Paint Image Tiles";

  constructor(readonly params: ApplyImageTilePatchesParams) {}

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
    const image = context.document.images.get(this.params.imageDocumentId);
    if (!image) {
      throw new RangeError(`Missing image ${this.params.imageDocumentId}`);
    }
    context.document.images.set(applyTilePatches(image, this.params.patches, forward));
    emitImage(context, image.id);
  }
}
