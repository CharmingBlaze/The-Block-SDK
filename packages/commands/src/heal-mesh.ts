import type { MeshId } from "@modeling-kit/core";
import type { Command, CommandContext } from "@modeling-kit/history";
import { serializeMesh, type SerializedMesh } from "@modeling-kit/mesh";
import { healMesh, type MeshCleanupReport } from "@modeling-kit/validation";
import { restoreAfter, restoreBefore } from "./connect-vertices";
import { requireSelectedMesh } from "./require-selected-mesh";

export class HealMeshCommand implements Command<MeshCleanupReport> {
  readonly id = crypto.randomUUID();
  readonly label = "Heal Mesh";
  private before: SerializedMesh | null = null;
  private after: SerializedMesh | null = null;
  private meshId: MeshId | null = null;
  private result: MeshCleanupReport | null = null;

  execute(context: CommandContext): MeshCleanupReport {
    if (this.after && this.meshId) {
      restoreAfter(context, this.after, this.meshId);
      if (!this.result) {
        throw new Error("HealMeshCommand is missing a stored result");
      }
      return this.result;
    }
    const { meshId, mesh } = requireSelectedMesh(context);
    this.before = serializeMesh(mesh);
    this.meshId = meshId;
    this.result = healMesh(mesh, context.ids);
    this.after = serializeMesh(mesh);
    context.syncMesh(mesh.id);
    context.events.emit("mesh:changed", { meshIds: [mesh.id] });
    return this.result;
  }

  undo(context: CommandContext): void {
    restoreBefore(context, this.before, this.meshId);
  }

  redo(context: CommandContext): MeshCleanupReport {
    return this.execute(context);
  }
}
