import type { EdgeId, MeshId } from "@modeling-kit/core";
import type { Command, CommandContext } from "@modeling-kit/history";
import { restoreMesh, serializeMesh, type SerializedMesh } from "@modeling-kit/mesh";
import { setSeams } from "@modeling-kit/uv";
import { requireSelectedMesh } from "./require-selected-mesh";

export interface SetSeamsParams {
  readonly isSeam: boolean;
  readonly edgeIds?: readonly EdgeId[];
}

export class SetSeamsCommand implements Command<void> {
  readonly id = crypto.randomUUID();
  readonly label = "Set Seams";
  private before: SerializedMesh | null = null;
  private after: SerializedMesh | null = null;
  private meshId: MeshId | null = null;

  constructor(readonly params: SetSeamsParams) {}

  execute(context: CommandContext): void {
    const { meshId, mesh } = requireSelectedMesh(context);
    if (this.after && this.meshId) {
      restoreMesh(mesh, this.after);
      context.syncMesh(meshId);
      return;
    }
    const edgeIds = this.params.edgeIds ?? (context.selection.elementIds as EdgeId[]);
    this.meshId = meshId;
    this.before = serializeMesh(mesh);
    setSeams(mesh, edgeIds, this.params.isSeam);
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
