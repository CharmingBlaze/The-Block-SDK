import type { MeshId, ObjectId } from "@modeling-kit/core";
import type { ModelingSession } from "@modeling-kit/commands";
import { BufferGeometry, Mesh, type Camera, type Object3D } from "three";
import type { TrackedObject } from "./adapter-types";
import type { RenderMapping } from "./geometry";
import { buildSelectionOverlay, disposeOverlayObject } from "./overlay";
import type { OverlayMeshSource, SubElementVisualizer } from "./sub-element";

export interface OverlaySyncContext {
  readonly overlaySources: OverlayMeshSource[];
  readonly overlayObjects: Object3D[];
  readonly tracked: ReadonlyMap<ObjectId, TrackedObject>;
  readonly session: ModelingSession;
  readonly visualizer: SubElementVisualizer;
  readonly camera: Camera;
  readonly viewport: { width: number; height: number; pixelRatio: number };
}

export function collectOverlaySources(context: OverlaySyncContext): OverlayMeshSource[] {
  let count = 0;
  for (const [objectId, tracked] of context.tracked) {
    if (!tracked.geometry || !tracked.mapping || !(tracked.object instanceof Mesh)) {
      continue;
    }
    const meshId = tracked.object.userData.meshId as MeshId | undefined;
    const kernel = meshId ? context.session.meshes.get(meshId) : undefined;
    if (!kernel) {
      continue;
    }
    const existing = context.overlaySources[count];
    if (existing) {
      (existing as { objectId: ObjectId }).objectId = objectId;
      (existing as { object: Object3D }).object = tracked.object;
      (existing as { kernel: typeof kernel }).kernel = kernel;
      (existing as { geometry: BufferGeometry }).geometry = tracked.geometry;
      (existing as { mapping: RenderMapping }).mapping = tracked.mapping;
    } else {
      context.overlaySources[count] = {
        objectId,
        object: tracked.object,
        kernel,
        geometry: tracked.geometry,
        mapping: tracked.mapping,
      };
    }
    count += 1;
  }
  context.overlaySources.length = count;
  return context.overlaySources;
}

export function clearLegacyOverlay(context: OverlaySyncContext): void {
  for (const object of context.overlayObjects) {
    disposeOverlayObject(object);
  }
  context.overlayObjects.length = 0;
}

export function syncLegacyOverlays(context: OverlaySyncContext): void {
  clearLegacyOverlay(context);
  const selected = context.session.selection;
  const domain = selected.domain;
  if (domain !== "face" && domain !== "edge" && domain !== "vertex" && domain !== "object") {
    return;
  }
  if (domain !== "object" && selected.elementIds.length === 0) {
    return;
  }
  for (const objectId of selected.objectIds) {
    const tracked = context.tracked.get(objectId);
    if (!tracked?.geometry || !tracked.mapping || !(tracked.object instanceof Mesh)) {
      continue;
    }
    const meshId = tracked.object.userData.meshId as MeshId | undefined;
    const kernel = meshId ? context.session.meshes.get(meshId) : undefined;
    if (!kernel) {
      continue;
    }
    const overlay = buildSelectionOverlay({
      domain,
      elementIds: selected.elementIds,
      kernel,
      geometry: tracked.geometry,
      mapping: tracked.mapping,
    });
    if (!overlay) {
      continue;
    }
    tracked.object.add(overlay);
    context.overlayObjects.push(overlay);
  }
}

export function syncOverlays(
  context: OverlaySyncContext,
  mode: "full" | "state" | "view" = "full",
): void {
  if (!context.visualizer.getDisplay().enabled) {
    syncLegacyOverlays(context);
    return;
  }
  context.visualizer.sync(collectOverlaySources(context), context.session.selection, {
    camera: context.camera,
    width: context.viewport.width,
    height: context.viewport.height,
    pixelRatio: context.viewport.pixelRatio,
  }, mode);
}
