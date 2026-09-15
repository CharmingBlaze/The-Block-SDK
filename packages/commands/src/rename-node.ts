import type { ObjectId } from "@modeling-kit/core";
import type { Command, CommandContext } from "@modeling-kit/history";
import { getNode, renameNode } from "@modeling-kit/scene";

export interface RenameNodeParams {
  readonly name: string;
  readonly objectId?: ObjectId;
}

export class RenameNodeCommand implements Command<void> {
  readonly id = crypto.randomUUID();
  readonly label = "Rename";
  private objectId: ObjectId | null = null;
  private before = "";
  private after = "";

  constructor(readonly params: RenameNodeParams) {}

  execute(context: CommandContext): void {
    if (this.objectId) {
      renameNode(context.document, this.objectId, this.after);
      context.events.emit("document:changed", {
        aspect: "scene",
        kind: "name",
        objectIds: [this.objectId],
      });
      return;
    }
    const objectId = this.params.objectId ?? context.selection.objectIds[0];
    if (!objectId) {
      throw new RangeError("RenameNodeCommand requires an object selection");
    }
    this.objectId = objectId;
    this.before = getNode(context.document, objectId).name;
    this.after = this.params.name;
    renameNode(context.document, objectId, this.after);
    context.events.emit("document:changed", { aspect: "scene", kind: "name", objectIds: [objectId] });
  }

  undo(context: CommandContext): void {
    if (!this.objectId) {
      return;
    }
    renameNode(context.document, this.objectId, this.before);
    context.events.emit("document:changed", {
      aspect: "scene",
      kind: "name",
      objectIds: [this.objectId],
    });
  }

  redo(context: CommandContext): void {
    this.execute(context);
  }
}
