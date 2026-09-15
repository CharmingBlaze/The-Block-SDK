import type { ObjectId } from "@modeling-kit/core";
import type { Command, CommandContext } from "@modeling-kit/history";
import { getNode, reorderNode } from "@modeling-kit/document";

export interface ReorderNodeParams {
  readonly objectId: ObjectId;
  readonly index: number;
}

export class ReorderNodeCommand implements Command<void> {
  readonly id = crypto.randomUUID();
  readonly label = "Reorder";
  private previousIndex = -1;

  constructor(readonly params: ReorderNodeParams) {}

  execute(context: CommandContext): void {
    const node = getNode(context.document, this.params.objectId);
    const parentId = node.parentId;
    if (!parentId) {
      throw new RangeError("Cannot reorder the scene origin");
    }
    if (this.previousIndex < 0) {
      this.previousIndex = getNode(context.document, parentId).childIds.indexOf(this.params.objectId);
    }
    reorderNode(context.document, this.params.objectId, this.params.index);
    context.events.emit("document:changed", {
      aspect: "scene",
      kind: "hierarchy",
      objectIds: [this.params.objectId],
    });
  }

  undo(context: CommandContext): void {
    reorderNode(context.document, this.params.objectId, this.previousIndex);
    context.events.emit("document:changed", {
      aspect: "scene",
      kind: "hierarchy",
      objectIds: [this.params.objectId],
    });
  }

  redo(context: CommandContext): void {
    this.execute(context);
  }
}
