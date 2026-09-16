import { brand } from "@modeling-kit/core";
import { MeshBuilder, type HalfEdgeMesh } from "@modeling-kit/mesh";
import {
  clientToViewportPixel,
  createBufferGeometry,
  DefaultGpuPickingService,
  type GpuPickDrawable,
  type GpuPickRequest,
} from "@modeling-kit/three-adapter";
import {
  Mesh,
  OrthographicCamera,
  PerspectiveCamera,
  WebGLRenderer,
} from "three";

export interface SmokeCase {
  readonly name: string;
  readonly ok: boolean;
  readonly detail?: string;
}

export interface SmokeReport {
  readonly webglCreated: boolean;
  readonly contextType: string;
  readonly cases: readonly SmokeCase[];
}

declare global {
  interface Window {
    __GPU_PICK_SMOKE__?: SmokeReport | { error: string };
  }
}

function requireWebGL(): WebGLRenderingContext | WebGL2RenderingContext {
  const probe = document.createElement("canvas");
  const gl = probe.getContext("webgl2") ?? probe.getContext("webgl");
  if (!gl) {
    throw new Error("WEBGL_UNAVAILABLE: no WebGL context");
  }
  return gl;
}

function drawableFromMesh(mesh: HalfEdgeMesh, objectId: string, z = 0): GpuPickDrawable {
  const derived = createBufferGeometry(mesh);
  const object = new Mesh(derived.geometry);
  object.position.z = z;
  object.updateMatrixWorld(true);
  return {
    objectId: brand<string, "ObjectId">(objectId),
    visible: true,
    selectable: true,
    object,
    geometry: derived.geometry,
    mapping: derived.mapping,
    matrixWorld: object.matrixWorld,
    geometryRevision: 1,
  };
}

function centerPixel(width: number, height: number): { pixelX: number; pixelY: number } {
  return {
    pixelX: Math.floor(width / 2),
    pixelY: Math.floor(height / 2) - 1,
  };
}

async function pickAt(
  service: DefaultGpuPickingService,
  domain: "object" | "face",
  width: number,
  height: number,
  backfaceMode: "front-only" | "front-and-back" = "front-only",
  pixel = centerPixel(width, height),
) {
  const request: GpuPickRequest = {
    pixelX: pixel.pixelX,
    pixelY: pixel.pixelY,
    viewportWidth: width,
    viewportHeight: height,
    domain,
    backfaceMode,
  };
  return service.pick(request);
}

function createRenderer(pixelRatio: number, width: number, height: number): WebGLRenderer {
  const renderer = new WebGLRenderer({ antialias: false, alpha: false });
  const gl = renderer.getContext();
  if (!gl) {
    throw new Error("WEBGL_UNAVAILABLE: WebGLRenderer context was not created");
  }
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(width, height, false);
  document.body.appendChild(renderer.domElement);
  return renderer;
}

