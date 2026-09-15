import {
  OperationLifecycleMachine,
  type MeshId,
  type ObjectId,
  type OperationLifecycle,
  type VertexId,
} from "@modeling-kit/core";
import type { ModelDocument } from "@modeling-kit/document";
import { Matrix4, Vector3, type TransformData } from "@modeling-kit/math";
import type { HalfEdgeMesh } from "@modeling-kit/mesh";
import { getNode, setLocalTransform, worldMatrix } from "@modeling-kit/scene";
import {
  deltaMatrix,
  applyWorldToLocal,
  cloneTransform,
  computePivot,
  selectionRoots,
  transformsNearlyEqual,
  writeObjectWorld,
} from "./apply";
import type {
  ObjectTransformPatch,
  TransformDelta,
  TransformRequest,
  TransformSnapshot,
  VertexPositionPatch,
} from "./types";

export interface TransformGestureContext {
  readonly document: ModelDocument;
  readonly meshes: ReadonlyMap<MeshId, HalfEdgeMesh>;
  emit(): void;
}

interface ObjectBaseline {
  readonly objectId: ObjectId;
  readonly local: TransformData;
  readonly world: Matrix4;
}

interface VertexBaseline {
  readonly meshId: MeshId;
  readonly vertexId: VertexId;
  readonly position: readonly [number, number, number];
}

export class TransformGesture {
  private objectBaselines: ObjectBaseline[];
  private vertexBaselines: VertexBaseline[];
  private readonly roots: ObjectId[];
  private readonly pivot: Vector3;
  /** XF-002 maps spec “transforming” onto CORE-003 `active`. */
  readonly lifecycle = new OperationLifecycleMachine();

  constructor(
    private readonly context: TransformGestureContext,
    readonly request: TransformRequest,
  ) {
    this.lifecycle.transition("beginning");
    const objectIds = request.objectIds ?? [];
    this.roots = selectionRoots(context.document, objectIds);
    this.objectBaselines = objectIds.map((objectId) => {
      const node = getNode(context.document, objectId);
      return {
        objectId,
        local: cloneTransform(node.localTransform),
        world: worldMatrix(context.document, objectId),
      };
    });
    const meshId = request.meshId;
    const vertexIds = request.vertexIds ?? [];
    this.vertexBaselines = [];
    if (meshId && vertexIds.length > 0) {
      const mesh = context.meshes.get(meshId);
      if (!mesh) {
        throw new RangeError(`TransformGesture: missing mesh ${meshId}`);
      }
      for (const vertexId of vertexIds) {
        const vertex = mesh.vertices.get(vertexId);
        if (!vertex) {
          throw new RangeError(`TransformGesture: missing vertex ${vertexId}`);
        }
        this.vertexBaselines.push({
          meshId,
          vertexId,
          position: [vertex.position[0], vertex.position[1], vertex.position[2]],
        });
      }
    }
    this.pivot = computePivot(
      context.document,
      this.roots.length > 0 ? this.roots : objectIds,
      request.pivot ?? "median",
      request.cursor,
      {
        activeId: request.activeId,
        meshes: context.meshes,
        ...(this.vertexBaselines.length > 0 && objectIds[0]
          ? vertexPivotHints(context.document, objectIds[0]!, this.vertexBaselines, request.activeId)
          : {}),
      },
    );
  }

  get state(): OperationLifecycle {
    return this.lifecycle.state;
  }

  get active(): boolean {
    return this.lifecycle.state === "beginning" || this.lifecycle.state === "active";
  }

  update(delta: TransformDelta): void {
    this.lifecycle.transition("active");
    if (this.vertexBaselines.length > 0) {
      this.applyVertices(delta);
    } else {
      this.applyObjects(delta);
    }
    this.context.emit();
  }

  snapshot(): TransformSnapshot {
    const objects: ObjectTransformPatch[] = this.objectBaselines.map((baseline) => ({
      objectId: baseline.objectId,
      before: cloneTransform(baseline.local),
      after: cloneTransform(getNode(this.context.document, baseline.objectId).localTransform),
    }));
    const vertices: VertexPositionPatch[] = this.vertexBaselines.map((baseline) => {
      const mesh = this.context.meshes.get(baseline.meshId);
      const vertex = mesh?.vertices.get(baseline.vertexId);
      return {
        meshId: baseline.meshId,
        vertexId: baseline.vertexId,
        before: baseline.position,
        after: vertex
          ? [vertex.position[0], vertex.position[1], vertex.position[2]]
          : baseline.position,
      };
    });
    return { objects, vertices };
  }

