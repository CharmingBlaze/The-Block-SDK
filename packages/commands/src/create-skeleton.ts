import type { BoneId, ObjectId, SkeletonId } from "@modeling-kit/core";
import { createBoneData, createSkeletonData, type BoneData } from "@modeling-kit/document";
import type { Command, CommandContext } from "@modeling-kit/history";
import { identityTransform } from "@modeling-kit/math";
import { addNode, removeNode } from "@modeling-kit/scene";

export interface CreateSkeletonParams {
  readonly name?: string;
  readonly bones?: readonly BoneData[];
}

export interface CreateSkeletonResult {
  readonly skeletonId: SkeletonId;
  readonly armatureObjectId: ObjectId;
  readonly boneObjectIds: Readonly<Record<string, ObjectId>>;
}

interface BoneSceneBinding {
  readonly objectId: ObjectId;
  readonly boneId: BoneId;
  readonly parentObjectId: ObjectId;
}

function bonesInParentOrder(bones: readonly BoneData[]): BoneData[] {
  const byId = new Map(bones.map((bone) => [bone.id, bone]));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const ordered: BoneData[] = [];

  const visit = (bone: BoneData): void => {
    if (visited.has(bone.id)) {
      return;
    }
    if (visiting.has(bone.id)) {
      throw new RangeError(`Cyclic bone parent chain at ${bone.id}`);
    }
    visiting.add(bone.id);
    if (bone.parentId) {
      const parent = byId.get(bone.parentId);
      if (parent) {
        visit(parent);
      }
    }
    visiting.delete(bone.id);
    visited.add(bone.id);
    ordered.push(bone);
  };

  for (const bone of bones) {
    visit(bone);
  }
  return ordered;
}

export class CreateSkeletonCommand implements Command<CreateSkeletonResult> {
  readonly id = crypto.randomUUID();
  readonly label = "Create Skeleton";
  private result: CreateSkeletonResult | null = null;
  private bones: BoneData[] = [];
  private boneBindings: BoneSceneBinding[] = [];

  constructor(readonly params: CreateSkeletonParams = {}) {}

  execute(context: CommandContext): CreateSkeletonResult {
    if (this.result) {
      this.restoreCreated(context);
      return this.result;
    }

    const name = this.params.name ?? "Skeleton";
    const skeletonId = context.ids.skeleton();
    const root = createBoneData(context.ids.bone(), "Root", { restTransform: identityTransform() });
    this.bones = [...(this.params.bones ?? [root])];
    context.document.skeletons.set(createSkeletonData(skeletonId, name, this.bones));

    const armatureObjectId = context.ids.object();
    addNode(context.document, armatureObjectId, {
      name,
      type: "group",
      payloadRef: skeletonId,
      metadata: { role: "armature", skeletonId },
    });

    const boneObjectIds: Record<string, ObjectId> = {};
    const bindings: BoneSceneBinding[] = [];
    for (const bone of bonesInParentOrder(this.bones)) {
      const objectId = context.ids.object();
      const parentObjectId = bone.parentId
        ? (boneObjectIds[bone.parentId] ?? armatureObjectId)
        : armatureObjectId;
      addNode(context.document, objectId, {
        name: bone.name,
        type: "bone",
        parentId: parentObjectId,
        localTransform: bone.restTransform,
        payloadRef: bone.id,
        metadata: { skeletonId, boneId: bone.id },
      });
      boneObjectIds[bone.id] = objectId;
      bindings.push({ objectId, boneId: bone.id, parentObjectId });
    }

    this.boneBindings = bindings;
    this.result = { skeletonId, armatureObjectId, boneObjectIds };
    context.events.emit("document:changed", {
      aspect: "skeleton",
      entityIds: [skeletonId],
      objectIds: [armatureObjectId],
    });
    return this.result;
  }

  undo(context: CommandContext): void {
    if (!this.result) {
      return;
    }
    removeNode(context.document, this.result.armatureObjectId);
    context.document.skeletons.delete(this.result.skeletonId);
    context.events.emit("document:changed", {
      aspect: "skeleton",
      entityIds: [this.result.skeletonId],
      objectIds: [this.result.armatureObjectId],
    });
  }

  redo(context: CommandContext): CreateSkeletonResult {
    return this.execute(context);
  }

  private restoreCreated(context: CommandContext): void {
    const result = this.result!;
    const name = this.params.name ?? "Skeleton";
    if (!context.document.skeletons.has(result.skeletonId)) {
      context.document.skeletons.set(createSkeletonData(result.skeletonId, name, this.bones));
    }
    if (!context.document.scene.nodes.has(result.armatureObjectId)) {
      addNode(context.document, result.armatureObjectId, {
        name,
        type: "group",
        payloadRef: result.skeletonId,
        metadata: { role: "armature", skeletonId: result.skeletonId },
      });
    }
    for (const binding of this.boneBindings) {
      if (context.document.scene.nodes.has(binding.objectId)) {
        continue;
      }
      const bone = this.bones.find((item) => item.id === binding.boneId);
      addNode(context.document, binding.objectId, {
        name: bone?.name ?? "Bone",
        type: "bone",
        parentId: binding.parentObjectId,
        localTransform: bone?.restTransform ?? identityTransform(),
        payloadRef: binding.boneId,
        metadata: { skeletonId: result.skeletonId, boneId: binding.boneId },
      });
    }
    context.events.emit("document:changed", {
      aspect: "skeleton",
      entityIds: [result.skeletonId],
      objectIds: [result.armatureObjectId],
    });
  }
}
