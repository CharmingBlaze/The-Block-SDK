import type { EdgeId, MeshId } from "@modeling-kit/core";
import type { Command, CommandContext } from "@modeling-kit/history";
import {
  restoreMesh,
  serializeMesh,
  setEdgeCreaseWeights,
  type EdgeCreaseWeight,
  type SerializedMesh,
} from "@modeling-kit/mesh";
import { requireSelectedMesh } from "./require-selected-mesh";

export interface SetEdgeCreasesParams {
  readonly weight: EdgeCreaseWeight;
  readonly edgeIds?: readonly EdgeId[];
}

export class SetEdgeCreasesCommand implements Command<void> {
  readonly id = crypto.randomUUID();
  readonly label = "Set Edge Creases";
  private before: SerializedMesh | null = null;
  private after: SerializedMesh | null = null;
  private meshId: MeshId | null = null;

  constructor(readonly params: SetEdgeCreasesParams) {}

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
    setEdgeCreaseWeights(mesh, { edgeIds, weight: this.params.weight });
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
