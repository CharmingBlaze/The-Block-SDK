import {
  createEditor,
  KnifeCutCommand,
  KnifeTool,
  LoopCutCommand,
  LoopCutTool,
  type ObjectId,
} from "@modeling-kit/sdk";
import { createThreeViewport, type VertexMarkerStyle } from "@modeling-kit/three-adapter";
import { MOUSE } from "three";

const container = document.getElementById("viewport");
if (!container) {
  throw new Error("missing #viewport");
}

const hud = document.createElement("div");
hud.id = "hud";
document.body.appendChild(hud);

const editor = createEditor();
const knife = new KnifeTool();
const loopCut = new LoopCutTool();
let knifeActive = false;
let loopCutActive = false;
let knifeObjectId: ObjectId | null = null;
let spawnCount = 0;
let workspaceTab: "model" | "vertices" = "model";
let markerStyleIndex = 0;

const MARKER_STYLES: ReadonlyArray<{ id: Exclude<VertexMarkerStyle, "custom">; label: string }> = [
  { id: "cube", label: "Cubes" },
  { id: "sphere", label: "Spheres" },
  { id: "square-sprite", label: "Square sprites" },
  { id: "circle-sprite", label: "Circle sprites" },
];

const idleHud =
  "Click a mesh  ·  Drag to orbit  ·  Shift-drag pan  ·  Scroll zoom  ·  K knife  ·  L loop cut";

function snapOptions() {
  const mesh = editor.activeObject()?.mesh;
  return mesh ? { mesh } : undefined;
}

function focusHit(hit: { objectId: ObjectId } | null) {
  if (!hit) {
    return undefined;
  }
  editor.session.selection.replace({
    domain: "object",
    objectIds: [hit.objectId],
    elementIds: [],
  });
  return editor.activeObject();
}

function clearPreviews(): void {
  viewport.setKnifePreview(null);
}

function showKnifeOverlay(hitPoint?: { x: number; y: number; z: number } | null): void {
  if (!knifeActive) {
    return;
  }
  const cursor = hitPoint
    ? knife.previewPoint([hitPoint.x, hitPoint.y, hitPoint.z], snapOptions())
    : undefined;
  viewport.setKnifePreview(knife.overlayState(cursor, snapOptions()));
}

function showLoopCutOverlay(): void {
  if (!loopCutActive) {
    return;
  }
  const mesh = editor.activeObject()?.mesh;
  const preview = mesh ? loopCut.preview(mesh) : null;
  if (!preview || preview.segments.length === 0) {
    viewport.setKnifePreview({
      active: true,
      perforated: false,
      lineColor: 0xffcc33,
      vertexColor: 0xffee88,
      vertices: [],
      segments: [],
    });
    return;
  }
  viewport.setKnifePreview({
    active: true,
    perforated: false,
    lineColor: 0xffcc33,
    vertexColor: 0xffee88,
    cursorColor: 0xffffff,
    vertices: preview.vertices,
    segments: preview.segments,
  });
}

function statusHud(): void {
  if (knifeActive) {
    const n = knife.points.length;
    if (n === 0) {
      hud.textContent = "Knife: click any mesh  ·  hover to snap  ·  Enter cuts";
      return;
    }
    if (n === 1) {
      hud.textContent = "Knife: 1 vertex  ·  click the next snap on the same mesh";
      return;
    }
    hud.textContent = `Knife: ${n} vertices  ·  Enter to cut  ·  Esc to cancel`;
    return;
  }
  if (loopCutActive) {
    if (loopCut.phase === "slide") {
      hud.textContent = `Loop cut: slide (${loopCut.factor.toFixed(2)})  ·  click/Enter commit  ·  Esc back`;
      return;
    }
    hud.textContent = `Loop cut: hover a quad edge on any mesh  ·  scroll cuts (${loopCut.cuts})  ·  click`;
    return;
  }
  hud.textContent = idleHud;
}

function deactivateTools(): void {
  knifeActive = false;
  loopCutActive = false;
  knifeObjectId = null;
  knife.deactivate({ toolId: knife.id });
  loopCut.deactivate({ toolId: loopCut.id });
  clearPreviews();
}

