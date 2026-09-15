import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { bindDom } from "@modeling-kit/input/dom";
import {
  createInputEngine,
  createModelingSession,
  CreatePrimitiveCommand,
  ExtrudeFacesCommand,
  exportGlb,
  exportGltf,
  primitiveDisplayNames,
  type CreatePrimitiveParams,
  type CreatePrimitiveResult,
  type ModelingSession,
  type PrimitiveType,
} from "@modeling-kit/sdk";
import { ThreeViewportAdapter } from "@modeling-kit/three-adapter";

const CATALOG: readonly PrimitiveType[] = [
  "box",
  "plane",
  "grid",
  "disc",
  "cylinder",
  "cone",
  "pyramid",
  "uvSphere",
  "icosphere",
  "torus",
  "capsule",
  "ramp",
  "stairs",
  "arch",
  "wall",
  "column",
];

function defaultParams(type: PrimitiveType): CreatePrimitiveParams {
  switch (type) {
    case "box":
    case "cube":
      return { width: 1.5, height: 1.5, depth: 1.5 };
    case "plane":
    case "grid":
      return { width: 3, depth: 3, segmentsX: 4, segmentsZ: 4 };
    case "disc":
    case "circle":
      return { radius: 1, segments: 24 };
    case "cylinder":
      return { radius: 0.7, height: 2, segments: 16 };
    case "cone":
      return { radius: 0.8, height: 2, segments: 16 };
    case "pyramid":
      return { width: 1.5, height: 1.5, depth: 1.5 };
    case "uvSphere":
      return { radius: 1, widthSegments: 16, heightSegments: 12 };
    case "icosphere":
      return { radius: 1, subdivisions: 2 };
    case "torus":
      return { radius: 1, tube: 0.3, radialSegments: 12, tubularSegments: 24 };
    case "capsule":
      return { radius: 0.4, height: 1.4, capSegments: 8, radialSegments: 12 };
    case "ramp":
      return { width: 2, height: 1, depth: 2 };
    case "stairs":
      return { width: 2, height: 1.2, depth: 2, steps: 6 };
    case "arch":
      return { width: 2, height: 2, depth: 0.6 };
    case "wall":
      return { width: 3, height: 2, depth: 0.2 };
    case "column":
      return { radius: 0.35, height: 2.4, segments: 16 };
  }
}

const viewport = document.getElementById("viewport");
if (!(viewport instanceof HTMLElement)) {
  throw new Error("missing #viewport");
}

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x13131c);
scene.add(new THREE.AmbientLight(0xffffff, 0.65));
const key = new THREE.DirectionalLight(0xffffff, 0.9);
key.position.set(6, 12, 8);
scene.add(key);
scene.add(new THREE.GridHelper(16, 16, 0x3d3d54, 0x222230));

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(6, 5, 8);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
viewport.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.mouseButtons = {
  LEFT: -1 as THREE.MOUSE,
  MIDDLE: THREE.MOUSE.DOLLY,
  RIGHT: THREE.MOUSE.ROTATE,
};

let session: ModelingSession = createModelingSession();
let adapter = new ThreeViewportAdapter({ session, scene, camera, renderer });
adapter.mount();

let lastCreated: CreatePrimitiveResult | null = null;
let pickDomain: "object" | "face" = "face";
let hostSliding = false;
let unsubHistory: (() => void) | undefined;

const primitiveSelect = document.querySelector("#primitive");
if (!(primitiveSelect instanceof HTMLSelectElement)) {
  throw new Error("missing #primitive");
}
const primitiveTypeSelect: HTMLSelectElement = primitiveSelect;
for (const type of CATALOG) {
  const option = document.createElement("option");
  option.value = type;
  option.textContent = primitiveDisplayNames[type];
  primitiveTypeSelect.appendChild(option);
}

