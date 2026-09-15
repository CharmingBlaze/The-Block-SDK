import type { MeshId, VertexId } from "@modeling-kit/core";
import type { Command, CommandContext } from "@modeling-kit/history";
import {
  bridgeLoops,
  createMeshOperationContext,
  serializeMesh,
  type BridgeEdgesResult,
  type SerializedMesh,
} from "@modeling-kit/mesh";
import { restoreAfter, restoreBefore } from "./connect-vertices";
import { requireSelectedMesh } from "./require-selected-mesh";
import { applyOperationSelection, restoreSelection } from "./selection-from-mapping";
import type { SelectionSnapshot } from "@modeling-kit/selection";

export interface BridgeLoopsParams {
  readonly loopA: readonly VertexId[];
  readonly loopB: readonly VertexId[];
  readonly reverseB?: boolean;
}

export class BridgeLoopsCommand implements Command<BridgeEdgesResult> {
  readonly id = crypto.randomUUID();
  readonly label = "Bridge Loops";
  private before: SerializedMesh | null = null;
  private after: SerializedMesh | null = null;
  private meshId: MeshId | null = null;
  private result: BridgeEdgesResult | null = null;
  private selectionBefore: SelectionSnapshot | null = null;
  private selectionAfter: SelectionSnapshot | null = null;

  constructor(readonly params: BridgeLoopsParams) {}

  execute(context: CommandContext): BridgeEdgesResult {
    if (this.after && this.meshId) {
      restoreAfter(context, this.after, this.meshId);
      restoreSelection(context, this.selectionAfter);
      if (!this.result) {
        throw new Error("BridgeLoopsCommand is missing a stored result");
      }
      return this.result;
    }
    const { objectId, meshId, mesh } = requireSelectedMesh(context);
    this.selectionBefore = context.selection.snapshot();
    this.before = serializeMesh(mesh);
    this.meshId = meshId;
    const bridged = bridgeLoops(
      mesh,
      {
        loopA: this.params.loopA,
        loopB: this.params.loopB,
        ...(this.params.reverseB ? { reverseB: true } : {}),
      },
      createMeshOperationContext(context.ids),
    );
    this.result = { bridgeFaceIds: bridged.bridgeFaceIds };
    this.after = serializeMesh(mesh);
    context.syncMesh(mesh.id);
    applyOperationSelection(context, objectId, bridged);
    this.selectionAfter = context.selection.snapshot();
    context.events.emit("mesh:changed", { meshIds: [mesh.id] });
    return this.result;
  }

  undo(context: CommandContext): void {
    restoreBefore(context, this.before, this.meshId);
    restoreSelection(context, this.selectionBefore);
  }

  redo(context: CommandContext): BridgeEdgesResult {
    return this.execute(context);
  }
}
