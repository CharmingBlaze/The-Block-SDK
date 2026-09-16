import { createSequenceIdFactory } from "@modeling-kit/core";
import { CreatePrimitiveCommand, createModelingSession } from "@modeling-kit/commands";
import { MeshBuilder } from "@modeling-kit/mesh";
import { generateQuadSphere, generateTorus, generateUvSphere } from "@modeling-kit/primitives";
import { describe, expect, it } from "vitest";
import { OrthographicCamera } from "three";
import { centerRequest, mountAdapter, perspective, pickMesh } from "./gpu-picking-helpers";

describe("GPU ID-buffer face picking", () => {
  it("resolves the cube front face and both quad triangles to the same FaceId", async () => {
    const session = createModelingSession(createSequenceIdFactory("gpu-face"));
    const cube = session.execute(new CreatePrimitiveCommand("cube", { width: 2, height: 2, depth: 2 }));
    const adapter = mountAdapter(session);
    const left = await adapter.pickPoint({ ...centerRequest("face"), clientX: 360 });
    const right = await adapter.pickPoint({ ...centerRequest("face"), clientX: 440 });
    expect(left?.faceId).toBe(cube.faceIds.posZ);
    expect(right?.faceId).toBe(cube.faceIds.posZ);
    expect(left?.kind).toBe("identity");
    expect("worldPoint" in (left ?? {})).toBe(false);
    adapter.dispose();
  });

  it("maps triangle, concave n-gon, UV sphere, quad sphere, and torus hits to live FaceIds", async () => {
    const triangle = new MeshBuilder();
    const tv0 = triangle.addVertex(-1, -1, 0);
    const tv1 = triangle.addVertex(1, -1, 0);
    const tv2 = triangle.addVertex(0, 1, 0);
    const triangleFace = triangle.addFace([tv0, tv1, tv2]);
    const triHit = await pickMesh(triangle.getMesh(), "face");
    expect(triHit?.faceId).toBe(triangleFace);

    const builder = new MeshBuilder();
    const v0 = builder.addVertex(-2, -2, 0);
    const v1 = builder.addVertex(2, -2, 0);
    const v2 = builder.addVertex(2, 1, 0);
    const v3 = builder.addVertex(0, 1, 0);
    const v4 = builder.addVertex(0, 2, 0);
    const v5 = builder.addVertex(-2, 2, 0);
    const ngonFace = builder.addFace([v0, v1, v2, v3, v4, v5]);
    const ngonHit = await pickMesh(builder.getMesh(), "face");
    expect(ngonHit?.faceId).toBe(ngonFace);

    for (const mesh of [
      generateUvSphere({ radius: 1, widthSegments: 8, heightSegments: 6 }).mesh,
      generateQuadSphere({ radius: 1, segments: 3 }).mesh,
      generateTorus({ radius: 1, tube: 0.4, radialSegments: 8, tubularSegments: 12 }).mesh,
    ]) {
      const hit = await pickMesh(mesh, "face");
      expect(hit?.faceId).toBeDefined();
      expect(mesh.faces.has(hit!.faceId!)).toBe(true);
    }
  });

  it("honors backface policy and near/far clipping", async () => {
    const triangle = new MeshBuilder();
    const v0 = triangle.addVertex(-1, -1, 0);
    const v1 = triangle.addVertex(1, -1, 0);
    const v2 = triangle.addVertex(0, 1, 0);
    triangle.addFace([v0, v1, v2]);
    const mesh = triangle.getMesh();
    const behind = perspective(-8);
    expect(await pickMesh(mesh, "face", behind, "front-only")).toBeUndefined();
    expect((await pickMesh(mesh, "face", behind, "front-and-back"))?.faceId).toBeDefined();
    const cube = MeshBuilder.createCube(2, 2, 2);
    expect(await pickMesh(cube, "face", perspective(8, 20, 100))).toBeUndefined();
    expect(await pickMesh(cube, "face", perspective(8, 0.1, 1))).toBeUndefined();
  });

  it("uses an orthographic camera for the same front face", async () => {
    const session = createModelingSession(createSequenceIdFactory("gpu-ortho"));
    const cube = session.execute(new CreatePrimitiveCommand("cube", { width: 2, height: 2, depth: 2 }));
    const camera = new OrthographicCamera(-2, 2, 1.5, -1.5, 0.1, 100);
    camera.position.set(0, 0, 8);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    camera.updateProjectionMatrix();
    const adapter = mountAdapter(session, camera);
    expect((await adapter.pickPoint(centerRequest("face")))?.faceId).toBe(cube.faceIds.posZ);
    adapter.dispose();
  });
});
