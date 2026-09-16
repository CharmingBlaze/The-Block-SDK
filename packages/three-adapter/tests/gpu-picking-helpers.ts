import { brand } from "@modeling-kit/core";
import { createModelingSession } from "@modeling-kit/commands";
import type { HalfEdgeMesh } from "@modeling-kit/mesh";
import { Mesh, PerspectiveCamera, Scene, type Camera } from "three";
import { ThreeViewportAdapter } from "../src/adapter";
import { createBufferGeometry } from "../src/geometry";
import { DefaultGpuPickingService } from "../src/gpu-picking/service";
import type { GpuPickDrawable, GpuPickRequest } from "../src/gpu-picking/types";

export function stubRenderer() {
  return {
    setSize: () => undefined,
    setPixelRatio: () => undefined,
  };
}

export function perspective(z = 8, near = 0.1, far = 100): PerspectiveCamera {
  const camera = new PerspectiveCamera(50, 800 / 600, near, far);
  camera.position.set(0, 0, z);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  camera.updateProjectionMatrix();
  return camera;
}

export function centerRequest(domain: "object" | "face" | "vertex" | "edge" = "face") {
  return {
    clientX: 400,
    clientY: 300,
    canvasRect: { left: 0, top: 0, width: 800, height: 600 },
    domain,
  };
}

export function centerPickRequest(
  domain: "object" | "face",
  backfaceMode: "front-only" | "front-and-back" = "front-only",
): GpuPickRequest {
  return {
    pixelX: 400,
    pixelY: 299,
    viewportWidth: 800,
    viewportHeight: 600,
    domain,
    backfaceMode,
  };
}

export function drawableFromMesh(
  mesh: HalfEdgeMesh,
  objectId = brand<string, "ObjectId">("obj"),
): GpuPickDrawable {
  const derived = createBufferGeometry(mesh);
  const object = new Mesh(derived.geometry);
  object.updateMatrixWorld(true);
  return {
    objectId,
    visible: true,
    selectable: true,
    object,
    geometry: derived.geometry,
    mapping: derived.mapping,
    matrixWorld: object.matrixWorld,
    geometryRevision: 1,
  };
}

export async function pickMesh(
  mesh: HalfEdgeMesh,
  domain: "object" | "face",
  camera: Camera = perspective(),
  backfaceMode: "front-only" | "front-and-back" = "front-only",
) {
  const drawable = drawableFromMesh(mesh);
  const service = new DefaultGpuPickingService({
    camera,
    readback: "software",
    getDrawables: () => [drawable],
  });
  const hit = await service.pick(centerPickRequest(domain, backfaceMode));
  service.dispose();
  return hit;
}

export function mountAdapter(
  session: ReturnType<typeof createModelingSession>,
  camera: Camera = perspective(),
  gpuPicking: "software" | "off" = "software",
) {
  const adapter = new ThreeViewportAdapter({
    session,
    scene: new Scene(),
    camera,
    renderer: stubRenderer(),
    gpuPicking,
  });
  adapter.mount();
  adapter.resize(800, 600, 1);
  return adapter;
}
