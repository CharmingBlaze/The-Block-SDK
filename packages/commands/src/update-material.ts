import type { MaterialId } from "@modeling-kit/core";
import { syncMaterialDualFields, type MaterialData } from "@modeling-kit/document";
import type { Command, CommandContext } from "@modeling-kit/history";

export interface UpdateMaterialParams {
  readonly materialId: MaterialId;
  readonly patch: Partial<Omit<MaterialData, "id">>;
}

export class UpdateMaterialCommand implements Command<void> {
  readonly id = crypto.randomUUID();
  readonly label = "Update Material";
  private before: MaterialData | null = null;
  private after: MaterialData | null = null;

  constructor(readonly params: UpdateMaterialParams) {}

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

    const current = context.document.materials.get(this.params.materialId);
    if (!current) {
      throw new RangeError(`UpdateMaterialCommand: material '${this.params.materialId}' not found`);
    }

    this.before = { ...current };
    const updated = syncMaterialDualFields({
      ...current,
      ...this.params.patch,
      id: current.id,
      metadata: {
        ...current.metadata,
        ...(this.params.patch.metadata ?? {}),
      },
    });
    this.after = updated;

    context.document.materials.set(updated);
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
