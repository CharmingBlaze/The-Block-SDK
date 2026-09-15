import type { ObjectId } from "@modeling-kit/core";

export type SelectionDomain =
  | "none"
  | "object"
  | "vertex"
  | "edge"
  | "face"
  | "uv"
  | "bone"
  | "keyframe";

export interface SelectionSnapshot {
  readonly domain: SelectionDomain;
  readonly objectIds: readonly ObjectId[];
  readonly elementIds: readonly string[];
  readonly activeId: string | null;
}
