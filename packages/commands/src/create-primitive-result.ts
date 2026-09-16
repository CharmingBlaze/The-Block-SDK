import { type FaceId, type MeshId, type ObjectId } from "@modeling-kit/core";
import type { CubeFaceIds } from "@modeling-kit/mesh";
import type { PrimitiveCreateParams, PrimitiveFaceGroups, PrimitiveType } from "@modeling-kit/primitives";

export type { PrimitiveType };
export type CreatePrimitiveParams = PrimitiveCreateParams;

export interface CreatePrimitiveResult {
  readonly objectId: ObjectId;
  readonly meshId: MeshId;
  readonly groups: PrimitiveFaceGroups;
  readonly faceIds: CubeFaceIds & { readonly top: FaceId; readonly bottom: FaceId };
}
