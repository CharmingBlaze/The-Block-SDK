import { brand, createSequenceIdFactory } from "@modeling-kit/core";
import { MeshBuilder } from "@modeling-kit/mesh";
import { describe, expect, it } from "vitest";
import { createUvChannel } from "../src/channels";
import { getCornerUv, setCornerUv, setCornerPinned } from "../src/corners";
import { createUvEditor } from "../src/editor";
import { setSeams } from "../src/islands";
import { projectUvs } from "../src/project";
import { buildUvTopology } from "../src/topology";
import { hitRadiusUv, resolveVisualState, screenPointSize, themeForPreset } from "../src/visual";

function cube() {
  const ids = createSequenceIdFactory("uv-found");
  const mesh = MeshBuilder.createCube(2, 2, 2, ids.mesh());
  projectUvs(mesh, { projection: "box" });
  return mesh;
}

describe("UV editor foundation", () => {
  it("stores UVs per corner, not per spatial vertex", () => {
    const mesh = cube();
    const vertexId = [...mesh.vertices.keys()][0]!;
    const corners = [...mesh.corners.values()].filter((c) => c.vertexId === vertexId);
    expect(corners.length).toBeGreaterThan(1);
    const unique = new Set(corners.map((c) => getCornerUv(mesh, c.id).join(",")));
    expect(unique.size).toBeGreaterThan(1);
  });

  it("splits derived UV topology at seams and welds across non-seams", () => {
    const mesh = cube();
    const open = buildUvTopology(mesh);
    expect(open.islands.size).toBe(1);
    expect(open.vertices.size).toBeGreaterThan(mesh.vertices.size);

    setSeams(mesh, [...mesh.edges.keys()], true);
    const split = buildUvTopology(mesh);
    expect(split.islands.size).toBe(6);
    expect(split.vertices.size).toBe(mesh.corners.size);
  });

  it("keeps UV vertex IDs stable when coordinates move", () => {
    const mesh = cube();
    setSeams(mesh, [...mesh.edges.keys()], true);
    const before = buildUvTopology(mesh);
    const id = [...before.vertices.keys()][0]!;
    const vertex = before.vertices.get(id)!;
    for (const cornerId of vertex.cornerIds) {
      const uv = getCornerUv(mesh, cornerId);
      setCornerUv(mesh, cornerId, [uv[0] + 0.25, uv[1] + 0.1]);
    }
    const after = buildUvTopology(mesh);
    expect(after.vertices.has(id)).toBe(true);
    expect(after.vertices.get(id)?.u).toBeCloseTo(vertex.u + 0.25);
  });

  it("keeps UV channels independent", () => {
    const mesh = cube();
    const extra = createUvChannel(1, { purpose: "lightmap" });
    const cornerId = [...mesh.corners.keys()][0]!;
    const base = getCornerUv(mesh, cornerId);
    setCornerUv(mesh, cornerId, [0.9, 0.8], extra.id);
    expect(getCornerUv(mesh, cornerId)).toEqual(base);
    expect(getCornerUv(mesh, cornerId, extra.id)).toEqual([0.9, 0.8]);

    setSeams(mesh, [...mesh.edges.keys()], true, extra.id);
    expect(buildUvTopology(mesh).islands.size).toBe(1);
    expect(buildUvTopology(mesh, extra.id).islands.size).toBe(6);
  });

  it("selects vertices, edges, faces, and islands", () => {
    const mesh = cube();
    setSeams(mesh, [...mesh.edges.keys()], true);
    const editor = createUvEditor({ mesh, textureResolution: { width: 64, height: 64 } });
    const topology = editor.topology();
    const vertexId = [...topology.vertices.keys()][0]!;
    editor.select({ mode: "vertex", operation: "replace", ids: [vertexId] });
    expect(editor.selection.has(vertexId)).toBe(true);

    const face = [...topology.faces.values()][0]!;
    editor.select({ mode: "face", operation: "replace", ids: [face.id] });
    expect(editor.selection.selectedFaceIds(topology)).toContain(face.faceId);

    editor.select({ mode: "island", operation: "replace", ids: [face.islandId] });
    expect(editor.selection.snapshot().ids).toEqual([face.islandId]);
    editor.dispose();
  });

  it("does not rebuild UV connectivity on hover", () => {
    const mesh = cube();
    const editor = createUvEditor({ mesh });
    const view = editor.createViewAdapter();
    const topology = editor.topology();
    const builds = editor.topologyBuilds;
    const vertex = [...topology.vertices.values()][0]!;
    view.setHover({ mode: "vertex", id: vertex.id });
    view.getViewData();
    view.setHover(null);
    view.getViewData();
    expect(editor.topologyBuilds).toBe(builds);
    editor.dispose();
  });

  it("resolves visual state with deterministic priority", () => {
    expect(resolveVisualState({ hidden: true, selected: true, hovered: true })).toBe("hidden");
    expect(resolveVisualState({ locked: true, warning: true, active: true })).toBe("locked");
    expect(resolveVisualState({ warning: true, selected: true })).toBe("warning");
    expect(resolveVisualState({ active: true, selected: true, hovered: true })).toBe("active");
    expect(resolveVisualState({ selected: true, hovered: true })).toBe("selected");
    expect(resolveVisualState({ hovered: true })).toBe("hovered");
    expect(resolveVisualState({ pinned: true })).toBe("pinned");
  });

  it("restores exact UVs when a transform is cancelled", () => {
    const mesh = cube();
    const editor = createUvEditor({ mesh });
    const topology = editor.topology();
    const vertex = [...topology.vertices.values()][0]!;
    editor.select({ mode: "vertex", operation: "replace", ids: [vertex.id] });
    const before = vertex.cornerIds.map((id) => getCornerUv(mesh, id));
    editor.transform.begin({ operation: "move", pivot: "selection-center" });
    editor.transform.update({ translate: [0.3, -0.2] });
    expect(getCornerUv(mesh, vertex.cornerIds[0]!)[0]).not.toBeCloseTo(before[0]![0]);
    editor.transform.cancel();
    vertex.cornerIds.forEach((id, index) => {
      expect(getCornerUv(mesh, id)).toEqual(before[index]);
    });
    editor.dispose();
  });

  it("rotates and scales selected UV corners around a custom pivot", () => {
    const mesh = cube();
    const editor = createUvEditor({ mesh, preset: "pixel-art" });
    const topology = editor.topology();
    const vertex = [...topology.vertices.values()].find((item) => Math.abs(item.u) > 0.05 && Math.abs(item.v) > 0.05)!;
    expect(vertex).toBeDefined();
    editor.select({ mode: "vertex", operation: "replace", ids: [vertex.id] });
    expect(editor.selection.selectedCornerIds(topology).length).toBeGreaterThan(0);
    const start = getCornerUv(mesh, vertex.cornerIds[0]!);
    editor.transform.begin({ operation: "rotate", pivot: "custom", customPivot: [0, 0] });
    editor.transform.update({ angleRadians: Math.PI / 2 });
    const preview = getCornerUv(mesh, vertex.cornerIds[0]!);
    const result = editor.transform.commit();
    expect(result.changedCornerIds.length).toBeGreaterThan(0);
    const afterRotate = getCornerUv(mesh, vertex.cornerIds[0]!);
    expect(preview[0]).toBeCloseTo(-start[1], 5);
    expect(afterRotate[0]).toBeCloseTo(-start[1], 5);

    editor.transform.begin({ operation: "scale", pivot: "custom", customPivot: [0, 0] });
    editor.transform.update({ scale: 2 });
    editor.transform.commit();
    const afterScale = getCornerUv(mesh, vertex.cornerIds[0]!);
    expect(afterScale[0]).toBeCloseTo(afterRotate[0] * 2, 5);

    const view = editor.createViewAdapter({ preset: "professional" });
    const data = view.getViewData();
    expect(data.vertices[0]?.pointSize).toBeGreaterThan(0);
    expect(getCornerUv(mesh, vertex.cornerIds[0]!)).toEqual(afterScale);
    editor.dispose();
  });

  it("keeps hit radius independent from visible point size", () => {
    const compact = themeForPreset("compact");
    const touch = themeForPreset("touch");
    const zoom = 64;
    expect(screenPointSize(touch, zoom, 1)).not.toBe(screenPointSize(compact, zoom, 1));
    expect(hitRadiusUv(touch, zoom, 1)).toBeGreaterThan(hitRadiusUv(compact, zoom, 1));
    expect(hitRadiusUv(compact, zoom, 1)).not.toBe(compact.pointSize / zoom);
  });

  it("keeps hover state per view and ignores events after dispose", () => {
    const mesh = cube();
    const editor = createUvEditor({ mesh });
    const a = editor.createViewAdapter();
    const b = editor.createViewAdapter();
    const vertex = [...editor.topology().vertices.values()][0]!;
    a.setHover({ mode: "vertex", id: vertex.id });
    expect(a.hoveredId).toBe(vertex.id);
    expect(b.hoveredId).toBeNull();
    a.dispose();
    a.dispose();
    expect(a.setHover({ mode: "vertex", id: vertex.id })).toBeNull();
    expect(b.getViewData().vertices.length).toBeGreaterThan(0);
    editor.dispose();
    editor.dispose();
    expect(editor.disposed).toBe(true);
  });

  it("invalidates connectivity when mesh topology revision changes", () => {
    const mesh = cube();
    const editor = createUvEditor({ mesh });
    editor.topology();
    const builds = editor.topologyBuilds;
    mesh.bumpRevision();
    editor.topology();
    expect(editor.topologyBuilds).toBeGreaterThan(builds);
    editor.dispose();
  });
});