function status(id: string, text: string): void {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function refreshUi(): void {
  const mesh = lastCreated ? session.meshes.get(lastCreated.meshId) : undefined;
  status("stat-object", lastCreated?.objectId ?? "none");
  const sel = session.selection;
  status(
    "stat-sel",
    sel.objectIds.length === 0
      ? "none"
      : `${sel.domain} ${sel.elementIds.length || sel.objectIds.length}`,
  );
  status("stat-mesh", mesh ? `${mesh.vertices.size} / ${mesh.faces.size}` : "—");
  status("stat-hist", `${session.history.canUndo ? "undo" : "—"} / ${session.history.canRedo ? "redo" : "—"}`);
  status("stat-gesture", session.isTransforming ? "transforming" : "idle");
  const undo = document.getElementById("btn-undo");
  const redo = document.getElementById("btn-redo");
  if (undo instanceof HTMLButtonElement) undo.disabled = !session.history.canUndo;
  if (redo instanceof HTMLButtonElement) redo.disabled = !session.history.canRedo;
}

function worldDeltaFromPointer(dx: number, dy: number): THREE.Vector3 {
  const right = new THREE.Vector3();
  const up = new THREE.Vector3();
  camera.matrixWorld.extractBasis(right, up, new THREE.Vector3());
  const scale = 0.004 * camera.position.length();
  return right.multiplyScalar(dx * scale).add(up.multiplyScalar(-dy * scale));
}

function resetSession(): void {
  if (session.isTransforming) {
    session.cancelTransform();
  }
  adapter.dispose();
  session = createModelingSession();
  adapter = new ThreeViewportAdapter({ session, scene, camera, renderer });
  adapter.mount();
  lastCreated = null;
  hostSliding = false;
  unsubHistory?.();
  unsubHistory = session.events.on("history:changed", () => refreshUi());
  status("stat-session", "reset");
  refreshUi();
}

function createPrimitive(): void {
  const type = primitiveTypeSelect.value as PrimitiveType;
  const created = session.execute(new CreatePrimitiveCommand(type, defaultParams(type)));
  lastCreated = created;
  session.selection.replace({
    domain: "object",
    objectId: created.objectId,
  });
  status("stat-session", `created ${primitiveDisplayNames[type]}`);
  refreshUi();
}

function selectTop(): void {
  if (!lastCreated) {
    status("stat-session", "create a primitive first");
    return;
  }
  const top = lastCreated.groups.top;
  if (top.length === 0) {
    status("stat-session", "groups.top is empty on this type");
    return;
  }
  session.selection.replace({
    domain: "face",
    objectId: lastCreated.objectId,
    elementIds: [...top],
  });
  status("stat-session", `selected ${top.length} top face(s)`);
  refreshUi();
}

function extrude(): void {
  if (session.selection.domain !== "face" || session.selection.elementIds.length === 0) {
    status("stat-session", "select faces first (or use Select groups.top)");
    return;
  }
  session.execute(new ExtrudeFacesCommand({ distance: 0.4 }));
  status("stat-session", "extruded");
  refreshUi();
}

function download(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

document.getElementById("btn-create")?.addEventListener("click", createPrimitive);
document.getElementById("btn-reset")?.addEventListener("click", resetSession);
document.getElementById("btn-pick-object")?.addEventListener("click", () => {
  pickDomain = "object";
  status("stat-session", "pick: object");
});
document.getElementById("btn-pick-face")?.addEventListener("click", () => {
  pickDomain = "face";
  status("stat-session", "pick: face");
});
document.getElementById("btn-select-top")?.addEventListener("click", selectTop);
document.getElementById("btn-extrude")?.addEventListener("click", extrude);
document.getElementById("btn-undo")?.addEventListener("click", () => {
  if (session.isTransforming) session.cancelTransform();
  session.undo();
  status("stat-session", "undo");
  refreshUi();
});
document.getElementById("btn-redo")?.addEventListener("click", () => {
  if (session.isTransforming) session.cancelTransform();
  session.redo();
  status("stat-session", "redo");
  refreshUi();
});
document.getElementById("btn-gltf")?.addEventListener("click", () => {
  const json = exportGltf(session.document, session.meshes);
  download("scratch-host.gltf", new Blob([JSON.stringify(json, null, 2)], { type: "model/gltf+json" }));
});
document.getElementById("btn-glb")?.addEventListener("click", () => {
  const bytes = exportGlb(session.document, session.meshes);
  const glb = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(glb).set(bytes);
  download("scratch-host.glb", new Blob([glb], { type: "model/gltf-binary" }));
});

const input = createInputEngine();
bindDom({
  engine: input,
  canvas: renderer.domElement,
  keyboardTarget: window,
});

input.onAction("select.pick", (ctx) => {
  if (!ctx.ndc) return;
  const hit = adapter.pick(ctx.ndc.x, ctx.ndc.y, { domain: pickDomain });
  if (!hit) {
    session.selection.clear();
    refreshUi();
    return;
  }
  if (pickDomain === "object") {
    session.selection.replace({ domain: "object", objectId: hit.objectId });
  } else if (hit.faceId) {
    session.selection.replace({
      domain: "face",
      objectId: hit.objectId,
      elementIds: [hit.faceId],
    });
  } else {
    session.selection.replace({ domain: "object", objectId: hit.objectId });
  }
  refreshUi();
});

input.onAction("edit.undo", () => {
  session.undo();
  status("stat-session", "undo");
  refreshUi();
});
input.onAction("edit.redo", () => {
  session.redo();
  status("stat-session", "redo");
  refreshUi();
});
input.onAction("tool.cancel", () => {
  if (session.isTransforming) {
    session.cancelTransform();
    status("stat-session", "transform canceled");
    refreshUi();
  }
});

input.onGesture("transform.slide", {
  begin: () => {
    if (session.selection.objectIds.length === 0) {
      hostSliding = false;
      return;
    }
    if (session.isTransforming) session.cancelTransform();
    session.beginTransform({
      mode: "translate",
      space: "world",
      objectIds: session.selection.objectIds,
      vertexIds: [],
    });
    hostSliding = true;
    controls.enabled = false;
    refreshUi();
  },
  update: (frame) => {
    if (!hostSliding) return;
    const delta = worldDeltaFromPointer(frame.deltaCanvas.x, frame.deltaCanvas.y);
    session.updateTransform({
      translation: { x: delta.x, y: delta.y, z: delta.z },
    });
    refreshUi();
  },
  commit: () => {
    if (hostSliding) {
      session.commitTransform();
      status("stat-session", "transform committed");
    }
    hostSliding = false;
    controls.enabled = true;
    refreshUi();
  },
  cancel: () => {
    if (hostSliding && session.isTransforming) {
      session.cancelTransform();
      status("stat-session", "transform canceled");
    }
    hostSliding = false;
    controls.enabled = true;
    refreshUi();
  },
});

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

unsubHistory = session.events.on("history:changed", () => refreshUi());

function animate(): void {
  requestAnimationFrame(animate);
  const axes = input.axes();
  void axes;
  controls.update();
  renderer.render(scene, camera);
  input.endFrame();
}
animate();
createPrimitive();
