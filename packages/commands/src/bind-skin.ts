import type { BoneId, MeshId, SkeletonId } from "@modeling-kit/core";
import type { MeshRecord } from "@modeling-kit/document";
import type { Command, CommandContext } from "@modeling-kit/history";
import {
  assignNearestBoneWeights,
  assignRigidWeights,
  skeletonFromData,
  skinToBinding,
} from "@modeling-kit/rigging";
import { requireSelectedMesh } from "./require-selected-mesh";

export interface BindSkinParams {
  readonly skeletonId: SkeletonId;
  readonly mode?: "rigid" | "nearest";
  readonly boneId?: BoneId;
  readonly maxInfluences?: number;
}

export class BindSkinCommand implements Command<void> {
  readonly id = crypto.randomUUID();
  readonly label = "Bind Skin";
  private meshId: MeshId | null = null;
  private before: MeshRecord | null = null;
  private after: MeshRecord | null = null;

  constructor(readonly params: BindSkinParams) {}

  execute(context: CommandContext): void {
    const { meshId, mesh } = requireSelectedMesh(context);
    const record = context.document.meshes.get(meshId);
    if (!record) {
      throw new RangeError("BindSkinCommand could not resolve a mesh record");
    }
    if (this.after) {
      context.document.meshes.set(this.after);
      return;
    }
    const data = context.document.skeletons.get(this.params.skeletonId);
    if (!data) {
      throw new RangeError("BindSkinCommand could not resolve a skeleton");
    }
    const skeleton = skeletonFromData(data);
    const maxInfluences = this.params.maxInfluences ?? 4;
    const weights =
      this.params.mode === "nearest"
        ? assignNearestBoneWeights(mesh, skeleton, maxInfluences)
        : assignRigidWeights(mesh, this.params.boneId ?? skeleton.rootBoneIds[0]!);
    this.meshId = meshId;
    this.before = record;
    this.after = {
      ...record,
      skin: skinToBinding({
        skeletonId: this.params.skeletonId,
        maxInfluences,
        weights,
      }),
    };
    context.document.meshes.set(this.after);
    context.events.emit("document:changed", { aspect: "mesh", entityIds: [meshId] });
  }

  undo(context: CommandContext): void {
    if (!this.before || !this.meshId) {
      return;
    }
    context.document.meshes.set(this.before);
    context.events.emit("document:changed", { aspect: "mesh", entityIds: [this.meshId] });
  }

  redo(context: CommandContext): void {
    this.execute(context);
  }
}
