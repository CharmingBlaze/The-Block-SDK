import type { FaceId, MeshId, VertexId } from "@modeling-kit/core";
import type { Command, CommandContext } from "@modeling-kit/history";
import {
  connectVertices,
  createMeshOperationContext,
  restoreMesh,
  serializeMesh,
  type CutFaceResult,
  type SerializedMesh,
} from "@modeling-kit/mesh";
import type { SelectionSnapshot } from "@modeling-kit/selection";
import { applyOperationSelection, restoreSelection } from "./selection-from-mapping";
import { requireSelectedMesh } from "./require-selected-mesh";

export interface ConnectVerticesParams {
  readonly a?: VertexId;
  readonly b?: VertexId;
  readonly faceId?: FaceId;
}

export class ConnectVerticesCommand implements Command<CutFaceResult> {
  readonly id = crypto.randomUUID();
  readonly label = "Connect Vertices";
  private before: SerializedMesh | null = null;
  private after: SerializedMesh | null = null;
  private meshId: MeshId | null = null;
  private result: CutFaceResult | null = null;
  private selectionBefore: SelectionSnapshot | null = null;
  private selectionAfter: SelectionSnapshot | null = null;

  constructor(readonly params: ConnectVerticesParams = {}) {}

  execute(context: CommandContext): CutFaceResult {
    if (this.after && this.meshId) {
      restoreAfter(context, this.after, this.meshId);
      restoreSelection(context, this.selectionAfter);
      if (!this.result) {
        throw new Error("ConnectVerticesCommand is missing a stored result");
      }
      return this.result;
    }
    const { objectId, meshId, mesh } = requireSelectedMesh(context);
    const a = this.params.a ?? (context.selection.elementIds[0] as VertexId | undefined);
    const b = this.params.b ?? (context.selection.elementIds[1] as VertexId | undefined);
    if (!a || !b) {
      throw new RangeError("ConnectVerticesCommand requires two vertices");
    }
    this.selectionBefore = context.selection.snapshot();
    this.before = serializeMesh(mesh);
    this.meshId = meshId;
    this.result = connectVertices(
      mesh,
      {
        a,
        b,
        ...(this.params.faceId ? { faceId: this.params.faceId } : {}),
      },
      createMeshOperationContext(context.ids),
    );
    this.after = serializeMesh(mesh);
    context.syncMesh(mesh.id);
    applyOperationSelection(context, objectId, this.result);
    this.selectionAfter = context.selection.snapshot();
    context.events.emit("mesh:changed", { meshIds: [mesh.id] });
    return this.result;
  }

  undo(context: CommandContext): void {
    restoreBefore(context, this.before, this.meshId);
    restoreSelection(context, this.selectionBefore);
  }

  redo(context: CommandContext): CutFaceResult {
    return this.execute(context);
  }
}

export function restoreBefore(
  context: CommandContext,
  before: SerializedMesh | null,
  meshId: MeshId | null,
): void {
  if (!before || !meshId) {
    return;
  }
  const mesh = context.meshes.get(meshId);
  if (!mesh) {
    return;
  }
  restoreMesh(mesh, before);
  context.syncMesh(mesh.id);
  context.events.emit("mesh:changed", { meshIds: [mesh.id] });
}

export function restoreAfter(
  context: CommandContext,
  after: SerializedMesh,
  meshId: MeshId,
): void {
  const mesh = context.meshes.get(meshId);
  if (!mesh) {
    return;
  }
  restoreMesh(mesh, after);
  context.syncMesh(mesh.id);
}
