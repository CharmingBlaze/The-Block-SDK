import { describe, expect, it } from "vitest";
import { createEditor, executeEditorTool, getEditorToolDefinitions, listEditorToolNames } from "../src/ai";

describe("editor AI tools", () => {
  it("exposes OpenAI-style function schemas", () => {
    const tools = getEditorToolDefinitions();
    const names = tools.map((tool) => tool.function.name);
    expect(tools.every((tool) => tool.type === "function")).toBe(true);
    expect(names).toEqual(listEditorToolNames());
    expect(new Set(names).size).toBe(names.length);
    expect(names).toEqual([
      "spawn_primitive",
      "select_components",
      "extrude_faces",
      "inset_faces",
      "bevel_edges",
      "set_edge_creases",
      "subdivide_faces",
      "catmull_clark",
      "loop_cut",
      "dissolve_edges",
      "fill_boundary",
      "knife_stroke",
      "heal_mesh",
      "weld_vertices",
      "triangulate_faces",
      "merge_vertices",
      "connect_vertices",
      "transform_selection",
      "undo",
      "redo",
      "inspect_scene",
      "save_scene",
      "load_scene",
      "list_objects",
      "inspect_mesh",
      "query_near",
      "import_mesh",
      "export_mesh",
      "begin_transaction",
      "commit_transaction",
      "rollback_transaction",
      "issue_request_id",
    ]);
    for (const tool of tools) {
      expect(tool.function.parameters.type).toBe("object");
      expect(tool.function.parameters.additionalProperties).toBe(false);
    }
    expect(tools.find((tool) => tool.function.name === "spawn_primitive")?.function.parameters.required).toEqual([
      "type",
    ]);
    expect(tools.find((tool) => tool.function.name === "inspect_scene")?.function.parameters.required ?? []).toEqual([]);
  });

  it("executes a simulated agent modeling loop", () => {
    const editor = createEditor();
    const spawned = executeEditorTool(editor, "spawn_primitive", {
      type: "cylinder",
      radius: 1.2,
      height: 0.2,
      name: "Stool",
    });
    expect(spawned.ok).toBe(true);
    if (!spawned.ok) {
      return;
    }

    const selected = executeEditorTool(editor, "select_components", {
      domain: "face",
      tags: ["bottom"],
    });
    expect(selected.ok).toBe(true);

    const extruded = executeEditorTool(editor, "extrude_faces", { distance: 0.1 });
    expect(extruded.ok).toBe(true);

    const inset = executeEditorTool(editor, "inset_faces", { distance: 0.15 });
    expect(inset.ok).toBe(true);
    if (!inset.ok) {
      return;
    }
    expect(inset.inspection.objects[0]?.isClosedManifold).toBe(true);
    expect(inset.inspection.objects[0]?.faces).toBeGreaterThan(18);

    const inspected = executeEditorTool(editor, "inspect_scene", {});
    expect(inspected.ok).toBe(true);
    expect(inspected.inspection.canUndo).toBe(true);

    const undone = executeEditorTool(editor, "undo", {});
    expect(undone.ok).toBe(true);
    expect(undone.inspection.objects[0]?.faces).toBeLessThan(inset.inspection.objects[0]?.faces ?? 0);

    const saved = executeEditorTool(editor, "save_scene", {});
    expect(saved.ok).toBe(true);
    if (saved.ok) {
      expect(typeof (saved.data as { json?: string }).json).toBe("string");
      expect((saved.data as { json: string }).json).toContain("schemaVersion");
    }
    editor.dispose();
  });

  it("returns a structured failure for unknown tools", () => {
    const editor = createEditor();
    const result = executeEditorTool(editor, "not_a_tool", {});
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error).toContain("Unknown editor tool");
  });

  it("returns a structured failure for malformed JSON and extra properties", () => {
    const editor = createEditor();
    const invalidJson = executeEditorTool(editor, "inspect_scene", "{");
    expect(invalidJson.ok).toBe(false);
    if (!invalidJson.ok) {
      expect(invalidJson.retryable).toBe(false);
      expect(invalidJson.code).toBe("invalid_json");
      expect(invalidJson.issues?.length).toBeGreaterThan(0);
      expect(invalidJson.error.length).toBeGreaterThan(0);
    }
    const extra = executeEditorTool(editor, "inspect_scene", { nope: true });
    expect(extra.ok).toBe(false);
    if (!extra.ok) {
      expect(extra.field).toBe("nope");
      expect(extra.retryable).toBe(true);
      expect(extra.code).toBe("invalid_argument");
      expect(extra.issues?.some((issue) => issue.path === "nope")).toBe(true);
    }
    const nan = executeEditorTool(editor, "spawn_primitive", { type: "cube", width: Number.NaN });
    expect(nan.ok).toBe(false);
    const infiniteKnife = executeEditorTool(editor, "knife_stroke", {
      points: [
        [0, 0, 0],
        [1, Number.POSITIVE_INFINITY, 0],
      ],
    });
    expect(infiniteKnife.ok).toBe(false);
    const longPoint = executeEditorTool(editor, "knife_stroke", {
      points: [
        [0, 0, 0, 9],
        [1, 0, 0],
      ],
    });
    expect(longPoint.ok).toBe(false);
    editor.dispose();
  });

  it("unions multiple face tags and rejects unknown tags", () => {
    const editor = createEditor();
    executeEditorTool(editor, "spawn_primitive", { type: "cube", width: 1, height: 1, depth: 1 });
    const selected = executeEditorTool(editor, "select_components", {
      domain: "face",
      tags: ["top", "bottom"],
    });
    expect(selected.ok).toBe(true);
    expect(selected.inspection.objects[0]?.selected?.count).toBe(2);
    const unknown = executeEditorTool(editor, "select_components", {
      domain: "face",
      tags: ["ceiling"],
    });
    expect(unknown.ok).toBe(false);
    editor.dispose();
  });

  it("requires coordinates for custom and cursor merge targets", () => {
    const editor = createEditor();
    executeEditorTool(editor, "spawn_primitive", { type: "cube", width: 1, height: 1, depth: 1 });
    executeEditorTool(editor, "select_components", { domain: "vertex" });
    const missing = executeEditorTool(editor, "merge_vertices", { target: "custom" });
    expect(missing.ok).toBe(false);
    if (!missing.ok) {
      expect(missing.field).toBe("position");
      expect(missing.retryable).toBe(true);
    }
    editor.dispose();
  });

  it("does not throw after the editor is disposed", () => {
    const editor = createEditor();
    editor.dispose();
    const result = executeEditorTool(editor, "inspect_scene", {});
    expect(result.ok).toBe(true);
  });

  it("returns every schema issue so an agent can fix several fields at once", () => {
    const editor = createEditor();
    const result = executeEditorTool(editor, "spawn_primitive", {
      width: Number.NaN,
      extra: true,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("invalid_argument");
      expect(result.issues?.length).toBeGreaterThanOrEqual(2);
      expect(result.issues?.some((issue) => issue.path === "type")).toBe(true);
      expect(result.issues?.some((issue) => issue.path === "extra")).toBe(true);
    }
    editor.dispose();
  });

  it("loads, lists, inspects, queries, and round-trips OBJ with a conversion report", () => {
    const editor = createEditor();
    executeEditorTool(editor, "spawn_primitive", { type: "cube", width: 1, height: 1, depth: 1, name: "Box" });
    const saved = executeEditorTool(editor, "save_scene", {});
    expect(saved.ok).toBe(true);
    if (!saved.ok) {
      return;
    }
    const json = (saved.data as { json: string }).json;
    executeEditorTool(editor, "spawn_primitive", { type: "plane", name: "Other" });
    const loaded = executeEditorTool(editor, "load_scene", { json });
    expect(loaded.ok).toBe(true);
    expect(loaded.inspection.totalObjects).toBe(1);

    const listed = executeEditorTool(editor, "list_objects", { name: "Box" });
    expect(listed.ok).toBe(true);
    if (listed.ok) {
      const objects = (listed.data as { objects: Array<{ name: string; parentId: string | null }> }).objects;
      expect(objects).toHaveLength(1);
      expect(objects[0]?.name).toBe("Box");
      expect(objects[0]?.parentId).toBeTruthy();
    }

    const inspected = executeEditorTool(editor, "inspect_mesh", {});
    expect(inspected.ok).toBe(true);
    if (inspected.ok) {
      const mesh = inspected.data as { faces: number; quads: number; tags: Record<string, number> };
      expect(mesh.faces).toBe(6);
      expect(mesh.quads).toBe(6);
      expect(mesh.tags.top).toBeGreaterThan(0);
    }

    const queried = executeEditorTool(editor, "query_near", { point: [0.5, 0.5, 0.5], radius: 2 });
    expect(queried.ok).toBe(true);
    if (queried.ok) {
      expect((queried.data as { matched: boolean }).matched).toBe(true);
    }

    const exported = executeEditorTool(editor, "export_mesh", { format: "obj" });
    expect(exported.ok).toBe(true);
    if (!exported.ok) {
      return;
    }
    const text = (exported.data as { text: string; report: { format: string } }).text;
    expect((exported.data as { report: { format: string } }).report.format).toBe("obj");
    editor.clear();
    const imported = executeEditorTool(editor, "import_mesh", { format: "obj", text, name: "FromObj" });
    expect(imported.ok).toBe(true);
    if (imported.ok) {
      expect((imported.data as { report: { format: string } }).report.format).toBe("obj");
      expect(imported.inspection.totalObjects).toBe(1);
    }
    editor.dispose();
  });

  it("groups tools in a transaction and rolls back without leaving a history entry", () => {
    const editor = createEditor();
    executeEditorTool(editor, "begin_transaction", {});
    executeEditorTool(editor, "spawn_primitive", { type: "cube", width: 1, height: 1, depth: 1 });
    executeEditorTool(editor, "spawn_primitive", { type: "cube", width: 1, height: 1, depth: 1 });
    const rolled = executeEditorTool(editor, "rollback_transaction", {});
    expect(rolled.ok).toBe(true);
    expect(rolled.inspection.totalObjects).toBe(0);
    expect(rolled.inspection.canUndo).toBe(false);
    executeEditorTool(editor, "begin_transaction", {});
    executeEditorTool(editor, "spawn_primitive", { type: "cube", width: 1, height: 1, depth: 1 });
    const committed = executeEditorTool(editor, "commit_transaction", { label: "Make cube" });
    expect(committed.ok).toBe(true);
    expect(committed.inspection.totalObjects).toBe(1);
    executeEditorTool(editor, "undo", {});
    expect(editor.inspect().totalObjects).toBe(0);
    editor.dispose();
  });

  it("replays a clientRequestId without applying the tool twice", () => {
    const editor = createEditor();
    const minted = executeEditorTool(editor, "issue_request_id", {});
    expect(minted.ok).toBe(true);
    const requestId = minted.ok ? (minted.data as { requestId: string }).requestId : "";
    const first = executeEditorTool(editor, "spawn_primitive", {
      type: "cube",
      width: 1,
      height: 1,
      depth: 1,
      clientRequestId: requestId,
    });
    expect(first.ok).toBe(true);
    const second = executeEditorTool(editor, "spawn_primitive", {
      type: "plane",
      clientRequestId: requestId,
    });
    expect(second.ok).toBe(true);
    expect(second.inspection.totalObjects).toBe(1);
    expect(second.clientRequestId).toBe(requestId);
    editor.dispose();
  });
});
