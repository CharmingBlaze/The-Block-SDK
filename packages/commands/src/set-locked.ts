import type { ObjectId } from "@modeling-kit/core";
import type { Command, CommandContext } from "@modeling-kit/history";
import { getNode, setNodeLocked } from "@modeling-kit/document";

export interface SetLockedParams {
  readonly locked: boolean;
  readonly objectId?: ObjectId;
  readonly objectIds?: readonly ObjectId[];
}

export class SetLockedCommand implements Command<void> {
  readonly id = crypto.randomUUID();
  readonly label: string;
  private previous: Array<{ objectId: ObjectId; locked: boolean }> = [];

  constructor(readonly params: SetLockedParams) {
    this.label = params.locked ? "Lock" : "Unlock";
  }

  execute(context: CommandContext): void {
    const ids =
      this.params.objectIds ?? (this.params.objectId ? [this.params.objectId] : context.selection.objectIds);
    if (ids.length === 0) {
      throw new RangeError("SetLockedCommand requires an object selection");
    }
    if (this.previous.length === 0) {
      this.previous = ids.map((objectId) => ({
        objectId,
        locked: getNode(context.document, objectId).locked,
      }));
    }
    for (const objectId of ids) {
      setNodeLocked(context.document, objectId, this.params.locked);
    }
    context.events.emit("document:changed", { aspect: "scene", kind: "locking", objectIds: ids });
  }

  undo(context: CommandContext): void {
    for (const item of this.previous) {
      setNodeLocked(context.document, item.objectId, item.locked);
    }
    context.events.emit("document:changed", {
      aspect: "scene",
      kind: "locking",
      objectIds: this.previous.map((item) => item.objectId),
    });
  }

  redo(context: CommandContext): void {
    this.execute(context);
  }
}
