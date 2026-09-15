import type { ObjectId } from "@modeling-kit/core";
import type { TransformData } from "@modeling-kit/math";
import type { Command, CommandContext } from "@modeling-kit/history";
import {
  addNode,
  getNode,
  reparent,
  setLocalTransform,
  ungroupNode,
} from "@modeling-kit/scene";

export interface UngroupObjectsParams {
  readonly groupId?: ObjectId;
}

interface ChildRestore {
  readonly objectId: ObjectId;
  readonly localTransform: TransformData;
}

export class UngroupObjectsCommand implements Command<void> {
  readonly id = crypto.randomUUID();
  readonly label = "Ungroup";
  private groupId: ObjectId | null = null;
  private groupName = "Group";
  private groupParentId: ObjectId | null = null;
  private groupLocal: TransformData | null = null;
  private children: ChildRestore[] = [];

  constructor(readonly params: UngroupObjectsParams = {}) {}

  execute(context: CommandContext): void {
    if (this.groupId && this.groupLocal && this.groupParentId) {
      ungroupNode(context.document, this.groupId);
      context.events.emit("document:changed", { aspect: "scene", objectIds: [this.groupId] });
      return;
    }
    const groupId = this.params.groupId ?? context.selection.objectIds[0];
    if (!groupId) {
      throw new RangeError("UngroupObjectsCommand requires a group selection");
    }
    if (groupId === context.document.scene.rootNodeId) {
      throw new RangeError("Cannot ungroup the scene root");
    }
    const group = getNode(context.document, groupId);
    if (group.type !== "group") {
      throw new RangeError("UngroupObjectsCommand requires a group node");
    }
    this.groupId = groupId;
    this.groupName = group.name;
    this.groupParentId = group.parentId;
    this.groupLocal = {
      position: { ...group.localTransform.position },
      rotation: { ...group.localTransform.rotation },
      scale: { ...group.localTransform.scale },
    };
    this.children = group.childIds.map((objectId) => {
      const child = getNode(context.document, objectId);
      return {
        objectId,
        localTransform: {
          position: { ...child.localTransform.position },
          rotation: { ...child.localTransform.rotation },
          scale: { ...child.localTransform.scale },
        },
      };
    });
    ungroupNode(context.document, groupId);
    context.events.emit("document:changed", { aspect: "scene", objectIds: [groupId] });
  }

  undo(context: CommandContext): void {
    if (!this.groupId || !this.groupLocal || !this.groupParentId) {
      return;
    }
    addNode(context.document, this.groupId, {
      name: this.groupName,
      type: "group",
      parentId: this.groupParentId,
      localTransform: this.groupLocal,
    });
    for (const child of this.children) {
      reparent(context.document, child.objectId, this.groupId, { preserveWorld: false });
      setLocalTransform(context.document, child.objectId, child.localTransform);
    }
    context.events.emit("document:changed", { aspect: "scene", objectIds: [this.groupId] });
  }

  redo(context: CommandContext): void {
    this.execute(context);
  }
}