const viewport = createThreeViewport({
  container,
  session: editor.session,
  grid: true,
  lighting: "studio",
  camera: { fov: 45, position: [5, 5, 7] },
  orbitControls: true,
  damping: true,
  autoResize: true,
  picking: { refineSurfacePoint: true },
  resolvePickDomain: () => {
    if (loopCutActive && loopCut.phase === "hover") {
      return "edge";
    }
    if (workspaceTab === "vertices") {
      return "vertex";
    }
    return "face";
  },
  consumePick: (hit) => {
    if (loopCutActive) {
      if (loopCut.phase === "hover") {
        focusHit(hit);
      }
      const mesh = editor.activeObject()?.mesh;
      if (loopCut.phase === "slide") {
        if (hit && mesh) {
          const local = viewport.toMeshLocal(hit);
          if (local) {
            loopCut.slideTo(mesh, local);
          }
        }
        commitLoopCut();
        return true;
      }
      if (hit && "edgeId" in hit && hit.edgeId) {
        loopCut.setHoverEdge(hit.edgeId);
        if (loopCut.beginSlide()) {
          if (loopCut.phase === "hover") {
            commitLoopCut();
          } else {
            showLoopCutOverlay();
            statusHud();
          }
        }
      }
      return true;
    }
    if (!knifeActive) {
      return false;
    }
    if (!hit) {
      showKnifeOverlay();
      statusHud();
      return true;
    }
    if (knifeObjectId && knifeObjectId !== hit.objectId) {
      hud.textContent = "Knife stays on the mesh you started; Esc to switch";
      return true;
    }
    knifeObjectId = hit.objectId;
    focusHit(hit);
    const local = viewport.toMeshLocal(hit);
    if (!local) {
      return true;
    }
    knife.addHit(local, snapOptions());
    showKnifeOverlay({ x: local[0], y: local[1], z: local[2] });
    statusHud();
    return true;
  },
  onHoverPick: (hit) => {
    if (loopCutActive) {
      if (loopCut.phase === "hover") {
        focusHit(hit);
      }
      const mesh = editor.activeObject()?.mesh;
      if (loopCut.phase === "slide") {
        if (hit && mesh) {
          const local = viewport.toMeshLocal(hit);
          if (local) {
            loopCut.slideTo(mesh, local);
          }
        }
        showLoopCutOverlay();
        statusHud();
        return;
      }
      loopCut.setHoverEdge(hit && "edgeId" in hit ? (hit.edgeId ?? null) : null);
      showLoopCutOverlay();
      return;
    }
    if (!knifeActive) {
      return;
    }
    if (!hit || (knifeObjectId && hit.objectId !== knifeObjectId)) {
      showKnifeOverlay();
      return;
    }
    if (!knifeObjectId) {
      focusHit(hit);
    }
    const local = viewport.toMeshLocal(hit);
    if (!local) {
      showKnifeOverlay();
      return;
    }
    showKnifeOverlay({ x: local[0], y: local[1], z: local[2] });
  },
});

function enableLaptopOrbit(): void {
  const controls = viewport.controls;
  if (!controls) {
    return;
  }
  controls.enableDamping = true;
  controls.enablePan = true;
  controls.enableRotate = true;
  controls.enableZoom = true;
  controls.screenSpacePanning = true;
  controls.rotateSpeed = 0.9;
  controls.zoomSpeed = 0.9;
  controls.panSpeed = 0.8;
  controls.mouseButtons = {
    LEFT: MOUSE.ROTATE,
    MIDDLE: MOUSE.DOLLY,
    RIGHT: MOUSE.PAN,
  };
}

function applyMarkerStyle(index: number): void {
  markerStyleIndex = ((index % MARKER_STYLES.length) + MARKER_STYLES.length) % MARKER_STYLES.length;
  const marker = MARKER_STYLES[markerStyleIndex]!;
  const sprite = marker.id === "square-sprite" || marker.id === "circle-sprite";
  viewport.adapter.setSubElementTheme({
    vertices: {
      style: marker.id,
      pixelSize: sprite ? 16 : 11,
      minPixelSize: sprite ? 10 : 7,
      maxPixelSize: sprite ? 28 : 22,
    },
  });
  refreshMarkerPanel();
}

function refreshMarkerPanel(): void {
  const marker = MARKER_STYLES[markerStyleIndex]!;
  vertexIndex.textContent = `${marker.label}  ·  ${markerStyleIndex + 1} / ${MARKER_STYLES.length}`;
  for (const button of styleButtons) {
    if (button.dataset.style === marker.id) {
      button.setAttribute("aria-current", "true");
    } else {
      button.removeAttribute("aria-current");
    }
  }
}

