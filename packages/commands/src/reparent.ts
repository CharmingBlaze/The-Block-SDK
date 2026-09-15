import type { ObjectId } from "@modeling-kit/core";
import type { TransformData } from "@modeling-kit/math";
import type { Command, CommandContext } from "@modeling-kit/history";
import { getNode, reparent } from "@modeling-kit/scene";
import { selectionRoots } from "@modeling-kit/transform";

export interface ReparentParams {
  readonly newParentId: ObjectId;
  readonly objectId?: ObjectId;
  readonly objectIds?: readonly ObjectId[];
  readonly preserveWorld?: boolean;
  readonly index?: number;
}

interface ReparentRestore {
  readonly objectId: ObjectId;
  readonly parentId: ObjectId;
  readonly index: number;
  readonly localTransform: TransformData;
}

export class ReparentCommand implements Command<void> {
  readonly id = crypto.randomUUID();
  readonly label = "Reparent";
  private restores: ReparentRestore[] = [];

  constructor(readonly params: ReparentParams) {}

  execute(context: CommandContext): void {
    if (this.restores.length > 0) {
      this.applyForward(context);
      return;
    }
    const requested = this.params.objectIds ?? (this.params.objectId ? [this.params.objectId] : context.selection.objectIds);
    const roots = selectionRoots(context.document, requested);
    if (roots.length === 0) {
      throw new RangeError("ReparentCommand requires an object selection");
    }
    this.restores = roots.map((objectId) => {
      const node = getNode(context.document, objectId);
      const parentId = node.parentId;
      if (!parentId) {
        throw new RangeError("Cannot reparent the scene root");
      }
      const parent = getNode(context.document, parentId);
      return {
        objectId,
        parentId,
        index: parent.childIds.indexOf(objectId),
        localTransform: {
          position: { ...node.localTransform.position },
          rotation: { ...node.localTransform.rotation },
          scale: { ...node.localTransform.scale },
        },
      };
    });
    this.applyForward(context);
  }

  undo(context: CommandContext): void {
    for (let i = this.restores.length - 1; i >= 0; i--) {
      const restore = this.restores[i]!;
      reparent(context.document, restore.objectId, restore.parentId, {
        preserveWorld: false,
        index: restore.index,
      });
      const node = getNode(context.document, restore.objectId);
      context.document.scene.nodes.set(restore.objectId, {
        ...node,
        localTransform: restore.localTransform,
      });
    }
    context.events.emit("document:changed", {
      aspect: "scene",
      kind: "hierarchy",
      objectIds: this.restores.map((item) => item.objectId),
    });
  }

  redo(context: CommandContext): void {
    this.execute(context);
  }

  private applyForward(context: CommandContext): void {
    for (const restore of this.restores) {
      reparent(context.document, restore.objectId, this.params.newParentId, {
        preserveWorld: this.params.preserveWorld ?? true,
        ...(this.params.index !== undefined ? { index: this.params.index } : {}),
      });
    }
    context.events.emit("document:changed", {
      aspect: "scene",
      kind: "hierarchy",
      objectIds: this.restores.map((item) => item.objectId),
    });
  }
}
