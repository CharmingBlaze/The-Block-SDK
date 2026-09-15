import type { EdgeId, FaceId, MeshId, VertexId } from "@modeling-kit/core";
import type { Command, CommandContext } from "@modeling-kit/history";
import {
  collapseEdge,
  createMeshOperationContext,
  dissolveFace,
  dissolveVertex,
  restoreMesh,
  reverseFaceWinding,
  serializeMesh,
  type CollapseEdgeResult,
  type DissolveFaceResult,
  type DissolveVertexResult,
  type MeshOperationResult,
  type SerializedMesh,
} from "@modeling-kit/mesh";
import type { SelectionSnapshot } from "@modeling-kit/selection";
import { applyOperationSelection, restoreSelection } from "./selection-from-mapping";
import { requireSelectedMesh } from "./require-selected-mesh";

function restoreMeshSnapshot(
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

export interface DissolveVertexParams {
  readonly vertexId?: VertexId;
}

export class DissolveVertexCommand implements Command<DissolveVertexResult> {
  readonly id = crypto.randomUUID();
  readonly label = "Dissolve Vertex";
  private before: SerializedMesh | null = null;
  private after: SerializedMesh | null = null;
  private meshId: MeshId | null = null;
  private result: DissolveVertexResult | null = null;
  private selectionBefore: SelectionSnapshot | null = null;
  private selectionAfter: SelectionSnapshot | null = null;

  constructor(readonly params: DissolveVertexParams = {}) {}

  execute(context: CommandContext): DissolveVertexResult {
    if (this.after && this.meshId) {
      restoreMeshSnapshot(context, this.after, this.meshId);
      restoreSelection(context, this.selectionAfter);
      if (!this.result) {
        throw new Error("DissolveVertexCommand is missing a stored result");
      }
      return this.result;
    }
    const { objectId, meshId, mesh } = requireSelectedMesh(context);
    const vertexId = this.params.vertexId ?? (context.selection.elementIds[0] as VertexId | undefined);
    if (!vertexId) {
      throw new RangeError("DissolveVertexCommand requires a vertex");
    }
    this.selectionBefore = context.selection.snapshot();
    this.before = serializeMesh(mesh);
    this.meshId = meshId;
    this.result = dissolveVertex(mesh, { vertexId }, createMeshOperationContext(context.ids));
    this.after = serializeMesh(mesh);
    context.syncMesh(mesh.id);
    applyOperationSelection(context, objectId, this.result);
    this.selectionAfter = context.selection.snapshot();
    context.events.emit("mesh:changed", { meshIds: [mesh.id] });
    return this.result;
  }

  undo(context: CommandContext): void {
    restoreMeshSnapshot(context, this.before, this.meshId);
    restoreSelection(context, this.selectionBefore);
  }

  redo(context: CommandContext): DissolveVertexResult {
    return this.execute(context);
  }
}

export interface DissolveFaceCommandParams {
  readonly faceId?: FaceId;
}

export class DissolveFaceCommand implements Command<DissolveFaceResult> {
  readonly id = crypto.randomUUID();
  readonly label = "Dissolve Face";
  private before: SerializedMesh | null = null;
  private after: SerializedMesh | null = null;
  private meshId: MeshId | null = null;
  private result: DissolveFaceResult | null = null;
  private selectionBefore: SelectionSnapshot | null = null;
  private selectionAfter: SelectionSnapshot | null = null;

  constructor(readonly params: DissolveFaceCommandParams = {}) {}

  execute(context: CommandContext): DissolveFaceResult {
    if (this.after && this.meshId) {
      restoreMeshSnapshot(context, this.after, this.meshId);
      restoreSelection(context, this.selectionAfter);
      if (!this.result) {
        throw new Error("DissolveFaceCommand is missing a stored result");
      }
      return this.result;
    }
    const { objectId, meshId, mesh } = requireSelectedMesh(context);
    const faceId = this.params.faceId ?? (context.selection.elementIds[0] as FaceId | undefined);
    if (!faceId) {
      throw new RangeError("DissolveFaceCommand requires a face");
    }
    this.selectionBefore = context.selection.snapshot();
    this.before = serializeMesh(mesh);
    this.meshId = meshId;
    this.result = dissolveFace(mesh, { faceId }, createMeshOperationContext(context.ids));
    this.after = serializeMesh(mesh);
    context.syncMesh(mesh.id);
    applyOperationSelection(context, objectId, this.result);
    this.selectionAfter = context.selection.snapshot();
    context.events.emit("mesh:changed", { meshIds: [mesh.id] });
    return this.result;
  }

  undo(context: CommandContext): void {
    restoreMeshSnapshot(context, this.before, this.meshId);
    restoreSelection(context, this.selectionBefore);
  }

  redo(context: CommandContext): DissolveFaceResult {
    return this.execute(context);
  }
}

export interface CollapseEdgeParams {
  readonly edgeId?: EdgeId;
}

export class CollapseEdgeCommand implements Command<CollapseEdgeResult> {
  readonly id = crypto.randomUUID();
  readonly label = "Collapse Edge";
  private before: SerializedMesh | null = null;
  private after: SerializedMesh | null = null;
  private meshId: MeshId | null = null;
  private result: CollapseEdgeResult | null = null;
  private selectionBefore: SelectionSnapshot | null = null;
  private selectionAfter: SelectionSnapshot | null = null;

  constructor(readonly params: CollapseEdgeParams = {}) {}

  execute(context: CommandContext): CollapseEdgeResult {
    if (this.after && this.meshId) {
      restoreMeshSnapshot(context, this.after, this.meshId);
      restoreSelection(context, this.selectionAfter);
      if (!this.result) {
        throw new Error("CollapseEdgeCommand is missing a stored result");
      }
      return this.result;
    }
    const { objectId, meshId, mesh } = requireSelectedMesh(context);
    const edgeId = this.params.edgeId ?? (context.selection.elementIds[0] as EdgeId | undefined);
    if (!edgeId) {
      throw new RangeError("CollapseEdgeCommand requires an edge");
    }
    this.selectionBefore = context.selection.snapshot();
    this.before = serializeMesh(mesh);
    this.meshId = meshId;
    this.result = collapseEdge(mesh, { edgeId }, createMeshOperationContext(context.ids));
    this.after = serializeMesh(mesh);
    context.syncMesh(mesh.id);
    applyOperationSelection(context, objectId, this.result);
    this.selectionAfter = context.selection.snapshot();
    context.events.emit("mesh:changed", { meshIds: [mesh.id] });
    return this.result;
  }

  undo(context: CommandContext): void {
    restoreMeshSnapshot(context, this.before, this.meshId);
    restoreSelection(context, this.selectionBefore);
  }

  redo(context: CommandContext): CollapseEdgeResult {
    return this.execute(context);
  }
}

export interface ReverseFaceWindingParams {
  readonly faceIds?: readonly FaceId[];
}

export class ReverseFaceWindingCommand implements Command<MeshOperationResult> {
  readonly id = crypto.randomUUID();
  readonly label = "Reverse Face Winding";
  private before: SerializedMesh | null = null;
  private after: SerializedMesh | null = null;
  private meshId: MeshId | null = null;
  private result: MeshOperationResult | null = null;
  private selectionBefore: SelectionSnapshot | null = null;
  private selectionAfter: SelectionSnapshot | null = null;

  constructor(readonly params: ReverseFaceWindingParams = {}) {}

  execute(context: CommandContext): MeshOperationResult {
    if (this.after && this.meshId) {
      restoreMeshSnapshot(context, this.after, this.meshId);
      restoreSelection(context, this.selectionAfter);
      if (!this.result) {
        throw new Error("ReverseFaceWindingCommand is missing a stored result");
      }
      return this.result;
    }
    const { objectId, meshId, mesh } = requireSelectedMesh(context);
    const faceIds =
      this.params.faceIds ??
      (context.selection.domain === "face" ? (context.selection.elementIds as FaceId[]) : undefined);
    this.selectionBefore = context.selection.snapshot();
    this.before = serializeMesh(mesh);
    this.meshId = meshId;
    this.result = reverseFaceWinding(
      mesh,
      faceIds ? { faceIds } : {},
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
    restoreMeshSnapshot(context, this.before, this.meshId);
    restoreSelection(context, this.selectionBefore);
  }

  redo(context: CommandContext): MeshOperationResult {
    return this.execute(context);
  }
}
