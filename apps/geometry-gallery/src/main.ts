import { createEditor, validateMesh } from "@modeling-kit/sdk";
import { createThreeViewport } from "@modeling-kit/three-adapter";
import { createCheckerTexture } from "./checker";
import { requireElement, setPressed, setText } from "./dom";
import { applyPreview, createPreviewMaterials, disposePreviewMaterials, type PreviewState } from "./preview";
import { GALLERY_SHAPES, galleryLabel, paramsForShape, type GalleryShape } from "./shapes";

const container = requireElement("viewport", (el): el is HTMLElement => el instanceof HTMLElement);
const shapeSelect = requireElement("shape", (el): el is HTMLSelectElement => el instanceof HTMLSelectElement);

const editor = createEditor();
const viewport = createThreeViewport({
  container,
  session: editor.session,
  lighting: "studio",
  orbitControls: true,
  damping: true,
  picking: true,
  background: 0x101018,
});

const materials = createPreviewMaterials(createCheckerTexture());
const state: PreviewState = { useChecker: true, flat: false, showWire: true };
let wire = applyPreview(editor, viewport, materials, state, null);
let index = 0;

for (const shape of GALLERY_SHAPES) {
  const option = document.createElement("option");
  option.value = shape.id;
  option.textContent = galleryLabel(shape);
  shapeSelect.appendChild(option);
}

function show(shape: GalleryShape): void {
  wire = applyPreview(editor, viewport, materials, { ...state, showWire: false }, wire);
  editor.clear();
  if (shape.source === "library") {
    editor.spawn.library(shape.type, { ...paramsForShape(shape), name: galleryLabel(shape) });
  } else {
    editor.spawn.primitive(shape.type, { ...paramsForShape(shape), name: galleryLabel(shape) });
  }
  const object = editor.activeObject();
  const mesh = object?.mesh;
  const closed = mesh ? validateMesh(mesh).statistics.isClosed : false;
  const seams = mesh ? [...mesh.edges.values()].filter((edge) => edge.isSeam).length : 0;
  const uvOk = mesh ? [...mesh.corners.values()].every((corner) => corner.uv) : false;
  const nOk = mesh ? [...mesh.corners.values()].every((corner) => corner.normal) : false;
  setText("stat-type", shape.id);
  setText("stat-mesh", mesh ? `${mesh.vertices.size} / ${mesh.faces.size}` : "—");
  setText("stat-attr", `${uvOk ? "uv" : "no uv"} / ${nOk ? "n" : "no n"}`);
  setText("stat-topo", `${seams} seams / ${closed ? "closed" : "open"}`);
  wire = applyPreview(editor, viewport, materials, state, wire);
}

shapeSelect.addEventListener("change", () => {
  index = Math.max(0, GALLERY_SHAPES.findIndex((shape) => shape.id === shapeSelect.value));
  show(GALLERY_SHAPES[index]!);
});
document.getElementById("prev")?.addEventListener("click", () => {
  index = (index + GALLERY_SHAPES.length - 1) % GALLERY_SHAPES.length;
  shapeSelect.value = GALLERY_SHAPES[index]!.id;
  show(GALLERY_SHAPES[index]!);
});
document.getElementById("next")?.addEventListener("click", () => {
  index = (index + 1) % GALLERY_SHAPES.length;
  shapeSelect.value = GALLERY_SHAPES[index]!.id;
  show(GALLERY_SHAPES[index]!);
});
document.getElementById("flat")?.addEventListener("click", () => {
  state.flat = true;
  setPressed("flat", true);
  setPressed("smooth", false);
  wire = applyPreview(editor, viewport, materials, state, wire);
});
document.getElementById("smooth")?.addEventListener("click", () => {
  state.flat = false;
  setPressed("flat", false);
  setPressed("smooth", true);
  wire = applyPreview(editor, viewport, materials, state, wire);
});
document.getElementById("wire")?.addEventListener("click", () => {
  state.showWire = !state.showWire;
  setPressed("wire", state.showWire);
  wire = applyPreview(editor, viewport, materials, state, wire);
});
document.getElementById("checker")?.addEventListener("click", () => {
  state.useChecker = !state.useChecker;
  setPressed("checker", state.useChecker);
  wire = applyPreview(editor, viewport, materials, state, wire);
});

window.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft") {
    document.getElementById("prev")?.dispatchEvent(new Event("click"));
  }
  if (event.key === "ArrowRight") {
    document.getElementById("next")?.dispatchEvent(new Event("click"));
  }
});

function disposeHost(): void {
  disposePreviewMaterials(materials, wire);
  viewport.dispose();
  editor.dispose();
}

window.addEventListener("pagehide", disposeHost);
show(GALLERY_SHAPES[0]!);
