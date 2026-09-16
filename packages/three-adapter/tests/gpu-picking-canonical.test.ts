import { createSequenceIdFactory, brand } from "@modeling-kit/core";
import { CreatePrimitiveCommand, createModelingSession } from "@modeling-kit/commands";
import { MeshBuilder } from "@modeling-kit/mesh";
import { describe, expect, it } from "vitest";
import { DefaultGpuPickingService } from "../src/gpu-picking/service";
import { GpuPickIdTable } from "../src/gpu-picking/pick-id-table";
import { encodePickId } from "../src/gpu-picking/encode";
import { resolvedPickingOptions } from "../src/viewport-types";
import { drawableFromMesh, mountAdapter, perspective, centerRequest, pickMesh } from "./gpu-picking-helpers";

describe("canonical face GPU IDs", () => {
  it("allocates fewer IDs than render triangles for a cube", async () => {
    const mesh = MeshBuilder.createCube(2, 2, 2);
    const drawable = drawableFromMesh(mesh);
    const table = new GpuPickIdTable();
    table.rebuild([drawable], "face");
    expect(table.uniqueFaceIds).toBe(6);
    expect(table.triangleSlots).toBe(12);
    expect(table.size).toBe(6);
    const id0 = table.lookup(drawable.objectId, "face", 0);
    const id1 = table.lookup(drawable.objectId, "face", 1);
    expect(id0).toBe(id1);
    expect(id0).toBeDefined();
  });

  it("falls back to CPU when pick IDs overflow", async () => {
    const session = createModelingSession(createSequenceIdFactory("gpu-ovf"));
    session.execute(new CreatePrimitiveCommand("cube", { width: 2, height: 2, depth: 2 }));
    const adapter = mountAdapter(session);
    const tiny = {
      backgroundId: 0,
      maxId: 1,
      encodeToRgb: encodePickId,
      decodeFromRgb: () => 0,
    };
    const camera = perspective();
    const drawable = drawableFromMesh(MeshBuilder.createCube(2, 2, 2), brand<string, "ObjectId">("a"));
    const extra = drawableFromMesh(MeshBuilder.createCube(2, 2, 2), brand<string, "ObjectId">("b"));
    extra.object.position.set(0, 0, -3);
    extra.object.updateMatrixWorld(true);
    const service = new DefaultGpuPickingService({
      camera,
      readback: "software",
      codec: tiny,
      getDrawables: () => [drawable, extra],
    });
    const miss = await service.pick({
      pixelX: 400,
      pixelY: 299,
      viewportWidth: 800,
      viewportHeight: 600,
      domain: "object",
      backfaceMode: "front-and-back",
    });
    expect(service.diagnostics().idOverflow).toBe(true);
    expect(miss).toBeUndefined();
    service.dispose();
    adapter.dispose();
  });
});

describe("host picking options", () => {
  it("forwards gpu, xray, backface, and refine flags and can disable handlers", () => {
    expect(resolvedPickingOptions(false).enabled).toBe(false);
    const options = resolvedPickingOptions({
      gpuPicking: false,
      xray: true,
      selectThrough: true,
      backfaceMode: "front-and-back",
      refineSurfacePoint: true,
      clickBackend: "cpu",
    });
    expect(options.enabled).toBe(true);
    expect(options.gpuPicking).toBe(false);
    expect(options.xray).toBe(true);
    expect(options.selectThrough).toBe(true);
    expect(options.backfaceMode).toBe("front-and-back");
    expect(options.refineSurfacePoint).toBe(true);
    expect(options.clickBackend).toBe("cpu");
    expect(options.hoverBackend).toBe("cpu");
  });

  it("returns a real surface point when refinement is requested", async () => {
    const session = createModelingSession(createSequenceIdFactory("gpu-surf"));
    const cube = session.execute(new CreatePrimitiveCommand("cube", { width: 2, height: 2, depth: 2 }));
    const adapter = mountAdapter(session);
    const hit = await adapter.pickPoint({
      ...centerRequest("face"),
      purpose: "knife",
      requireSurfacePoint: true,
    });
    expect(hit?.kind).toBe("surface");
    if (hit?.kind === "surface") {
      expect(hit.faceId).toBe(cube.faceIds.posZ);
      expect(Number.isFinite(hit.worldPoint.x)).toBe(true);
      expect(hit.worldPoint.z).not.toBe(0);
    }
    adapter.dispose();
  });
});

describe("n-gon GPU identity", () => {
  it("maps every triangle of an n-gon to one FaceId", async () => {
    const builder = new MeshBuilder();
    const v0 = builder.addVertex(-2, -2, 0);
    const v1 = builder.addVertex(2, -2, 0);
    const v2 = builder.addVertex(2, 1, 0);
    const v3 = builder.addVertex(0, 1, 0);
    const v4 = builder.addVertex(0, 2, 0);
    const v5 = builder.addVertex(-2, 2, 0);
    const face = builder.addFace([v0, v1, v2, v3, v4, v5]);
    const hit = await pickMesh(builder.getMesh(), "face");
    expect(hit?.faceId).toBe(face);
  });
});
