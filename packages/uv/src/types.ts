import type { FaceId } from "@modeling-kit/core";
import type { Vector3 } from "@modeling-kit/math";

export interface UvBounds {
  readonly minU: number;
  readonly minV: number;
  readonly maxU: number;
  readonly maxV: number;
}

export interface PlanarProjectionOptions {
  /** Target faces to project; if omitted, all faces in the mesh are projected */
  readonly faceIds?: readonly FaceId[] | undefined;
  /** Projection direction: "x" | "y" | "z" | custom normal Vector3 */
  readonly direction: "x" | "y" | "z" | Vector3;
}

export interface BoxProjectionOptions {
  readonly faceIds?: readonly FaceId[] | undefined;
  /** Scale factor for mapping world units to UV space */
  readonly scale?: number | undefined;
}

export interface CylindricalProjectionOptions {
  readonly faceIds?: readonly FaceId[] | undefined;
  readonly axis?: "x" | "y" | "z" | undefined;
}

export interface SphericalProjectionOptions {
  readonly faceIds?: readonly FaceId[] | undefined;
}

export interface UvIsland {
  readonly faceIds: readonly FaceId[];
  readonly cornerIds?: readonly import("@modeling-kit/core").CornerId[] | undefined;
  readonly bounds?: UvBounds | undefined;
}
