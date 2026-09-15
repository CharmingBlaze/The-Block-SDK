import type { ObjectId } from "@modeling-kit/core";
import type { Command, CommandContext } from "@modeling-kit/history";
import { getNode, setNodeVisible } from "@modeling-kit/scene";

export interface SetVisibilityParams {
  readonly visible: boolean;
  readonly objectId?: ObjectId;
  readonly objectIds?: readonly ObjectId[];
}

export class SetVisibilityCommand implements Command<void> {
  readonly id = crypto.randomUUID();
  readonly label: string;
  private previous: Array<{ objectId: ObjectId; visible: boolean }> = [];

  constructor(readonly params: SetVisibilityParams) {
    this.label = params.visible ? "Show" : "Hide";
  }

  execute(context: CommandContext): void {
    const ids = this.params.objectIds ?? (this.params.objectId ? [this.params.objectId] : context.selection.objectIds);
    if (ids.length === 0) {
      throw new RangeError("SetVisibilityCommand requires an object selection");
    }
    if (this.previous.length === 0) {
      this.previous = ids.map((objectId) => ({
        objectId,
        visible: getNode(context.document, objectId).visible,
      }));
    }
    for (const objectId of ids) {
      setNodeVisible(context.document, objectId, this.params.visible);
    }
    context.events.emit("document:changed", { aspect: "scene", kind: "visibility", objectIds: ids });
  }

  undo(context: CommandContext): void {
    for (const item of this.previous) {
      setNodeVisible(context.document, item.objectId, item.visible);
    }
    context.events.emit("document:changed", {
      aspect: "scene",
      kind: "visibility",
      objectIds: this.previous.map((item) => item.objectId),
    });
  }

  redo(context: CommandContext): void {
    this.execute(context);
  }
}
