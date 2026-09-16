import type { ObjectId } from "@modeling-kit/core";
import type { PickBackfaceMode } from "@modeling-kit/selection";
import { DoubleSide, FrontSide, Mesh, Scene, type ShaderMaterial } from "three";
import { GPU_PICK_BACKGROUND_ID } from "./encode";
import { createFacePickingGeometry } from "./face-geometry";
import { createFacePickingMaterial, createObjectPickingMaterial, setObjectPickColor } from "./material";
import type { GpuPickDomain } from "./registry";
import type { GpuPickDrawable } from "./types";

interface FaceEntry {
  mesh: Mesh;
  geometryRevision: number;
}

export class GpuPickScene {
  readonly scene = new Scene();
  private readonly objectMeshes = new Map<ObjectId, Mesh>();
  private readonly faceEntries = new Map<ObjectId, FaceEntry>();
  private readonly ownedMaterials: ShaderMaterial[] = [];

  constructor() {
    this.scene.background = null;
    this.scene.fog = null;
  }

  sync(
    drawables: readonly GpuPickDrawable[],
    domain: GpuPickDomain,
    backfaceMode: PickBackfaceMode,
    lookup: (objectId: ObjectId, triangleIndex: number) => number | undefined,
  ): void {
    const live = new Set<ObjectId>();
    const side = backfaceMode === "front-and-back" ? DoubleSide : FrontSide;
    for (const drawable of drawables) {
      drawable.object.updateMatrixWorld(true);
      live.add(drawable.objectId);
      if (domain === "object") {
        this.syncObjectMesh(drawable, backfaceMode, side, lookup);
        continue;
      }
      this.syncFaceMesh(drawable, backfaceMode, side, lookup);
    }
    for (const [objectId, mesh] of this.objectMeshes) {
      if (domain !== "object" || !live.has(objectId)) {
        mesh.visible = false;
      }
    }
    for (const [objectId, entry] of this.faceEntries) {
      if (domain !== "face" || !live.has(objectId)) {
        entry.mesh.visible = false;
      }
    }
  }

  dispose(): void {
    for (const mesh of this.objectMeshes.values()) {
      mesh.removeFromParent();
    }
    this.objectMeshes.clear();
    for (const entry of this.faceEntries.values()) {
      entry.mesh.removeFromParent();
      entry.mesh.geometry.dispose();
    }
    this.faceEntries.clear();
    for (const material of this.ownedMaterials) {
      material.dispose();
    }
    this.ownedMaterials.length = 0;
  }

  private syncObjectMesh(
    drawable: GpuPickDrawable,
    backfaceMode: PickBackfaceMode,
    side: typeof FrontSide | typeof DoubleSide,
    lookup: (objectId: ObjectId, triangleIndex: number) => number | undefined,
  ): void {
    const pickId = lookup(drawable.objectId, 0);
    if (pickId === undefined) {
      return;
    }
    let mesh = this.objectMeshes.get(drawable.objectId);
    if (!mesh) {
      const material = createObjectPickingMaterial(pickId, backfaceMode);
      this.ownedMaterials.push(material);
      mesh = new Mesh(drawable.geometry, material);
      mesh.frustumCulled = false;
      mesh.matrixAutoUpdate = false;
      this.scene.add(mesh);
      this.objectMeshes.set(drawable.objectId, mesh);
    } else {
      setObjectPickColor(mesh.material as ShaderMaterial, pickId);
      (mesh.material as ShaderMaterial).side = side;
      mesh.geometry = drawable.geometry;
    }
    mesh.matrix.copy(drawable.object.matrixWorld);
    mesh.matrixWorld.copy(drawable.object.matrixWorld);
    mesh.visible = true;
  }

  private syncFaceMesh(
    drawable: GpuPickDrawable,
    backfaceMode: PickBackfaceMode,
    side: typeof FrontSide | typeof DoubleSide,
    lookup: (objectId: ObjectId, triangleIndex: number) => number | undefined,
  ): void {
    let entry = this.faceEntries.get(drawable.objectId);
    if (!entry || entry.geometryRevision !== drawable.geometryRevision) {
      if (entry) {
        entry.mesh.removeFromParent();
        entry.mesh.geometry.dispose();
      }
      const geometry = createFacePickingGeometry(drawable.geometry, drawable.mapping, (triangleIndex) => {
        return lookup(drawable.objectId, triangleIndex) ?? GPU_PICK_BACKGROUND_ID;
      });
      const material = createFacePickingMaterial(backfaceMode);
      this.ownedMaterials.push(material);
      const mesh = new Mesh(geometry, material);
      mesh.frustumCulled = false;
      mesh.matrixAutoUpdate = false;
      this.scene.add(mesh);
      entry = { mesh, geometryRevision: drawable.geometryRevision };
      this.faceEntries.set(drawable.objectId, entry);
    } else {
      (entry.mesh.material as ShaderMaterial).side = side;
    }
    entry.mesh.matrix.copy(drawable.object.matrixWorld);
    entry.mesh.matrixWorld.copy(drawable.object.matrixWorld);
    entry.mesh.visible = true;
  }
}
