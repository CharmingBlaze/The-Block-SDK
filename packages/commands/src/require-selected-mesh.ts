import { brand, type MeshId, type ObjectId } from "@modeling-kit/core";
import type { CommandContext } from "@modeling-kit/history";
import type { HalfEdgeMesh } from "@modeling-kit/mesh";

export function requireSelectedMesh(context: CommandContext): {
  objectId: ObjectId;
  meshId: MeshId;
  mesh: HalfEdgeMesh;
} {
  const objectId = context.selection.objectIds[0];
  if (!objectId) {
    throw new RangeError("A mesh object must be selected");
  }
  const node = context.document.scene.nodes.get(objectId);
  const meshId = node?.payloadRef ? brand<string, "MeshId">(node.payloadRef) : undefined;
  const mesh = meshId ? context.meshes.get(meshId) : undefined;
  if (!mesh || !meshId) {
    throw new RangeError("The selected object does not resolve to a mesh");
  }
  return { objectId, meshId, mesh };
}
