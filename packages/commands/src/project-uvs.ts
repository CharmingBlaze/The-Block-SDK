import type { FaceId, MeshId } from "@modeling-kit/core";
import type { Command, CommandContext } from "@modeling-kit/history";
import { restoreMesh, serializeMesh, type SerializedMesh } from "@modeling-kit/mesh";
import { projectUvs, type UvProjection } from "@modeling-kit/uv";
import { requireSelectedMesh } from "./require-selected-mesh";

export interface ProjectUvsParams {
  readonly projection: UvProjection;
  readonly faceIds?: readonly FaceId[];
  readonly axis?: "x" | "y" | "z";
}

export class ProjectUvsCommand implements Command<void> {
  readonly id = crypto.randomUUID();
  readonly label = "Project UVs";
  private before: SerializedMesh | null = null;
  private after: SerializedMesh | null = null;
  private meshId: MeshId | null = null;

  constructor(readonly params: ProjectUvsParams) {}

  execute(context: CommandContext): void {
    const { meshId, mesh } = requireSelectedMesh(context);
    if (this.after && this.meshId) {
      restoreMesh(mesh, this.after);
      context.syncMesh(meshId);
      return;
    }
    this.meshId = meshId;
    this.before = serializeMesh(mesh);
    projectUvs(mesh, {
      projection: this.params.projection,
      ...(this.params.faceIds ? { faceIds: this.params.faceIds } : {}),
      ...(this.params.axis ? { axis: this.params.axis } : {}),
    });
    this.after = serializeMesh(mesh);
    context.syncMesh(meshId);
    context.events.emit("mesh:changed", { meshIds: [meshId] });
  }

  undo(context: CommandContext): void {
    if (!this.before || !this.meshId) {
      return;
    }
    const mesh = context.meshes.get(this.meshId);
    if (!mesh) {
      return;
    }
    restoreMesh(mesh, this.before);
    context.syncMesh(this.meshId);
    context.events.emit("mesh:changed", { meshIds: [this.meshId] });
  }

  redo(context: CommandContext): void {
    this.execute(context);
  }
}
