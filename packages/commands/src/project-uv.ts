import { brand, type FaceId, type MeshId } from "@modeling-kit/core";
import type { Command, CommandContext } from "@modeling-kit/history";
import { restoreMesh, serializeMesh, type SerializedMesh } from "@modeling-kit/mesh";
import {
  projectBoxUv,
  projectCylindricalUv,
  projectPlanarUv,
  projectSphericalUv,
  type BoxProjectionOptions,
  type CylindricalProjectionOptions,
  type PlanarProjectionOptions,
  type SphericalProjectionOptions,
} from "@modeling-kit/uv";

export type ProjectUvMode =
  | { readonly type: "planar"; readonly options: PlanarProjectionOptions }
  | { readonly type: "box"; readonly options?: BoxProjectionOptions }
  | { readonly type: "cylindrical"; readonly options?: CylindricalProjectionOptions }
  | { readonly type: "spherical"; readonly options?: SphericalProjectionOptions };

export interface ProjectUvParams {
  readonly mode: ProjectUvMode;
  readonly faceIds?: readonly FaceId[];
}

export class ProjectUvCommand implements Command<void> {
  readonly id = crypto.randomUUID();
  readonly label = "Project UV";
  private before: SerializedMesh | null = null;
  private after: SerializedMesh | null = null;
  private meshId: MeshId | null = null;

  constructor(readonly params: ProjectUvParams) {}

  execute(context: CommandContext): void {
    if (this.after && this.meshId) {
      const mesh = context.meshes.get(this.meshId);
      if (mesh) {
        restoreMesh(mesh, this.after);
        context.syncMesh(mesh.id);
      }
      return;
    }

    const objectId = context.selection.objectIds[0];
    if (!objectId) {
      throw new RangeError("ProjectUvCommand requires an object selection");
    }
    const node = context.document.scene.nodes.get(objectId);
    const meshId = node?.payloadRef ? brand<string, "MeshId">(node.payloadRef) : undefined;
    const mesh = meshId ? context.meshes.get(meshId) : undefined;
    if (!mesh || !meshId) {
      throw new RangeError("ProjectUvCommand could not resolve a mesh");
    }

    const faceIds =
      this.params.faceIds ??
      (context.selection.elementIds.length > 0
        ? (context.selection.elementIds as FaceId[])
        : undefined);

    this.before = serializeMesh(mesh);
    this.meshId = meshId;

    switch (this.params.mode.type) {
      case "planar":
        projectPlanarUv(mesh, { ...this.params.mode.options, faceIds });
        break;
      case "box":
        projectBoxUv(mesh, { ...this.params.mode.options, faceIds });
        break;
      case "cylindrical":
        projectCylindricalUv(mesh, { ...this.params.mode.options, faceIds });
        break;
      case "spherical":
        projectSphericalUv(mesh, { ...this.params.mode.options, faceIds });
        break;
    }

    this.after = serializeMesh(mesh);
    context.syncMesh(mesh.id);
    context.events.emit("mesh:changed", { meshIds: [mesh.id] });
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
    context.syncMesh(mesh.id);
    context.events.emit("mesh:changed", { meshIds: [mesh.id] });
  }

  redo(context: CommandContext): void {
    this.execute(context);
  }
}
