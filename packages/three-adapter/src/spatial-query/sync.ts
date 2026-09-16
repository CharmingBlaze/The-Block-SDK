import type { TrackedObject } from "../adapter-types";
import { collectSpatialPrimitives } from "./collect";
import type { SpatialQueryBackend } from "./types";

export function syncSpatialQuery(
  backend: SpatialQueryBackend | undefined,
  tracked: ReadonlyMap<string, TrackedObject>,
): void {
  backend?.syncPrimitives?.(collectSpatialPrimitives(tracked));
}
