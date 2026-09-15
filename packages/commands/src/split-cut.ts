import type { EdgeId, FaceId, MeshId } from "@modeling-kit/core";
import type { Command, CommandContext } from "@modeling-kit/history";
import {
  createMeshOperationContext,
  cutFace as cutFaceOp,
  restoreMesh,
  serializeMesh,
  splitEdge as splitEdgeOp,
  type CutEndpoint,
  type SerializedMesh,
} from "@modeling-kit/mesh";
import type { CutFaceResult, KnifeEndpoint, SplitEdgeResult } from "@modeling-kit/tools";
import type { SelectionSnapshot } from "@modeling-kit/selection";
import { applyOperationSelection, restoreSelection } from "./selection-from-mapping";
import { requireSelectedMesh } from "./require-selected-mesh";

export interface SplitEdgeParams {
  readonly t?: number;
  readonly edgeId?: EdgeId;
}

export class SplitEdgeCommand implements Command<SplitEdgeResult> {
  readonly id = crypto.randomUUID();
  readonly label = "Split Edge";
  private before: SerializedMesh | null = null;
  private after: SerializedMesh | null = null;
  private meshId: MeshId | null = null;
  private result: SplitEdgeResult | null = null;
  private selectionBefore: SelectionSnapshot | null = null;
  private selectionAfter: SelectionSnapshot | null = null;

  constructor(readonly params: SplitEdgeParams = {}) {}

  execute(context: CommandContext): SplitEdgeResult {
    if (this.after && this.meshId) {
      const mesh = context.meshes.get(this.meshId);
      if (mesh) {
        restoreMesh(mesh, this.after);
        context.syncMesh(mesh.id);
      }
      restoreSelection(context, this.selectionAfter);
      if (!this.result) {
        throw new Error("SplitEdgeCommand is missing a stored result");
      }
      return this.result;
    }
    const { objectId, meshId, mesh } = requireSelectedMesh(context);
    const edgeId = this.params.edgeId ?? (context.selection.elementIds[0] as EdgeId | undefined);
    if (!edgeId) {
      throw new RangeError("SplitEdgeCommand requires an edge");
    }
    this.selectionBefore = context.selection.snapshot();
    this.before = serializeMesh(mesh);
    this.meshId = meshId;
    const split = splitEdgeOp(
      mesh,
      { edgeId, t: this.params.t ?? 0.5 },
      createMeshOperationContext(context.ids),
    );
    this.result = { vertexId: split.newVertexId, edgeIds: [split.firstEdgeId, split.secondEdgeId] };
    this.after = serializeMesh(mesh);
    context.syncMesh(mesh.id);
    applyOperationSelection(context, objectId, split);
    this.selectionAfter = context.selection.snapshot();
    context.events.emit("mesh:changed", { meshIds: [mesh.id] });
    return this.result;
  }

  undo(context: CommandContext): void {
    restoreBefore(context, this.before, this.meshId);
    restoreSelection(context, this.selectionBefore);
  }

  redo(context: CommandContext): SplitEdgeResult {
    return this.execute(context);
  }
}

export interface CutFaceParams {
  readonly from: KnifeEndpoint;
  readonly to: KnifeEndpoint;
  readonly faceId?: FaceId;
}

export class CutFaceCommand implements Command<CutFaceResult> {
  readonly id = crypto.randomUUID();
  readonly label = "Cut Face";
  private before: SerializedMesh | null = null;
  private after: SerializedMesh | null = null;
  private meshId: MeshId | null = null;
  private result: CutFaceResult | null = null;
  private selectionBefore: SelectionSnapshot | null = null;
  private selectionAfter: SelectionSnapshot | null = null;

  constructor(readonly params: CutFaceParams) {}

  execute(context: CommandContext): CutFaceResult {
    if (this.after && this.meshId) {
      const mesh = context.meshes.get(this.meshId);
      if (mesh) {
        restoreMesh(mesh, this.after);
        context.syncMesh(mesh.id);
      }
      restoreSelection(context, this.selectionAfter);
      if (!this.result) {
        throw new Error("CutFaceCommand is missing a stored result");
      }
      return this.result;
    }
    const { objectId, meshId, mesh } = requireSelectedMesh(context);
    const faceId =
      this.params.faceId ??
      (context.selection.domain === "face"
        ? (context.selection.elementIds[0] as FaceId | undefined)
        : undefined);
    if (!faceId) {
      throw new RangeError("CutFaceCommand requires a face");
    }
    this.selectionBefore = context.selection.snapshot();
    this.before = serializeMesh(mesh);
    this.meshId = meshId;
    const cut = cutFaceOp(
      mesh,
      {
        faceId,
        from: this.params.from as CutEndpoint,
        to: this.params.to as CutEndpoint,
      },
      createMeshOperationContext(context.ids),
    );
    this.result = {
      fromVertexId: cut.fromVertexId,
      toVertexId: cut.toVertexId,
      faceIds: [cut.preservedFaceId, cut.newFaceId],
      newEdgeId: cut.newEdgeId,
    };
    this.after = serializeMesh(mesh);
    context.syncMesh(mesh.id);
    applyOperationSelection(context, objectId, cut);
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

function restoreBefore(
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
