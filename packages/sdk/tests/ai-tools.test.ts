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
});