async function runSmoke(): Promise<SmokeReport> {
  const gl = requireWebGL();
  const cases: SmokeCase[] = [];
  const record = (name: string, ok: boolean, detail?: string): void => {
    cases.push(detail ? { name, ok, detail } : { name, ok });
  };

  const cube = MeshBuilder.createCube(2, 2, 2);
  const posZ = [...cube.faces.keys()][0];
  const cubeDrawable = drawableFromMesh(cube, "cube");
  const backDrawable = drawableFromMesh(MeshBuilder.createCube(2, 2, 2), "back", -3);

  const perspective = new PerspectiveCamera(50, 800 / 600, 0.1, 100);
  perspective.position.set(0, 0, 8);
  perspective.lookAt(0, 0, 0);
  perspective.updateMatrixWorld();
  perspective.updateProjectionMatrix();

  const renderer = createRenderer(1, 800, 600);
  const service = new DefaultGpuPickingService({
    camera: perspective,
    renderer,
    readback: "webgl",
    getDrawables: () => [cubeDrawable, backDrawable],
  });

  const objectHit = await pickAt(service, "object", 800, 600, "front-and-back");
  record(
    "perspective-object",
    objectHit?.objectId === "cube",
    JSON.stringify({
      hit: objectHit?.objectId,
      backend: service.diagnostics().backend,
      lastBackend: service.diagnostics().lastBackend,
      lastReadError: service.diagnostics().lastReadError,
      contextLost: service.diagnostics().contextLost,
    }),
  );

  const faceHit = await pickAt(service, "face", 800, 600, "front-only");
  record("perspective-face", faceHit?.faceId === posZ, String(faceHit?.faceId));

  const again = await pickAt(service, "face", 800, 600, "front-only");
  record("repeated-click", again?.faceId === posZ && again?.objectId === "cube");

  const empty = await pickAt(service, "object", 800, 600, "front-and-back", { pixelX: 8, pixelY: 8 });
  record("empty-click", empty === undefined);

  const overlapping = await pickAt(service, "object", 800, 600, "front-and-back");
  record("overlapping-front-wins", overlapping?.objectId === "cube");

  const mapping = cubeDrawable.mapping.triangleToFace;
  record("quad-canonical-face", mapping[0] === mapping[1] && mapping[0] === posZ, `${mapping[0]}:${mapping[1]}`);

  const plane = new MeshBuilder();
  const v0 = plane.addVertex(-1, -1, 0);
  const v1 = plane.addVertex(1, -1, 0);
  const v2 = plane.addVertex(1, 1, 0);
  const v3 = plane.addVertex(-1, 1, 0);
  plane.addFace([v0, v1, v2, v3]);
  const planeDrawable = drawableFromMesh(plane.getMesh(), "plane");
  const backCam = new PerspectiveCamera(50, 800 / 600, 0.1, 100);
  backCam.position.set(0, 0, -8);
  backCam.lookAt(0, 0, 0);
  backCam.updateMatrixWorld();
  backCam.updateProjectionMatrix();
  const faceService = new DefaultGpuPickingService({
    camera: backCam,
    renderer,
    readback: "webgl",
    getDrawables: () => [planeDrawable],
  });
  const frontOnly = await pickAt(faceService, "face", 800, 600, "front-only");
  const bothSides = await pickAt(faceService, "face", 800, 600, "front-and-back");
  record("front-only-backface-miss", frontOnly === undefined);
  record("front-and-back-hit", bothSides?.objectId === "plane");
  faceService.dispose();

  const ortho = new OrthographicCamera(-4, 4, 3, -3, 0.1, 100);
  ortho.position.set(0, 0, 8);
  ortho.lookAt(0, 0, 0);
  ortho.updateMatrixWorld();
  ortho.updateProjectionMatrix();
  const orthoService = new DefaultGpuPickingService({
    camera: ortho,
    renderer,
    readback: "webgl",
    getDrawables: () => [cubeDrawable],
  });
  const orthoHit = await pickAt(orthoService, "object", 800, 600, "front-and-back");
  record("orthographic-object", orthoHit?.objectId === "cube");
  orthoService.dispose();

  renderer.setPixelRatio(2);
  renderer.setSize(800, 600, false);
  const dprService = new DefaultGpuPickingService({
    camera: perspective,
    renderer,
    readback: "webgl",
    getDrawables: () => [cubeDrawable],
  });
  const dprHit = await pickAt(dprService, "face", 800, 600, "front-only");
  record("dpr-2", dprHit?.faceId === posZ, String(dprHit?.faceId));
  dprService.dispose();

  const offset = clientToViewportPixel(
    424,
    316,
    { left: 24, top: 16, width: 800, height: 600 },
    { x: 0, y: 0, width: 800, height: 600 },
    800,
    600,
  );
  record("canvas-offset", offset?.x === 400 && offset?.y === 299, JSON.stringify(offset));

  const splitPixel = clientToViewportPixel(
    400,
    300,
    { left: 0, top: 0, width: 800, height: 600 },
    { x: 80, y: 40, width: 640, height: 520 },
    800,
    600,
  );
  record("split-viewport-pixel", splitPixel !== undefined && splitPixel.x > 10 && splitPixel.x < 630);

  perspective.aspect = 400 / 600;
  perspective.updateProjectionMatrix();
  const splitService = new DefaultGpuPickingService({
    camera: perspective,
    renderer,
    readback: "webgl",
    getDrawables: () => [cubeDrawable],
  });
  const splitHit = await pickAt(splitService, "object", 400, 600, "front-and-back");
  record("split-viewport-pick", splitHit?.objectId === "cube", splitHit?.objectId);
  splitService.dispose();
  perspective.aspect = 800 / 600;
  perspective.updateProjectionMatrix();

  perspective.setViewOffset(800, 600, 100, 50, 600, 500);
  const viewService = new DefaultGpuPickingService({
    camera: perspective,
    renderer,
    readback: "webgl",
    getDrawables: () => [cubeDrawable],
  });
  await pickAt(viewService, "object", 600, 500, "front-and-back");
  record(
    "camera-view-offset-restored",
    perspective.view?.offsetX === 100 && perspective.view?.offsetY === 50 && perspective.view?.width === 600,
    JSON.stringify(perspective.view),
  );
  perspective.clearViewOffset();
  perspective.updateProjectionMatrix();
  viewService.dispose();

  renderer.setPixelRatio(1);
  renderer.setSize(1280, 720, false);
  const maxService = new DefaultGpuPickingService({
    camera: perspective,
    renderer,
    readback: "webgl",
    getDrawables: () => [cubeDrawable],
  });
  perspective.aspect = 1280 / 720;
  perspective.updateProjectionMatrix();
  const maxHit = await pickAt(maxService, "object", 1280, 720, "front-and-back");
  record("maximized-viewport", maxHit?.objectId === "cube");
  maxService.dispose();

  service.resize(1280, 720);
  service.invalidate("resize");
  const afterResize = await pickAt(service, "object", 1280, 720, "front-and-back");
  record("resize-invalidation", afterResize?.objectId === "cube");
  service.dispose();
  renderer.dispose();

  return {
    webglCreated: true,
    contextType: gl instanceof WebGL2RenderingContext ? "webgl2" : "webgl",
    cases,
  };
}

void runSmoke()
  .then((report) => {
    window.__GPU_PICK_SMOKE__ = report;
    const failed = report.cases.filter((item) => !item.ok);
    const node = document.getElementById("report");
    if (node) {
      node.textContent = JSON.stringify({ ...report, failed: failed.map((item) => item.name) }, null, 2);
    }
    if (failed.length > 0) {
      console.error("GPU picking smoke failures", failed);
    }
  })
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    window.__GPU_PICK_SMOKE__ = { error: message };
    const node = document.getElementById("report");
    if (node) {
      node.textContent = message;
    }
  });
