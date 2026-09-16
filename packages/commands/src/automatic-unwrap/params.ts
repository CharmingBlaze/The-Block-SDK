import type { CornerId, EdgeId, FaceId, MeshId } from "@modeling-kit/core";
import type { AutomaticUvUnwrapOptions, AutomaticUvUnwrapResult } from "@modeling-kit/uv";

export interface AutomaticUnwrapCommandParams {
  readonly meshId: MeshId;
  readonly faceIds?: readonly FaceId[];
  readonly uvChannel: string;
  readonly options?: AutomaticUvUnwrapOptions;
}

export interface CornerUvPatch {
  readonly cornerId: CornerId;
  readonly uv: readonly [number, number];
}

export interface EdgeSeamPatch {
  readonly edgeId: EdgeId;
  readonly isSeam: boolean;
}

export interface CornerPinPatch {
  readonly cornerId: CornerId;
  readonly pinned: boolean;
}

export interface UvChannelEditPatch {
  readonly uvs: readonly CornerUvPatch[];
  readonly seams: readonly EdgeSeamPatch[];
  readonly pins: readonly CornerPinPatch[];
}

export type { AutomaticUvUnwrapResult };
