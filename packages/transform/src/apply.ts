import type { ObjectId } from "@modeling-kit/core";
import type { ModelDocument, SceneNode } from "@modeling-kit/document";
import {
  Matrix4,
  Quaternion,
  Vector3,
  identityTransform,
  matrixToTransform,
  transformToMatrix,
  type TransformData,
  type Vec3,
} from "@modeling-kit/math";
import { getNode, isDescendant, setLocalTransform, worldMatrix } from "@modeling-kit/scene";
import { snapAngle, snapToGrid, snapVectorIncrement } from "@modeling-kit/snapping";
import type { TransformDelta, TransformPivot, TransformRequest, TransformSpace } from "./types";

export function cloneTransform(transform: TransformData): TransformData {
  return {
    position: { ...transform.position },
    rotation: { ...transform.rotation },
    scale: { ...transform.scale },
  };
}

export function transformsNearlyEqual(a: TransformData, b: TransformData, epsilon = 1e-6): boolean {
  return (
    Quaternion.from(a.rotation).equals(b.rotation, epsilon) &&
    Math.abs(a.position.x - b.position.x) <= epsilon &&
    Math.abs(a.position.y - b.position.y) <= epsilon &&
    Math.abs(a.position.z - b.position.z) <= epsilon &&
    Math.abs(a.scale.x - b.scale.x) <= epsilon &&
    Math.abs(a.scale.y - b.scale.y) <= epsilon &&
    Math.abs(a.scale.z - b.scale.z) <= epsilon
  );
}

export function selectionRoots(document: ModelDocument, ids: readonly ObjectId[]): ObjectId[] {
  return ids.filter(
    (id) => !ids.some((other) => other !== id && isDescendant(document, other, id)),
  );
}

export function worldPositionOf(document: ModelDocument, id: ObjectId): Vector3 {
  return worldMatrix(document, id).transformPoint(new Vector3(0, 0, 0));
}

export function computePivot(
  document: ModelDocument,
  roots: readonly ObjectId[],
  pivot: TransformPivot,
  cursor?: Vec3,
): Vector3 {
  if (pivot === "cursor" && cursor) {
    return Vector3.from(cursor);
  }
  if (roots.length === 0) {
    return Vector3.zero;
  }
  if (pivot === "individual" || pivot === "active") {
    return worldPositionOf(document, roots[0]!);
  }
  const points = roots.map((id) => worldPositionOf(document, id));
  if (pivot === "bounds") {
    let minX = Infinity;
    let minY = Infinity;
    let minZ = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let maxZ = -Infinity;
    for (const point of points) {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      minZ = Math.min(minZ, point.z);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
      maxZ = Math.max(maxZ, point.z);
    }
    return new Vector3((minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2);
  }
  let sum = Vector3.zero;
  for (const point of points) {
    sum = sum.add(point);
  }
  return sum.scale(1 / points.length);
}

function parentWorldMatrix(document: ModelDocument, node: SceneNode): Matrix4 {
  if (!node.parentId) {
    return transformToMatrix(identityTransform());
  }
  return worldMatrix(document, node.parentId);
}

function spaceRotation(
  document: ModelDocument,
  node: SceneNode,
  space: TransformSpace,
  baselineWorld: Matrix4,
  request: TransformRequest,
): Quaternion {
  if (space === "world") {
    return Quaternion.identity;
  }
  if (space === "view") {
    return request.viewRotation ? Quaternion.from(request.viewRotation) : Quaternion.identity;
  }
  if (space === "normal") {
    const normal = request.normal ?? { x: 0, y: 1, z: 0 };
    return Quaternion.fromTo({ x: 0, y: 1, z: 0 }, normal);
  }
  if (space === "parent") {
    return parentWorldMatrix(document, node).decompose().rotation;
  }
  return baselineWorld.decompose().rotation;
}

function constrain(vector: Vector3, axis?: Vec3): Vector3 {
  if (!axis) {
    return vector;
  }
  const unit = Vector3.from(axis).normalize();
  return unit.scale(vector.dot(unit));
}

export function deltaMatrix(
  document: ModelDocument,
  node: SceneNode,
  baselineWorld: Matrix4,
  request: TransformRequest,
  delta: TransformDelta,
  pivotWorld: Vector3,
): Matrix4 {
  const space = request.space ?? "parent";
  const mode = request.mode;
  const orientation = spaceRotation(document, node, space, baselineWorld, request);
  const pivot =
    request.pivot === "individual"
      ? baselineWorld.transformPoint(new Vector3(0, 0, 0))
      : pivotWorld;

  if (mode === "translate") {
    let translation = constrain(Vector3.from(delta.translation ?? Vector3.zero), request.axis);
    translation = orientation.rotateVector(translation);
    if (request.snap?.increment) {
      translation = snapVectorIncrement(translation, request.snap.increment);
    }
    if (request.snap?.grid) {
      const origin = baselineWorld.transformPoint(new Vector3(0, 0, 0));
      const snapped = snapToGrid(origin.add(translation), request.snap.grid);
      translation = snapped.sub(origin);
    }
    return Matrix4.translation(translation);
  }

  if (mode === "rotate") {
    const raw = delta.rotation ?? { axis: { x: 0, y: 1, z: 0 }, angle: 0 };
    const angle = request.snap?.angle ? snapAngle(raw.angle, request.snap.angle) : raw.angle;
    const axisLocal = request.axis ?? raw.axis;
    const axisWorld = orientation.rotateVector(Vector3.from(axisLocal)).normalize();
    const rotation = Matrix4.fromQuaternion(Quaternion.fromAxisAngle(axisWorld, angle));
    const toPivot = Matrix4.translation(pivot);
    const fromPivot = Matrix4.translation(pivot.negate());
    return toPivot.multiply(rotation).multiply(fromPivot);
  }

  const scale = delta.scale ?? { x: 1, y: 1, z: 1 };
  const scaling = Matrix4.scaling(scale);
  const toPivot = Matrix4.translation(pivot);
  const fromPivot = Matrix4.translation(pivot.negate());
  return toPivot.multiply(scaling).multiply(fromPivot);
}

export function applyWorldToLocal(
  document: ModelDocument,
  objectId: ObjectId,
  world: Matrix4,
): TransformData {
  const node = getNode(document, objectId);
  const parent = parentWorldMatrix(document, node);
  return matrixToTransform(parent.invert().multiply(world));
}

export function writeObjectWorld(
  document: ModelDocument,
  objectId: ObjectId,
  world: Matrix4,
): void {
  setLocalTransform(document, objectId, applyWorldToLocal(document, objectId, world));
}
