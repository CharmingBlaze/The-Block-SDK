import { createSequenceIdFactory } from "@modeling-kit/core";
import {
  AssignMaterialCommand,
  CreateClipCommand,
  CreateMaterialCommand,
  CreatePrimitiveCommand,
  CreateSkeletonCommand,
  DuplicateObjectsCommand,
  ReparentCommand,
  SetKeyframeCommand,
  SetTransformsCommand,
  UpdateMaterialCommand,
  createModelingSession,
} from "@modeling-kit/commands";
import { describe, expect, it } from "vitest";
import { Mesh, MeshStandardMaterial, PerspectiveCamera, Scene } from "three";
import { ThreeViewportAdapter } from "../src/index";
import { SceneDirtyFlag } from "../src/scene-sync";

function stubRenderer() {
  return {
    setSize: () => undefined,
    setPixelRatio: () => undefined,
  };
}

describe("ThreeViewportAdapter", () => {
  it("syncs one session into four viewports and picks a canonical face", () => {
    const session = createModelingSession(createSequenceIdFactory("vp"));
    const cube = session.execute(
      new CreatePrimitiveCommand("cube", { width: 2, height: 2, depth: 2 }),
    );
    const cameras = [0, 1, 2, 3].map(() => {
      const camera = new PerspectiveCamera(50, 1, 0.1, 100);
      camera.position.set(0, 0, 8);
      camera.lookAt(0, 0, 0);
      camera.updateMatrixWorld();
      return camera;
    });
    const adapters = cameras.map(
      (camera) =>
        new ThreeViewportAdapter({
          session,
          scene: new Scene(),
          camera,
          renderer: stubRenderer(),
        }),
    );
    for (const adapter of adapters) {
      adapter.mount();
      expect(adapter.root.getObjectByName("Cube")).toBeInstanceOf(Mesh);
    }

    const hit = adapters[0]!.pick(0, 0, { domain: "face" });
    expect(hit?.objectId).toBe(cube.objectId);
    expect(hit?.faceId).toBe(cube.faceIds.posZ);
    const t0 = performance.now();
    for (const adapter of adapters) {
      adapter.pick(0, 0, { domain: "face" });
    }
    expect(performance.now() - t0).toBeLessThan(250);

    session.selection.replace({
      domain: "face",
      objectId: cube.objectId,
      elementIds: [cube.faceIds.top],
    });
    const overlay = adapters[0]!.root.getObjectByName("selection-overlay") as Mesh;
    expect(overlay.userData.overlayKind).toBe("face");
    expect(overlay.userData.triangleCount).toBe(2);

    adapters.forEach((adapter) => adapter.dispose());
    expect(adapters[0]!.root.parent).toBeNull();
    expect(() => adapters[0]!.sync()).toThrow(/disposed/);
  });

  it("applies document PBR color to the viewport mesh", () => {
    const session = createModelingSession(createSequenceIdFactory("pbr-view"));
    const cube = session.execute(
      new CreatePrimitiveCommand("cube", { width: 1, height: 1, depth: 1 }),
    );
    const materialId = session.execute(
      new CreateMaterialCommand({ name: "Red", baseColor: [1, 0, 0, 1] }),
    );
    session.selection.replace({ domain: "object", objectId: cube.objectId, elementIds: [] });
    session.execute(new AssignMaterialCommand({ materialId }));
    const scene = new Scene();
    const camera = new PerspectiveCamera(50, 1, 0.1, 100);
    const adapter = new ThreeViewportAdapter({
      session,
      scene,
      camera,
      renderer: stubRenderer(),
    });
    adapter.mount();
    const mesh = adapter.root.getObjectByName("Cube") as Mesh;
    const material = mesh.material as MeshStandardMaterial;
    expect(material.color.r).toBeCloseTo(1);
    expect(material.color.g).toBeCloseTo(0);
    adapter.dispose();
  });

  it("applies clip pose to bone scene nodes without writing rest transforms", () => {
    const session = createModelingSession(createSequenceIdFactory("bone-pose"));
    const skeleton = session.execute(new CreateSkeletonCommand({ name: "Armature" }));
    const boneId = session.document.skeletons.get(skeleton.skeletonId)!.bones[0]!.id;
    const clipId = session.execute(new CreateClipCommand({ name: "Lift", duration: 1 }));
    session.execute(
      new SetKeyframeCommand({
        clipId,
        targetKind: "bone",
        targetId: boneId,
        channel: "position",
        time: 1,
        value: [0, 3, 0],
      }),
    );
    const clip = session.document.animations.get(clipId)!;
    const adapter = new ThreeViewportAdapter({
      session,
      scene: new Scene(),
      camera: new PerspectiveCamera(50, 1, 0.1, 100),
      renderer: stubRenderer(),
    });
    adapter.mount();
    const boneObject = adapter.root.getObjectByName("Root");
    expect(boneObject?.position.y).toBeCloseTo(0);
    session.applyClip(clip, 1, skeleton.skeletonId);
    expect(boneObject?.position.y).toBeCloseTo(3);
    expect(
      session.document.scene.nodes.get(skeleton.boneObjectIds[boneId]!)?.localTransform.position.y,
    ).toBe(0);
    adapter.dispose();
  });

  it("shares geometry for linked instances and updates transforms without rebuilding it", () => {
    const session = createModelingSession(createSequenceIdFactory("link-view"));
    const cube = session.execute(new CreatePrimitiveCommand("cube", { width: 1, height: 1, depth: 1 }));
    session.execute(new DuplicateObjectsCommand({ objectId: cube.objectId, linkMeshes: true }));
    const adapter = new ThreeViewportAdapter({
      session,
      scene: new Scene(),
      camera: new PerspectiveCamera(50, 1, 0.1, 100),
      renderer: stubRenderer(),
    });
    adapter.mount();
    expect(adapter.runtimeGeometryCount).toBe(1);
    const before = adapter.runtimeGeometryCount;
    session.execute(
      new SetTransformsCommand({
        objects: [
          {
            objectId: cube.objectId,
            before: session.document.scene.nodes.get(cube.objectId)!.localTransform,
            after: {
              position: { x: 2, y: 0, z: 0 },
              rotation: { x: 0, y: 0, z: 0, w: 1 },
              scale: { x: 1, y: 1, z: 1 },
            },
          },
        ],
      }),
    );
    expect(adapter.runtimeGeometryCount).toBe(before);
    adapter.dispose();
    expect(adapter.nodeObjects.size).toBe(0);
  });

  it("updates vertex position buffers without allocating a new BufferGeometry", () => {
    const session = createModelingSession(createSequenceIdFactory("pos-view"));
    const cube = session.execute(new CreatePrimitiveCommand("cube", { width: 1, height: 1, depth: 1 }));
    const adapter = new ThreeViewportAdapter({
      session,
      scene: new Scene(),
      camera: new PerspectiveCamera(50, 1, 0.1, 100),
      renderer: stubRenderer(),
    });
    adapter.mount();
    const object = adapter.object3D(cube.objectId);
    expect(object).toBeInstanceOf(Mesh);
    const meshObject = object as Mesh;
    const geometry = meshObject.geometry;
    const kernel = session.meshes.get(cube.meshId)!;
    const vertexId = [...kernel.vertices.keys()][0]!;
    const origin = kernel.vertices.get(vertexId)!.position;
    session.execute(
      new SetTransformsCommand({
        vertices: [
          {
            meshId: cube.meshId,
            vertexId,
            before: [origin[0], origin[1], origin[2]],
            after: [origin[0] + 0.4, origin[1], origin[2]],
          },
        ],
      }),
    );
    expect(meshObject.geometry).toBe(geometry);
    expect(adapter.runtimeGeometryCount).toBe(1);
    adapter.dispose();
  });

  it("reparents runtime objects and coalesces deferred flushes", () => {
    const session = createModelingSession(createSequenceIdFactory("hier-view"));
    const cube = session.execute(new CreatePrimitiveCommand("cube", { width: 1, height: 1, depth: 1 }));
    const group = session.execute(new CreatePrimitiveCommand("cube", { width: 1, height: 1, depth: 1 }));
    const adapter = new ThreeViewportAdapter({
      session,
      scene: new Scene(),
      camera: new PerspectiveCamera(50, 1, 0.1, 100),
      renderer: stubRenderer(),
      autoFlush: false,
    });
    adapter.mount();
    session.execute(new ReparentCommand({ objectId: cube.objectId, newParentId: group.objectId }));
    adapter.markDirty(SceneDirtyFlag.Hierarchy);
    adapter.markDirty(SceneDirtyFlag.Visibility);
    const before = adapter.flushCount;
    adapter.flushPending();
    expect(adapter.flushCount).toBe(before + 1);
    const child = adapter.object3D(cube.objectId);
    const parent = adapter.object3D(group.objectId);
    expect(child?.parent).toBe(parent);
    adapter.dispose();
    adapter.dispose();
  });

  it("updates runtime materials without growing geometry handles", () => {
    const session = createModelingSession(createSequenceIdFactory("mat-view"));
    session.execute(new CreatePrimitiveCommand("cube", { width: 1, height: 1, depth: 1 }));
    const materialId = session.execute(new CreateMaterialCommand({ name: "Red", baseColor: [1, 0, 0, 1] }));
    const adapter = new ThreeViewportAdapter({
      session,
      scene: new Scene(),
      camera: new PerspectiveCamera(50, 1, 0.1, 100),
      renderer: stubRenderer(),
    });
    adapter.mount();
    const before = adapter.runtimeGeometryCount;
    session.execute(new UpdateMaterialCommand({ materialId, patch: { baseColor: [0, 1, 0, 1] } }));
    expect(adapter.runtimeGeometryCount).toBe(before);
    const diag = adapter.resourceDiagnostics();
    adapter.dispose();
    expect(adapter.resourceDiagnostics().runtimeGeometries).toBe(0);
    expect(diag.subscriptions).toBeGreaterThan(0);
  });

  it("keeps two viewports independent", () => {
    const session = createModelingSession(createSequenceIdFactory("multi-view"));
    session.execute(new CreatePrimitiveCommand("cube", { width: 1, height: 1, depth: 1 }));
    const a = new ThreeViewportAdapter({
      session,
      scene: new Scene(),
      camera: new PerspectiveCamera(),
      renderer: stubRenderer(),
      viewportId: "a",
    });
    const b = new ThreeViewportAdapter({
      session,
      scene: new Scene(),
      camera: new PerspectiveCamera(),
      renderer: stubRenderer(),
      viewportId: "b",
    });
    a.mount();
    b.mount();
    expect(a.viewportId).not.toBe(b.viewportId);
    a.dispose();
    expect(() => b.sync()).not.toThrow();
    b.dispose();
  });

  it("disposes an owned SpatialQueryBackend exactly once", () => {
    const session = createModelingSession(createSequenceIdFactory("spatial-own"));
    session.execute(new CreatePrimitiveCommand("cube", { width: 1, height: 1, depth: 1 }));
    let disposeCount = 0;
    const adapter = new ThreeViewportAdapter({
      session,
      scene: new Scene(),
      camera: new PerspectiveCamera(),
      renderer: stubRenderer(),
      ownsSpatialQuery: true,
      spatialQuery: {
        raycast: () => null,
        dispose: () => {
          disposeCount += 1;
        },
      },
    });
    adapter.mount();
    adapter.dispose();
    adapter.dispose();
    expect(disposeCount).toBe(1);
  });

  it("rebuilds and disposes derived geometry for a library primitive", () => {
    const session = createModelingSession(createSequenceIdFactory("lib-geo"));
    const created = session.execute(new CreatePrimitiveCommand("tetrahedron", { radius: 0.5 }));
    const adapter = new ThreeViewportAdapter({
      session,
      scene: new Scene(),
      camera: new PerspectiveCamera(50, 1, 0.1, 100),
      renderer: stubRenderer(),
    });
    adapter.mount();
    const mesh = adapter.object3D(created.objectId) as Mesh;
    expect(mesh).toBeInstanceOf(Mesh);
    const geometry = mesh.geometry;
    expect(geometry.getAttribute("position")).toBeTruthy();
    expect(geometry.getAttribute("normal")).toBeTruthy();
    expect(geometry.getAttribute("uv")).toBeTruthy();
    expect(geometry.getIndex()).toBeTruthy();
    expect(geometry.boundingBox).toBeTruthy();
    expect(geometry.boundingSphere).toBeTruthy();
    const before = adapter.runtimeGeometryCount;
    session.execute(new CreatePrimitiveCommand("quad", { scale: 0.5 }));
    expect(adapter.runtimeGeometryCount).toBe(before + 1);
    adapter.dispose();
    expect(adapter.nodeObjects.size).toBe(0);
    expect(() => adapter.sync()).toThrow(/disposed/);
  });
});