function setWorkspaceTab(tab: "model" | "vertices"): void {
  workspaceTab = tab;
  for (const button of tabButtons) {
    button.setAttribute("aria-selected", button.dataset.tab === tab ? "true" : "false");
  }
  vertexPanel.hidden = tab !== "vertices";
  spawnBar.classList.toggle("with-markers", tab === "vertices");
  if (tab === "vertices") {
    deactivateTools();
    viewport.adapter.setSubElementDisplay({
      enabled: true,
      editMode: true,
      showVertices: true,
      showEdges: true,
      showFaces: false,
    });
    applyMarkerStyle(markerStyleIndex);
    hud.textContent = "Vertex markers: Prev/Next or ← →  ·  Drag orbit  ·  Shift-drag pan  ·  Scroll zoom";
    return;
  }
  viewport.adapter.setSubElementDisplay({
    enabled: true,
    editMode: false,
    showVertices: "domain",
    showEdges: "domain",
    showFaces: "states",
  });
  editor.activeObject()?.selectObject();
  viewport.adapter.sync();
  statusHud();
}

const tabs = document.createElement("div");
tabs.id = "app-tabs";
tabs.setAttribute("role", "tablist");
const tabButtons: HTMLButtonElement[] = [];
for (const [id, label] of [
  ["model", "Model"],
  ["vertices", "Vertices"],
] as const) {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.tab = id;
  button.setAttribute("role", "tab");
  button.textContent = label;
  button.addEventListener("click", () => setWorkspaceTab(id));
  tabs.appendChild(button);
  tabButtons.push(button);
}
document.body.appendChild(tabs);

const vertexPanel = document.createElement("aside");
vertexPanel.id = "vertex-panel";
vertexPanel.hidden = true;
const vertexTitle = document.createElement("h2");
vertexTitle.textContent = "Vertex markers";
const vertexCycle = document.createElement("div");
vertexCycle.id = "vertex-cycle";
const vertexPrev = document.createElement("button");
vertexPrev.type = "button";
vertexPrev.textContent = "Prev style";
const vertexIndex = document.createElement("div");
vertexIndex.id = "vertex-index";
const vertexNext = document.createElement("button");
vertexNext.type = "button";
vertexNext.textContent = "Next style";
vertexPrev.addEventListener("click", () => applyMarkerStyle(markerStyleIndex - 1));
vertexNext.addEventListener("click", () => applyMarkerStyle(markerStyleIndex + 1));
vertexCycle.append(vertexPrev, vertexIndex, vertexNext);
const vertexStyles = document.createElement("div");
vertexStyles.id = "vertex-styles";
const styleButtons: HTMLButtonElement[] = [];
for (const [index, marker] of MARKER_STYLES.entries()) {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.style = marker.id;
  button.textContent = marker.label;
  button.addEventListener("click", () => applyMarkerStyle(index));
  vertexStyles.appendChild(button);
  styleButtons.push(button);
}
const vertexHint = document.createElement("p");
vertexHint.id = "vertex-hint";
vertexHint.textContent = "Drag with the trackpad to orbit. Shift-drag pans. Scroll zooms.";
vertexPanel.append(vertexTitle, vertexCycle, vertexStyles, vertexHint);
document.body.appendChild(vertexPanel);

enableLaptopOrbit();
refreshMarkerPanel();

function commitLoopCut(): void {
  const object = editor.activeObject();
  const params = loopCut.commitParams();
  if (!object || !params) {
    statusHud();
    return;
  }
  try {
    editor.session.execute(
      new LoopCutCommand({
        startEdgeId: params.startEdgeId,
        factor: params.factor,
        cuts: params.cuts,
      }),
    );
    viewport.adapter.sync();
    object.selectObject();
    loopCut.reset();
    loopCut.activate();
    showLoopCutOverlay();
    hud.textContent = `Loop cut committed (${params.cuts})  ·  hover another edge  ·  L to exit`;
  } catch (error) {
    hud.textContent = error instanceof Error ? error.message : String(error);
  }
}

function placeSpawned(): void {
  const object = editor.activeObject();
  if (!object) {
    return;
  }
  const col = spawnCount % 3;
  const row = Math.floor(spawnCount / 3);
  object.move({ x: col * 3.5, z: row * 3.5 });
  spawnCount += 1;
  object.selectObject();
  viewport.adapter.sync();
}

