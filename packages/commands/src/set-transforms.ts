import type { ObjectId } from "@modeling-kit/core";
import type { Command, CommandContext } from "@modeling-kit/history";
import { setLocalTransform } from "@modeling-kit/scene";
import {
  cloneTransform,
  type ObjectTransformPatch,
  type VertexPositionPatch,
} from "@modeling-kit/transform";

export interface SetTransformsParams {
  readonly objects?: readonly ObjectTransformPatch[];
  readonly vertices?: readonly VertexPositionPatch[];
}

export class SetTransformsCommand implements Command<void> {
  readonly id = crypto.randomUUID();
  readonly label = "Transform";

  constructor(readonly params: SetTransformsParams) {}

  execute(context: CommandContext): void {
    this.apply(context, "after");
  }

  undo(context: CommandContext): void {
    this.apply(context, "before");
  }

  redo(context: CommandContext): void {
    this.execute(context);
  }

  private apply(context: CommandContext, side: "before" | "after"): void {
    const objectIds: ObjectId[] = [];
    for (const patch of this.params.objects ?? []) {
      setLocalTransform(context.document, patch.objectId, cloneTransform(patch[side]));
      objectIds.push(patch.objectId);
    }
    const meshIds = new Set<string>();
    for (const patch of this.params.vertices ?? []) {
      const mesh = context.meshes.get(patch.meshId);
      const vertex = mesh?.vertices.get(patch.vertexId);
      if (mesh && vertex) {
        const value = patch[side];
        vertex.position = [value[0], value[1], value[2]];
        mesh.bumpPositionsRevision();
        context.syncMesh(patch.meshId);
        meshIds.add(patch.meshId);
      }
    }
    if (objectIds.length > 0) {
      context.events.emit("document:changed", { aspect: "scene", kind: "transform", objectIds });
    }
    if (meshIds.size > 0) {
      context.events.emit("mesh:changed", { meshIds: [...meshIds], kind: "positions" });
    }
  }
}
