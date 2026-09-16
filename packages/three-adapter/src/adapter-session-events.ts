import type { ObjectId } from "@modeling-kit/core";
import type { ModelingSession } from "@modeling-kit/commands";
import { MeshVisualDirtyFlag, type MeshVisualScheduler } from "./sub-element";
import { SceneDirtyFlag } from "./scene-sync";

export interface AdapterSessionHandlers {
  readonly scheduler: MeshVisualScheduler;
  isSyncing(): boolean;
  markDirty(flags: SceneDirtyFlag): void;
  syncTransforms(objectIds: readonly ObjectId[]): void;
  syncVisibility(objectIds: readonly ObjectId[]): void;
  syncNames(objectIds: readonly ObjectId[]): void;
  syncMaterialsOnly(): void;
  flushOrSchedule(): void;
  syncMeshesById(meshIds: readonly string[]): void;
  flushVisuals(): void;
  sync(): void;
}

export function bindAdapterSessionEvents(
  session: ModelingSession,
  handlers: AdapterSessionHandlers,
): Array<() => void> {
  return [
    session.events.on("document:changed", (change) => {
      if (handlers.isSyncing()) {
        return;
      }
      if (change.kind === "transform" && change.objectIds && change.objectIds.length > 0) {
        handlers.markDirty(SceneDirtyFlag.Transforms);
        handlers.syncTransforms(change.objectIds);
        return;
      }
      if (change.kind === "visibility" && change.objectIds && change.objectIds.length > 0) {
        handlers.markDirty(SceneDirtyFlag.Visibility);
        handlers.syncVisibility(change.objectIds);
        return;
      }
      if (change.kind === "name" && change.objectIds && change.objectIds.length > 0) {
        handlers.syncNames(change.objectIds);
        return;
      }
      if (change.aspect === "material" || change.kind === "materials") {
        handlers.markDirty(SceneDirtyFlag.Materials);
        handlers.syncMaterialsOnly();
        return;
      }
      if (change.aspect === "texture") {
        handlers.markDirty(SceneDirtyFlag.Textures);
        handlers.flushOrSchedule();
        return;
      }
      handlers.markDirty(SceneDirtyFlag.Hierarchy);
      handlers.flushOrSchedule();
    }),
    session.events.on("mesh:changed", (change) => {
      if (handlers.isSyncing()) {
        return;
      }
      if (change.meshIds.length > 0) {
        handlers.syncMeshesById(change.meshIds);
        const flags =
          change.kind === "uvs" || change.kind === "seams"
            ? MeshVisualDirtyFlag.UVs
            : change.kind === "positions"
              ? MeshVisualDirtyFlag.Positions | MeshVisualDirtyFlag.Normals
              : change.kind === "materials"
                ? MeshVisualDirtyFlag.Materials
                : MeshVisualDirtyFlag.Topology | MeshVisualDirtyFlag.Positions | MeshVisualDirtyFlag.Normals;
        for (const meshId of change.meshIds) {
          handlers.scheduler.invalidate(meshId, flags);
        }
        handlers.flushVisuals();
        return;
      }
      handlers.sync();
    }),
    session.events.on("selection:changed", () => {
      if (!handlers.isSyncing()) {
        handlers.scheduler.invalidate(
          "*",
          MeshVisualDirtyFlag.VertexStates | MeshVisualDirtyFlag.EdgeStates | MeshVisualDirtyFlag.FaceStates,
        );
        handlers.flushVisuals();
      }
    }),
    session.events.on("animation:time-changed", () => {
      if (!handlers.isSyncing()) {
        handlers.sync();
      }
    }),
  ];
}
