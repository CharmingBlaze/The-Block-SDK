export const enum SceneDirtyFlag {
  None = 0,
  Hierarchy = 1 << 0,
  Transforms = 1 << 1,
  Visibility = 1 << 2,
  Geometry = 1 << 3,
  Materials = 1 << 4,
  Textures = 1 << 5,
  Skeletons = 1 << 6,
  Picking = 1 << 7,
}

export type SceneMirrorLifecycle =
  | "uninitialized"
  | "building"
  | "ready"
  | "updating"
  | "suspended"
  | "disposing"
  | "disposed"
  | "failed";
