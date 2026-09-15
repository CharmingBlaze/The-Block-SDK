import type { MaterialId, TextureId, TextureSetId } from "@modeling-kit/core";
import {
  createTextureSet,
  materialFromTextureSet,
  type TextureSet,
  type TextureSetChannel,
} from "@modeling-kit/document";
import type { Command, CommandContext } from "@modeling-kit/history";

function emitSet(context: CommandContext, id: TextureSetId): void {
  context.events.emit("document:changed", { aspect: "texture", entityIds: [id] });
}

function withoutTextureSetId(
  material: import("@modeling-kit/document").MaterialData,
): import("@modeling-kit/document").MaterialData {
  const { textureSetId: _removed, ...rest } = material;
  return rest;
}

export interface CreateTextureSetParams {
  readonly name?: string;
  readonly channels?: Partial<Record<TextureSetChannel, TextureId>>;
}

export class CreateTextureSetCommand implements Command<TextureSetId> {
  readonly id = crypto.randomUUID();
  readonly label = "Create Texture Set";
  private set: TextureSet | null = null;

  constructor(readonly params: CreateTextureSetParams = {}) {}

  execute(context: CommandContext): TextureSetId {
    if (this.set) {
      context.document.textureSets.set(this.set);
      emitSet(context, this.set.id);
      return this.set.id;
    }
    const created = createTextureSet(
      context.ids.textureSet(),
      this.params.name ?? "Texture Set",
      this.params.channels ?? {},
    );
    this.set = created;
    context.document.textureSets.set(created);
    emitSet(context, created.id);
    return created.id;
  }

  undo(context: CommandContext): void {
    if (!this.set) {
      return;
    }
    context.document.textureSets.delete(this.set.id);
    emitSet(context, this.set.id);
  }

  redo(context: CommandContext): TextureSetId {
    return this.execute(context);
  }
}

export interface UpdateTextureSetParams {
  readonly textureSetId: TextureSetId;
  readonly name?: string;
  readonly channels?: Partial<Record<TextureSetChannel, TextureId>>;
}

export class UpdateTextureSetCommand implements Command<void> {
  readonly id = crypto.randomUUID();
  readonly label = "Update Texture Set";
  private before: TextureSet | null = null;
  private after: TextureSet | null = null;

  constructor(readonly params: UpdateTextureSetParams) {}

  execute(context: CommandContext): void {
    if (this.after) {
      context.document.textureSets.set(this.after);
      emitSet(context, this.after.id);
      return;
    }
    const current = context.document.textureSets.require(this.params.textureSetId);
    this.before = current;
    const channels = { ...current.channels, ...(this.params.channels ?? {}) };
    this.after = createTextureSet(current.id, this.params.name ?? current.name, channels);
    context.document.textureSets.set(this.after);
    emitSet(context, this.after.id);
  }

  undo(context: CommandContext): void {
    if (!this.before) {
      return;
    }
    context.document.textureSets.set(this.before);
    emitSet(context, this.before.id);
  }

  redo(context: CommandContext): void {
    this.execute(context);
  }
}

export interface BindMaterialTextureSetParams {
  readonly materialId: MaterialId;
  readonly textureSetId: TextureSetId;
}

export class BindMaterialTextureSetCommand implements Command<void> {
  readonly id = crypto.randomUUID();
  readonly label = "Bind Material Texture Set";
  private before: import("@modeling-kit/document").MaterialData | null = null;
  private after: import("@modeling-kit/document").MaterialData | null = null;

  constructor(readonly params: BindMaterialTextureSetParams) {}

  execute(context: CommandContext): void {
    if (this.after) {
      context.document.materials.set(this.after);
      context.events.emit("document:changed", {
        aspect: "material",
        kind: "materials",
        entityIds: [this.params.materialId],
      });
      return;
    }
    const material = context.document.materials.require(this.params.materialId);
    const set = context.document.textureSets.require(this.params.textureSetId);
    this.before = material;
    this.after = materialFromTextureSet(material, set);
    context.document.materials.set(this.after);
    context.events.emit("document:changed", {
      aspect: "material",
      kind: "materials",
      entityIds: [this.params.materialId],
    });
  }

  undo(context: CommandContext): void {
    if (!this.before) {
      return;
    }
    context.document.materials.set(this.before);
    context.events.emit("document:changed", {
      aspect: "material",
      kind: "materials",
      entityIds: [this.params.materialId],
    });
  }

  redo(context: CommandContext): void {
    this.execute(context);
  }
}

export interface DeleteTextureSetParams {
  readonly textureSetId: TextureSetId;
}

export class DeleteTextureSetCommand implements Command<void> {
  readonly id = crypto.randomUUID();
  readonly label = "Delete Texture Set";
  private snapshot: TextureSet | null = null;
  private materialRestores: import("@modeling-kit/document").MaterialData[] = [];

  constructor(readonly params: DeleteTextureSetParams) {}

  execute(context: CommandContext): void {
    const current = this.snapshot ?? context.document.textureSets.get(this.params.textureSetId);
    if (!current) {
      throw new RangeError(`Missing texture set ${this.params.textureSetId}`);
    }
    if (!this.snapshot) {
      this.snapshot = current;
      this.materialRestores = [...context.document.materials.values()].filter(
        (material) => material.textureSetId === current.id,
      );
    }
    for (const material of [...context.document.materials.values()]) {
      if (material.textureSetId !== current.id) {
        continue;
      }
      context.document.materials.set(withoutTextureSetId(material));
    }
    context.document.textureSets.delete(current.id);
    emitSet(context, current.id);
  }

  undo(context: CommandContext): void {
    if (!this.snapshot) {
      return;
    }
    context.document.textureSets.set(this.snapshot);
    for (const material of this.materialRestores) {
      context.document.materials.set(material);
    }
    emitSet(context, this.snapshot.id);
  }

  redo(context: CommandContext): void {
    this.execute(context);
  }
}