describe("UV editor lifecycle and interaction", () => {
  it("uses OperationLifecycleMachine for transforms and rejects stale updates", () => {
    const mesh = cube();
    const editor = createUvEditor({ mesh });
    const vertex = [...editor.topology().vertices.values()][0]!;
    editor.select({ mode: "vertex", operation: "replace", ids: [vertex.id] });
    editor.transform.begin({ operation: "move" });
    expect(editor.transform.state).toBe("active");
    expect(editor.interactionState).toBe("transforming");
    editor.transform.update({ translate: [0.1, 0] });
    editor.transform.commit();
    expect(editor.transform.state).toBe("idle");
    expect(() => editor.transform.update({ translate: [0.2, 0] })).toThrow(/active transform/);
    editor.dispose();
    expect(editor.lifecycle).toBe("disposed");
    expect(() => editor.selectAll()).toThrow(/disposed/);
  });

  it("holds pinned UV corners during a move", () => {
    const mesh = cube();
    const editor = createUvEditor({ mesh });
    const vertex = [...editor.topology().vertices.values()][0]!;
    const cornerId = vertex.cornerIds[0]!;
    setCornerPinned(mesh, cornerId, true);
    const before = getCornerUv(mesh, cornerId);
    editor.select({ mode: "vertex", operation: "replace", ids: [vertex.id] });
    editor.transform.begin({ operation: "move" });
    editor.transform.update({ translate: [0.4, 0.2] });
    expect(getCornerUv(mesh, cornerId)).toEqual(before);
    editor.transform.cancel();
    editor.dispose();
  });

  it("selects with box and lasso pointer gestures", () => {
    const mesh = cube();
    const editor = createUvEditor({ mesh });
    const topology = editor.topology();
    const vertex = [...topology.vertices.values()][0]!;
    editor.pointerDown([vertex.u - 0.05, vertex.v - 0.05], { mode: "vertex" });
    editor.pointerMove([vertex.u + 0.05, vertex.v + 0.05]);
    expect(editor.interactionState).toBe("box-selecting");
    editor.pointerUp([vertex.u + 0.05, vertex.v + 0.05]);
    expect(editor.selection.has(vertex.id)).toBe(true);
    editor.clearSelection();
    editor.pointerDown([vertex.u - 0.2, vertex.v - 0.2], { tool: "lasso", mode: "vertex" });
    editor.pointerMove([vertex.u + 0.2, vertex.v - 0.2]);
    editor.pointerMove([vertex.u + 0.2, vertex.v + 0.2]);
    editor.pointerMove([vertex.u - 0.2, vertex.v + 0.2]);
    editor.pointerUp([vertex.u - 0.2, vertex.v - 0.2]);
    expect(editor.selection.has(vertex.id)).toBe(true);
    editor.dispose();
  });

  it("drops disposed view adapters so the editor does not retain them", () => {
    const mesh = cube();
    const editor = createUvEditor({ mesh });
    const view = editor.createViewAdapter();
    view.dispose();
    view.dispose();
    const other = editor.createViewAdapter();
    editor.selectAll("vertex");
    expect(other.getViewData().vertices.length).toBeGreaterThan(0);
    editor.dispose();
  });
});

describe("UV brand helpers", () => {
  it("brands channel ids", () => {
    expect(String(brand("uv1"))).toBe("uv1");
  });
});
