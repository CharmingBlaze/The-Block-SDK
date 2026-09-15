import type { ObjectId } from "@modeling-kit/core";
import type { TransformData } from "@modeling-kit/math";
import type { Command, CommandContext } from "@modeling-kit/history";
import { getNode, groupNodes, removeNode, reparent, setLocalTransform } from "@modeling-kit/scene";
import { selectionRoots } from "@modeling-kit/transform";

export interface GroupObjectsParams {
  readonly name?: string;
  readonly objectIds?: readonly ObjectId[];
}

export interface GroupObjectsResult {
  readonly groupId: ObjectId;
}

interface MemberRestore {
  readonly objectId: ObjectId;
  readonly parentId: ObjectId;
  readonly index: number;
  readonly localTransform: TransformData;
}

function cloneTransform(transform: TransformData): TransformData {
  return {
    position: { ...transform.position },
    rotation: { ...transform.rotation },
    scale: { ...transform.scale },
  };
}

export class GroupObjectsCommand implements Command<GroupObjectsResult> {
  readonly id = crypto.randomUUID();
  readonly label = "Group";
  private result: GroupObjectsResult | null = null;
  private members: MemberRestore[] = [];

  constructor(readonly params: GroupObjectsParams = {}) {}

  execute(context: CommandContext): GroupObjectsResult {
    if (this.result) {
      this.applyForward(context);
      return this.result;
    }
    const requested = this.params.objectIds ?? context.selection.objectIds;
    const roots = selectionRoots(context.document, requested);
    if (roots.length === 0) {
      throw new RangeError("GroupObjectsCommand requires an object selection");
    }
    this.members = roots.map((objectId) => {
      const node = getNode(context.document, objectId);
      const parentId = node.parentId;
      if (!parentId) {
        throw new RangeError("Cannot group the scene root");
      }
      return {
        objectId,
        parentId,
        index: getNode(context.document, parentId).childIds.indexOf(objectId),
        localTransform: cloneTransform(node.localTransform),
      };
    });
    const groupId = context.ids.object();
    groupNodes(context.document, roots, groupId, this.params.name ?? "Group");
    this.result = { groupId };
    context.events.emit("document:changed", { aspect: "scene", objectIds: [groupId] });
    return this.result;
  }

  undo(context: CommandContext): void {
    if (!this.result) {
      return;
    }
    for (let i = this.members.length - 1; i >= 0; i--) {
      const member = this.members[i]!;
      reparent(context.document, member.objectId, member.parentId, {
        preserveWorld: false,
        index: member.index,
      });
      setLocalTransform(context.document, member.objectId, cloneTransform(member.localTransform));
    }
    removeNode(context.document, this.result.groupId);
    context.events.emit("document:changed", { aspect: "scene", objectIds: [this.result.groupId] });
  }

  redo(context: CommandContext): GroupObjectsResult {
    return this.execute(context);
  }

  private applyForward(context: CommandContext): void {
    const result = this.result!;
    if (!context.document.scene.nodes.has(result.groupId)) {
      groupNodes(
        context.document,
        this.members.map((member) => member.objectId),
        result.groupId,
        this.params.name ?? "Group",
      );
    }
    context.events.emit("document:changed", { aspect: "scene", objectIds: [result.groupId] });
  }
}