  hasMeaningfulChange(epsilon = 1e-6): boolean {
    const snap = this.snapshot();
    for (const patch of snap.objects) {
      if (!transformsNearlyEqual(patch.before, patch.after, epsilon)) {
        return true;
      }
    }
    for (const patch of snap.vertices) {
      if (
        Math.abs(patch.before[0] - patch.after[0]) > epsilon ||
        Math.abs(patch.before[1] - patch.after[1]) > epsilon ||
        Math.abs(patch.before[2] - patch.after[2]) > epsilon
      ) {
        return true;
      }
    }
    return false;
  }

  commit(): void {
    if (this.lifecycle.state === "completed") {
      return;
    }
    if (this.lifecycle.state === "beginning") {
      this.lifecycle.transition("active");
    }
    this.lifecycle.transition("committing");
    this.lifecycle.transition("completed");
  }

  restoreBaseline(): void {
    this.lifecycle.transition("cancelling");
    for (const baseline of this.objectBaselines) {
      setLocalTransform(this.context.document, baseline.objectId, cloneTransform(baseline.local));
    }
    for (const baseline of this.vertexBaselines) {
      const mesh = this.context.meshes.get(baseline.meshId);
      const vertex = mesh?.vertices.get(baseline.vertexId);
      if (vertex) {
        vertex.position = [baseline.position[0], baseline.position[1], baseline.position[2]];
        mesh?.bumpPositionsRevision();
      }
    }
    this.context.emit();
    this.lifecycle.transition("cancelled");
  }

  dispose(): void {
    if (this.lifecycle.state === "beginning" || this.lifecycle.state === "active") {
      this.restoreBaseline();
    }
    this.objectBaselines.length = 0;
    this.vertexBaselines.length = 0;
  }

  private applyObjects(delta: TransformDelta): void {
    const rootSet = new Set(this.roots);
    for (const baseline of this.objectBaselines) {
      if (!rootSet.has(baseline.objectId)) {
        setLocalTransform(this.context.document, baseline.objectId, cloneTransform(baseline.local));
        continue;
      }
      const node = getNode(this.context.document, baseline.objectId);
      const deltaWorld = deltaMatrix(
        this.context.document,
        node,
        baseline.world,
        this.request,
        delta,
        this.pivot,
      );
      const nextWorld = deltaWorld.multiply(baseline.world);
      const converted = applyWorldToLocal(this.context.document, baseline.objectId, nextWorld);
      if (this.request.mode === "translate") {
        setLocalTransform(this.context.document, baseline.objectId, {
          position: converted.position,
          rotation: cloneTransform(baseline.local).rotation,
          scale: cloneTransform(baseline.local).scale,
        });
        continue;
      }
      if (this.request.mode === "rotate") {
        setLocalTransform(this.context.document, baseline.objectId, {
          position: converted.position,
          rotation: converted.rotation,
          scale: cloneTransform(baseline.local).scale,
        });
        continue;
      }
      writeObjectWorld(this.context.document, baseline.objectId, nextWorld);
    }
  }

  private applyVertices(delta: TransformDelta): void {
    const meshId = this.vertexBaselines[0]?.meshId;
    if (!meshId) {
      return;
    }
    const objectId = this.request.objectIds?.[0];
    if (!objectId) {
      throw new RangeError("Vertex transforms require an objectId");
    }
    const node = getNode(this.context.document, objectId);
    const objectWorld = worldMatrix(this.context.document, objectId);
    const deltaWorld = deltaMatrix(
      this.context.document,
      node,
      objectWorld,
      this.request,
      delta,
      this.pivot,
    );
    const mesh = this.context.meshes.get(meshId);
    if (!mesh) {
      return;
    }
    const inverse = objectWorld.invert();
    for (const baseline of this.vertexBaselines) {
      const vertex = mesh.vertices.get(baseline.vertexId);
      if (!vertex) {
        continue;
      }
      const local = new Vector3(baseline.position[0], baseline.position[1], baseline.position[2]);
      const world = objectWorld.transformPoint(local);
      const nextWorld = deltaWorld.transformPoint(world);
      const nextLocal = inverse.transformPoint(nextWorld);
      vertex.position = [nextLocal.x, nextLocal.y, nextLocal.z];
    }
    mesh.bumpPositionsRevision();
  }
}

function vertexPivotHints(
  document: ModelDocument,
  objectId: ObjectId,
  baselines: readonly VertexBaseline[],
  activeId?: string | null,
): { worldPoints: Vector3[]; activeWorldPoint?: Vector3 } {
  const objectWorld = worldMatrix(document, objectId);
  const worldPoints = baselines.map((baseline) =>
    objectWorld.transformPoint(
      new Vector3(baseline.position[0], baseline.position[1], baseline.position[2]),
    ),
  );
  const activeIndex = activeId ? baselines.findIndex((item) => item.vertexId === activeId) : -1;
  return {
    worldPoints,
    ...(activeIndex >= 0 ? { activeWorldPoint: worldPoints[activeIndex] } : {}),
  };
}
