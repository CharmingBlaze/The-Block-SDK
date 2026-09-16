import { createSequenceIdFactory } from "@modeling-kit/core";
import { CreatePrimitiveCommand, createModelingSession } from "@modeling-kit/commands";
import { MeshBuilder } from "@modeling-kit/mesh";
import { applyPointPickToSelection } from "@modeling-kit/selection";
import { describe, expect, it } from "vitest";
import { DefaultGpuPickingService } from "../src/gpu-picking/service";
import type { GpuPickDrawable } from "../src/gpu-picking/types";
import {
  centerPickRequest,
  centerRequest,
  drawableFromMesh,
  mountAdapter,
  perspective,
} from "./gpu-picking-helpers";

describe("GPU picking lifecycle and fallback", () => {
  it("rebuilds picking data on topology change, not on camera motion", async () => {
    const drawable = drawableFromMesh(MeshBuilder.createCube(2, 2, 2));
    const camera = perspective();
    const service = new DefaultGpuPickingService({
      camera,
      readback: "software",
      getDrawables: () => [drawable],
    });
    const request = centerPickRequest("face");
    await service.pick(request);
    const builds = service.diagnostics().geometryBuilds;
    camera.position.set(0, 0, 9);
    camera.updateMatrixWorld();
    service.invalidate("camera");
    await service.pick(request);
    expect(service.diagnostics().geometryBuilds).toBe(builds);
    service.invalidate("geometry");
    await service.pick(request);
    expect(service.diagnostics().geometryBuilds).toBeGreaterThan(builds);
    service.dispose();
    service.dispose();
    expect(service.diagnostics().disposed).toBe(true);
    expect(await service.pick(request)).toBeUndefined();
  });

  it("falls back to CPU raycasting for x-ray, select-through, and vertex/edge domains", async () => {
    const session = createModelingSession(createSequenceIdFactory("gpu-fb"));
    const cube = session.execute(new CreatePrimitiveCommand("cube", { width: 2, height: 2, depth: 2 }));
    const adapter = mountAdapter(session);
    const xray = await adapter.pickPoint({ ...centerRequest("face"), xray: true });
    expect(adapter.lastPickSource).toBe("cpu-raycast");
    expect(xray?.objectId).toBe(cube.objectId);
    const through = await adapter.pickPoint({ ...centerRequest("face"), selectThrough: true });
    expect(adapter.lastPickSource).toBe("cpu-raycast");
    expect(through?.objectId).toBe(cube.objectId);
    const vertex = await adapter.pickPoint({ ...centerRequest("vertex") });
    expect(adapter.lastPickSource).toBe("cpu-raycast");
    expect(vertex?.domain).toBe("vertex");
    adapter.dispose();
  });

  it("keeps CPU picking when GPU picking is off and still applies selection", async () => {
    const session = createModelingSession(createSequenceIdFactory("gpu-off"));
    const cube = session.execute(new CreatePrimitiveCommand("cube", { width: 2, height: 2, depth: 2 }));
    const adapter = mountAdapter(session, perspective(), "off");
    const hit = await adapter.pickPoint(centerRequest("face"));
    expect(adapter.lastPickSource).toBe("cpu-raycast");
    expect(hit?.faceId).toBe(cube.faceIds.posZ);
    applyPointPickToSelection(session.selection, hit);
    expect(session.selection.elementIds).toEqual([cube.faceIds.posZ]);
    adapter.dispose();
    adapter.dispose();
  });

  it("invalidates picks after object deletion", async () => {
    const drawable = drawableFromMesh(MeshBuilder.createCube(2, 2, 2));
    let drawables: GpuPickDrawable[] = [drawable];
    const service = new DefaultGpuPickingService({
      camera: perspective(),
      readback: "software",
      getDrawables: () => drawables,
    });
    const request = centerPickRequest("object");
    expect((await service.pick(request))?.objectId).toBe(drawable.objectId);
    drawables = [];
    service.invalidate("scene");
    expect(await service.pick(request)).toBeUndefined();
    service.dispose();
  });
});