const spawnBar = document.createElement("div");
spawnBar.id = "spawn-bar";
const spawners: Array<[string, () => void]> = [
  ["Cube", () => editor.spawn.cube({ width: 2, height: 2, depth: 2 })],
  ["Cylinder", () => editor.spawn.cylinder({ radius: 1, height: 2, segments: 16 })],
  ["Sphere", () => editor.spawn.sphere({ radius: 1, segments: 16, rings: 12 })],
  ["Torus", () => editor.spawn.torus({ radius: 1, tube: 0.35 })],
  ["Cone", () => editor.spawn.cone({ radius: 1, height: 2, segments: 16 })],
  ["Plane", () => editor.spawn.plane({ width: 2, depth: 2 })],
];
for (const [label, spawn] of spawners) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.addEventListener("click", () => {
    spawn();
    placeSpawned();
    statusHud();
  });
  spawnBar.appendChild(button);
}
document.body.appendChild(spawnBar);

editor.spawn.cube({ width: 2, height: 2, depth: 2 }).selectObject();
placeSpawned();
setWorkspaceTab("model");

window.addEventListener(
  "wheel",
  (event) => {
    if (!loopCutActive || loopCut.phase !== "hover") {
      return;
    }
    event.preventDefault();
    if (event.deltaY < 0) {
      loopCut.addCut();
    } else {
      loopCut.removeCut();
    }
    showLoopCutOverlay();
    statusHud();
  },
  { passive: false },
);

window.addEventListener("keydown", (event) => {
  if (event.repeat) {
    return;
  }
  if (workspaceTab === "vertices") {
    if (event.code === "ArrowLeft" || event.code === "BracketLeft" || event.code === "Comma") {
      event.preventDefault();
      applyMarkerStyle(markerStyleIndex - 1);
      return;
    }
    if (event.code === "ArrowRight" || event.code === "BracketRight" || event.code === "Period") {
      event.preventDefault();
      applyMarkerStyle(markerStyleIndex + 1);
      return;
    }
  }
  if (event.code === "KeyK") {
    if (workspaceTab === "vertices") {
      setWorkspaceTab("model");
    }
    const enable = !knifeActive;
    deactivateTools();
    if (enable) {
      knifeActive = true;
      knife.activate({ toolId: knife.id });
      viewport.setKnifePreview({ active: true, vertices: [], segments: [] });
    }
    statusHud();
    return;
  }
  if (event.code === "KeyL") {
    if (workspaceTab === "vertices") {
      setWorkspaceTab("model");
    }
    const enable = !loopCutActive;
    deactivateTools();
    if (enable) {
      loopCutActive = true;
      loopCut.activate({ toolId: loopCut.id });
      showLoopCutOverlay();
    }
    statusHud();
    return;
  }
  if ((event.code === "Enter" || event.code === "NumpadEnter") && knifeActive) {
    event.preventDefault();
    const object = editor.activeObject();
    if (object && knife.points.length >= 2) {
      try {
        editor.session.execute(new KnifeCutCommand({ points: knife.points }));
        viewport.adapter.sync();
        object.selectObject();
        hud.textContent = "Cut committed  ·  hover to start the next stroke  ·  K to exit";
      } catch (error) {
        hud.textContent = error instanceof Error ? error.message : String(error);
      }
    } else {
      hud.textContent = "Need two snapped vertices before Enter";
    }
    knife.clear();
    knifeObjectId = null;
    viewport.setKnifePreview({ active: true, vertices: [], segments: [] });
    return;
  }
  if ((event.code === "Enter" || event.code === "NumpadEnter") && loopCutActive) {
    event.preventDefault();
    commitLoopCut();
    return;
  }
  if (event.code === "Escape" && (knifeActive || loopCutActive)) {
    if (knifeActive) {
      knife.clear();
      knifeObjectId = null;
      viewport.setKnifePreview({ active: true, vertices: [], segments: [] });
      hud.textContent = "Stroke cleared  ·  click any mesh to start again";
      return;
    }
    if (loopCut.phase === "slide") {
      loopCut.phase = "hover";
      loopCut.startEdgeId = null;
      loopCut.factor = 0.5;
      showLoopCutOverlay();
      statusHud();
      return;
    }
    deactivateTools();
    statusHud();
    return;
  }
  if (event.code === "KeyZ" && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    if (event.shiftKey) {
      editor.redo();
    } else {
      editor.undo();
    }
    viewport.adapter.sync();
  }
});
