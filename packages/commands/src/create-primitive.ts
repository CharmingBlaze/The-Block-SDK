import { type FaceId, type MeshId, type ObjectId } from "@modeling-kit/core";
import type { Command, CommandContext } from "@modeling-kit/history";
import {
  deserializeMesh,
  serializeMesh,
  type CubeFaceIds,
  type SerializedMesh,
} from "@modeling-kit/mesh";
import {
  canonicalizePrimitiveType,
  generatePrimitive,
  primitiveDisplayNames,
  type PrimitiveCreateParams,
  type PrimitiveFaceGroups,
  type PrimitiveType,
} from "@modeling-kit/primitives";
import { addNode, removeNode } from "@modeling-kit/scene";
import { FACE_GROUPS_METADATA_KEY, serializeFaceGroups } from "./face-groups";

export type { PrimitiveType };
export type CreatePrimitiveParams = PrimitiveCreateParams;

export interface CreatePrimitiveResult {
  readonly objectId: ObjectId;
  readonly meshId: MeshId;
  readonly groups: PrimitiveFaceGroups;
  readonly faceIds: CubeFaceIds & { readonly top: FaceId; readonly bottom: FaceId };
}

export class CreatePrimitiveCommand implements Command<CreatePrimitiveResult> {
  readonly id = crypto.randomUUID();
  readonly label: string;
  private result: CreatePrimitiveResult | null = null;
  private kernel: SerializedMesh | null = null;

  constructor(
    primitive: PrimitiveType | string,
    readonly params: CreatePrimitiveParams = {},
  ) {
    this.primitive = canonicalizePrimitiveType(primitive);
    this.label = `Create ${primitiveDisplayNames[this.primitive]}`;
  }

  readonly primitive: PrimitiveType;

  execute(context: CommandContext): CreatePrimitiveResult {
    if (this.result && this.kernel) {
      this.restoreCreated(context);
      return this.result;
    }
    const meshId = context.ids.mesh();
    const isBox = this.primitive === "cube" || this.primitive === "box";
    const faceIds: CubeFaceIds | undefined = isBox
      ? {
          posX: context.ids.face(),
          negX: context.ids.face(),
          posY: context.ids.face(),
          negY: context.ids.face(),
          posZ: context.ids.face(),
          negZ: context.ids.face(),
        }
      : undefined;
    const generated = generatePrimitive(this.primitive, this.params, {
      meshId,
      ...(faceIds ? { faceIds } : {}),
    });
    const mesh = generated.mesh;
    const objectId = context.ids.object();
    this.kernel = serializeMesh(mesh);
    const name = this.params.name ?? primitiveDisplayNames[this.primitive];
    context.meshes.set(meshId, mesh);
    context.document.meshes.set({
      id: meshId,
      name,
      kernel: this.kernel,
      materialIds: [],
      metadata: { [FACE_GROUPS_METADATA_KEY]: serializeFaceGroups(generated.groups) },
    });
    addNode(context.document, objectId, {
      name,
      type: "mesh_instance",
      payloadRef: meshId,
    });
    const cubeIds = cubeFaceIdsFromGroups(generated.groups, faceIds);
    this.result = {
      objectId,
      meshId,
      groups: generated.groups,
      faceIds: cubeIds,
    };
    context.events.emit("document:changed", { aspect: "scene", objectIds: [objectId] });
    context.events.emit("mesh:changed", { meshIds: [meshId] });
    return this.result;
  }

  undo(context: CommandContext): void {
    if (!this.result) {
      return;
    }
    removeNode(context.document, this.result.objectId);
    context.document.meshes.delete(this.result.meshId);
    context.meshes.delete(this.result.meshId);
    context.events.emit("document:changed", { aspect: "scene", objectIds: [this.result.objectId] });
  }

  redo(context: CommandContext): CreatePrimitiveResult {
    return this.execute(context);
  }

  private restoreCreated(context: CommandContext): void {
    const result = this.result!;
    const mesh = deserializeMesh(this.kernel!);
    const name = this.params.name ?? primitiveDisplayNames[this.primitive];
    context.meshes.set(result.meshId, mesh);
    context.document.meshes.set({
      id: result.meshId,
      name,
      kernel: this.kernel,
      materialIds: [],
      metadata: { [FACE_GROUPS_METADATA_KEY]: serializeFaceGroups(result.groups) },
    });
    if (!context.document.scene.nodes.has(result.objectId)) {
      addNode(context.document, result.objectId, {
        name,
        type: "mesh_instance",
        payloadRef: result.meshId,
      });
    }
  }
}

function cubeFaceIdsFromGroups(
  groups: PrimitiveFaceGroups,
  allocated: CubeFaceIds | undefined,
): CubeFaceIds & { top: FaceId; bottom: FaceId } {
  if (allocated) {
    return { ...allocated, top: allocated.posY, bottom: allocated.negY };
  }
  const fallback =
    groups.top[0] ??
    groups.sides[0] ??
    groups.bottom[0] ??
    groups.caps[0] ??
    groups.front[0];
  if (!fallback) {
    throw new Error("Primitive produced no faces");
  }
  return {
    posX: groups.posX ?? fallback,
    negX: groups.negX ?? fallback,
    posY: groups.posY ?? groups.top[0] ?? fallback,
    negY: groups.negY ?? groups.bottom[0] ?? fallback,
    posZ: groups.posZ ?? groups.front[0] ?? fallback,
    negZ: groups.negZ ?? groups.back[0] ?? fallback,
    top: groups.top[0] ?? fallback,
    bottom: groups.bottom[0] ?? fallback,
  };
}
