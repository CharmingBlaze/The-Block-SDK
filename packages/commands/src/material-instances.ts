import type { MaterialId, MaterialInstanceId } from "@modeling-kit/core";
import { createMaterialInstanceData, type MaterialInstance } from "@modeling-kit/document";
import type { Command, CommandContext } from "@modeling-kit/history";

function emitInstance(context: CommandContext, id: MaterialInstanceId): void {
  context.events.emit("document:changed", { aspect: "material", kind: "materials", entityIds: [id] });
}

export interface CreateMaterialInstanceParams {
  readonly materialId: MaterialId;
  readonly name?: string;
  readonly overrides?: Record<string, unknown>;
}

export class CreateMaterialInstanceCommand implements Command<MaterialInstanceId> {
  readonly id = crypto.randomUUID();
  readonly label = "Create Material Instance";
  private instance: MaterialInstance | null = null;

  constructor(readonly params: CreateMaterialInstanceParams) {}

  execute(context: CommandContext): MaterialInstanceId {
    if (this.instance) {
      context.document.materialInstances.set(this.instance);
      emitInstance(context, this.instance.id);
      return this.instance.id;
    }
    if (!context.document.materials.has(this.params.materialId)) {
      throw new RangeError(`Missing material ${this.params.materialId}`);
    }
    const created = createMaterialInstanceData(
      context.ids.materialInstance(),
      this.params.materialId,
      this.params.name ?? "Instance",
      this.params.overrides ?? {},
    );
    this.instance = created;
    context.document.materialInstances.set(created);
    emitInstance(context, created.id);
    return created.id;
  }

  undo(context: CommandContext): void {
    if (!this.instance) {
      return;
    }
    context.document.materialInstances.delete(this.instance.id);
    emitInstance(context, this.instance.id);
  }

  redo(context: CommandContext): MaterialInstanceId {
    return this.execute(context);
  }
}

export interface UpdateMaterialInstanceParams {
  readonly instanceId: MaterialInstanceId;
  readonly name?: string;
  readonly overrides?: Record<string, unknown>;
}

export class UpdateMaterialInstanceCommand implements Command<void> {
  readonly id = crypto.randomUUID();
  readonly label = "Update Material Instance";
  private before: MaterialInstance | null = null;
  private after: MaterialInstance | null = null;

  constructor(readonly params: UpdateMaterialInstanceParams) {}

  execute(context: CommandContext): void {
    if (this.after) {
      context.document.materialInstances.set(this.after);
      emitInstance(context, this.after.id);
      return;
    }
    const current = context.document.materialInstances.require(this.params.instanceId);
    this.before = current;
    this.after = {
      ...current,
      name: this.params.name ?? current.name,
      overrides: this.params.overrides ?? current.overrides,
    };
    context.document.materialInstances.set(this.after);
    emitInstance(context, this.after.id);
  }

  undo(context: CommandContext): void {
    if (!this.before) {
      return;
    }
    context.document.materialInstances.set(this.before);
    emitInstance(context, this.before.id);
  }

  redo(context: CommandContext): void {
    this.execute(context);
  }
}
