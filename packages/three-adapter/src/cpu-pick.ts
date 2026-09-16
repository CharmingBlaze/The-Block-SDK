import type { EdgeId, MeshId, ObjectId, VertexId } from "@modeling-kit/core";
import type { ModelingSession } from "@modeling-kit/commands";
import { Vector2, Vector3, type Camera, type Object3D, type Raycaster } from "three";
import type { TrackedObject } from "./adapter-types";
import { objectIdFromOverlay } from "./overlay-object-id";
import {
  pickEdgeOnFace,
  pickVertexOnFace,
  resolveFaceId,
  type PickDomain,
  type PickResult,
  type PickingOptions,
} from "./picking";
import type { SpatialQueryBackend } from "./spatial-query";
import type { SubElementVisualizer, PickRequestGate } from "./sub-element";

export interface CpuPickContext {
  readonly disposed: boolean;
  readonly pickGate: PickRequestGate;
  readonly root: Object3D;
  readonly camera: Camera;
  readonly raycaster: Raycaster;
  readonly spatialQuery: SpatialQueryBackend | undefined;
  readonly visualizer: SubElementVisualizer;
  readonly tracked: ReadonlyMap<ObjectId, TrackedObject>;
  readonly session: ModelingSession;
  readonly viewport: { width: number; height: number };
}

export function pickWithCpuRaycaster(
  context: CpuPickContext,
  ndcX: number,
  ndcY: number,
  options?: Partial<PickingOptions>,
): PickResult | null {
  const requestId = context.pickGate.next();
  if (!context.pickGate.isCurrent(requestId) || context.disposed) {
    return null;
  }
  const domain: PickDomain = options?.domain ?? "face";
  const pixelHitRadius = options?.pixelHitRadius ?? 10;
  context.root.updateMatrixWorld(true);
  context.raycaster.setFromCamera(new Vector2(ndcX, ndcY), context.camera);
  const hits = context.raycaster.intersectObject(context.root, true).filter((hit) => {
    if (hit.object.userData.isOverlay && !hit.object.userData.overlayPick) {
      return false;
    }
    if (options?.frontFacingOnly && hit.face) {
      return hit.face.normal.dot(context.raycaster.ray.direction) < 0;
    }
    return true;
  });
  const preferredObjectId = context.spatialQuery?.raycast({
    origin: {
      x: context.raycaster.ray.origin.x,
      y: context.raycaster.ray.origin.y,
      z: context.raycaster.ray.origin.z,
    },
    direction: {
      x: context.raycaster.ray.direction.x,
      y: context.raycaster.ray.direction.y,
      z: context.raycaster.ray.direction.z,
    },
  })?.objectId;
  if (preferredObjectId) {
    hits.sort((left, right) => {
      const leftMatch = left.object.userData.objectId === preferredObjectId ? 0 : 1;
      const rightMatch = right.object.userData.objectId === preferredObjectId ? 0 : 1;
      return leftMatch - rightMatch;
    });
  }
  for (const hit of hits) {
    const resolved = context.visualizer.resolveOverlayPick(hit.object, hit.instanceId);
    if (resolved && resolved.domain === domain) {
      const objectId = objectIdFromOverlay(hit.object);
      if (objectId) {
        return {
          domain,
          objectId,
          elementId: resolved.elementId,
          ...(resolved.domain === "vertex" ? { vertexId: resolved.elementId as VertexId } : {}),
          ...(resolved.domain === "edge" ? { edgeId: resolved.elementId as EdgeId } : {}),
          point: { x: hit.point.x, y: hit.point.y, z: hit.point.z },
          distance: hit.distance,
        };
      }
    }
  }
  const hit = hits.find((item) => !item.object.userData.overlayPick);
  if (!hit) {
    return null;
  }
  const objectId = hit.object.userData.objectId as ObjectId | undefined;
  const meshId = hit.object.userData.meshId as MeshId | undefined;
  if (!objectId) {
    return null;
  }
  const mapping = context.tracked.get(objectId)?.mapping;
  const faceId = mapping ? resolveFaceId(hit, mapping) : undefined;
  const kernel = meshId ? context.session.meshes.get(meshId) : undefined;
  const localToWorld = (local: Vector3): Vector3 => local.clone().applyMatrix4(hit.object.matrixWorld);
  const ndc = new Vector2(ndcX, ndcY);
  const point = { x: hit.point.x, y: hit.point.y, z: hit.point.z };

  if (domain === "object") {
    return {
      domain,
      objectId,
      elementId: objectId,
      point,
      distance: hit.distance,
      source: "cpu-raycast",
      ...(meshId ? { meshId } : {}),
    };
  }
  if (!faceId || !kernel) {
    return {
      domain: "object",
      objectId,
      elementId: objectId,
      point,
      distance: hit.distance,
      source: "cpu-raycast",
      ...(meshId ? { meshId } : {}),
    };
  }
  if (domain === "vertex") {
    const vertexId = pickVertexOnFace(
      kernel,
      faceId,
      hit.point,
      localToWorld,
      context.camera,
      ndc,
      context.viewport,
      pixelHitRadius,
    );
    return {
      domain: "vertex",
      objectId,
      elementId: vertexId ?? faceId,
      faceId,
      ...(vertexId ? { vertexId } : {}),
      point,
      distance: hit.distance,
    };
  }
  if (domain === "edge") {
    const edgeId = pickEdgeOnFace(
      kernel,
      faceId,
      hit.point,
      localToWorld,
      context.camera,
      ndc,
      context.viewport,
      pixelHitRadius,
    );
    return {
      domain: "edge",
      objectId,
      elementId: edgeId ?? faceId,
      faceId,
      ...(edgeId ? { edgeId } : {}),
      point,
      distance: hit.distance,
    };
  }
  return {
    domain: "face",
    objectId,
    elementId: faceId,
    faceId,
    point,
    distance: hit.distance,
    source: "cpu-raycast",
    ...(meshId ? { meshId } : {}),
    ...(typeof hit.faceIndex === "number" ? { triangleIndex: hit.faceIndex } : {}),
  };
}
