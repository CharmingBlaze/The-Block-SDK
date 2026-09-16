import type { EdgeId, FaceId, ObjectId, VertexId } from "@modeling-kit/core";
import { canonicalizePrimitiveType, type PrimitiveType } from "@modeling-kit/primitives";
import {
  createEditor,
  type FluentEditor,
  type FluentMeshObject,
  type VecDelta,
} from "@modeling-kit/commands";
import type { SceneInspectionResult } from "@modeling-kit/commands";

export interface JsonSchemaObject {
  readonly type: "object";
  readonly properties: Record<string, unknown>;
  readonly required?: readonly string[];
  readonly additionalProperties: false;
}

export interface EditorToolDefinition {
  readonly type: "function";
  readonly function: {
    readonly name: string;
    readonly description: string;
    readonly parameters: JsonSchemaObject;
  };
}

export type EditorToolSuccess = {
  readonly ok: true;
  readonly tool: string;
  readonly inspection: SceneInspectionResult;
  readonly data?: unknown;
};

export type EditorToolFailure = {
  readonly ok: false;
  readonly tool: string;
  readonly error: string;
  readonly inspection: SceneInspectionResult;
};

export type EditorToolResult = EditorToolSuccess | EditorToolFailure;

const PRIMITIVE_TYPES: readonly PrimitiveType[] = [
  "box",
  "cube",
  "plane",
  "grid",
  "disc",
  "circle",
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

function tool(name: string, description: string, parameters: JsonSchemaObject): EditorToolDefinition {
  return { type: "function", function: { name, description, parameters } };
}

/** OpenAI-style function schemas for plugging `@modeling-kit` into an agent. */
export function getEditorToolDefinitions(): readonly EditorToolDefinition[] {
  return [
    tool("spawn_primitive", "Create a polygonal primitive and select the new object.", {
      type: "object",
      additionalProperties: false,
      required: ["type"],
      properties: {
        type: {
          type: "string",
          enum: [...PRIMITIVE_TYPES, "sphere"],
          description: "Primitive kind. Use uvSphere (sphere is an alias). Cubes are 6-quad meshes, not voxels.",
        },
        name: { type: "string" },
        width: { type: "number" },
        height: { type: "number" },
        depth: { type: "number" },
        radius: { type: "number" },
        tube: { type: "number" },
        segments: { type: "integer" },
        widthSegments: { type: "integer" },
        heightSegments: { type: "integer" },
        radialSegments: { type: "integer" },
        tubularSegments: { type: "integer" },
      },
    }),
    tool("select_components", "Select an object or tagged faces (top, bottom, sides, front, back, caps).", {
      type: "object",
      additionalProperties: false,
      properties: {
        objectId: { type: "string" },
        domain: { type: "string", enum: ["object", "face", "edge", "vertex"] },
        tags: { type: "array", items: { type: "string" } },
        elementIds: { type: "array", items: { type: "string" } },
      },
    }),
    tool("extrude_faces", "Extrude the currently selected faces along their normals.", {
      type: "object",
      additionalProperties: false,
      required: ["distance"],
      properties: { distance: { type: "number" } },
    }),
    tool("inset_faces", "Inset the currently selected faces.", {
      type: "object",
      additionalProperties: false,
      required: ["distance"],
      properties: { distance: { type: "number" } },
    }),
    tool("bevel_edges", "Bevel the currently selected edges.", {
      type: "object",
      additionalProperties: false,
      required: ["offset"],
      properties: {
        offset: { type: "number" },
        segments: { type: "integer" },
      },
    }),
    tool("subdivide_faces", "Linear-subdivide the selected faces (or all faces).", {
      type: "object",
      additionalProperties: false,
      properties: { cuts: { type: "integer" } },
    }),
    tool("catmull_clark", "Catmull-Clark subdivide the active mesh.", {
      type: "object",
      additionalProperties: false,
      properties: { iterations: { type: "integer" } },
    }),
    tool("loop_cut", "Cut a quad edge loop starting from the selected edge (Blender-style).", {
      type: "object",
      additionalProperties: false,
      properties: {
        factor: { type: "number" },
        cuts: { type: "integer" },
        startEdgeId: { type: "string" },
      },
    }),
    tool("dissolve_edges", "Dissolve the currently selected edges into n-gons.", {
      type: "object",
      additionalProperties: false,
      properties: {},
    }),
    tool("fill_boundary", "Cap the selected or mesh boundary loop.", {
      type: "object",
      additionalProperties: false,
      properties: { method: { type: "string", enum: ["ngon", "fan", "triangulate"] } },
    }),
    tool("knife_stroke", "Cut the active mesh along world-space snap points.", {
      type: "object",
      additionalProperties: false,
      required: ["points"],
      properties: {
        points: {
          type: "array",
          items: { type: "array", items: { type: "number" }, minItems: 3, maxItems: 3 },
        },
        snapRadius: { type: "number" },
      },
    }),
    tool("heal_mesh", "Remove isolated vertices, collapse zero-length edges, and fix duplicate faces.", {
      type: "object",
      additionalProperties: false,
      properties: {},
    }),
    tool("weld_vertices", "Weld coincident vertices on the active mesh within a distance epsilon.", {
      type: "object",
      additionalProperties: false,
      properties: { epsilon: { type: "number" } },
    }),
    tool("triangulate_faces", "Triangulate selected faces, or all faces if none are selected.", {
      type: "object",
      additionalProperties: false,
      properties: {},
    }),
    tool("merge_vertices", "Merge the currently selected vertices to a target position.", {
      type: "object",
      additionalProperties: false,
      properties: {
        target: { type: "string", enum: ["center", "active", "first", "last", "cursor", "custom"] },
      },
    }),
    tool("connect_vertices", "Cut a diagonal between two selected vertices on a shared face.", {
      type: "object",
      additionalProperties: false,
      properties: {},
    }),
    tool("transform_selection", "Translate the current selection or active object.", {
      type: "object",
      additionalProperties: false,
      properties: {
        x: { type: "number" },
        y: { type: "number" },
        z: { type: "number" },
      },
    }),
    tool("undo", "Undo the last committed modeling command.", {
      type: "object",
      additionalProperties: false,
      properties: {},
    }),
    tool("redo", "Redo the last undone modeling command.", {
      type: "object",
      additionalProperties: false,
      properties: {},
    }),
    tool("inspect_scene", "Return a compact structured scene summary (counts, bounds, manifold, selection).", {
      type: "object",
      additionalProperties: false,
      properties: {},
    }),
    tool("save_scene", "Serialize the document to native versioned JSON for the host to persist.", {
      type: "object",
      additionalProperties: false,
      properties: {},
    }),
  ];
}

export function listEditorToolNames(): readonly string[] {
  return getEditorToolDefinitions().map((item) => item.function.name);
}

export function executeEditorTool(
  editor: FluentEditor,
  name: string,
  args: unknown = {},
): EditorToolResult {
  const parsed = parseArgs(args);
  try {
    switch (name) {
      case "spawn_primitive": {
        const type = resolvePrimitiveType(requireString(parsed, "type"));
        const object = editor.spawn.primitive(type, spawnParams(parsed));
        return success(editor, name, { objectId: object.objectId, meshId: object.meshId });
      }
      case "select_components": {
        const object = resolveTarget(editor, optionalString(parsed, "objectId"));
        if (!object) {
          throw new RangeError("select_components requires a spawned or identified object");
        }
        const domain = optionalString(parsed, "domain") ?? "face";
        const tags = optionalStringArray(parsed, "tags");
        const elementIds = optionalStringArray(parsed, "elementIds");
        if (domain === "object" || (tags.length === 0 && elementIds.length === 0)) {
          object.selectObject();
        } else if (domain === "face" && tags[0]) {
          object.select(tags[0] as "top");
        } else if (domain === "face") {
          object.selectFaces(elementIds as FaceId[]);
        } else if (domain === "edge") {
          object.selectEdges(elementIds.length > 0 ? (elementIds as EdgeId[]) : "all");
        } else if (domain === "vertex") {
          object.selectVertices(elementIds.length > 0 ? (elementIds as VertexId[]) : "all");
        }
        return success(editor, name);
      }
      case "extrude_faces":
        requireActive(editor).extrude(requireNumber(parsed, "distance"));
        return success(editor, name);
      case "inset_faces":
        requireActive(editor).inset(requireNumber(parsed, "distance"));
        return success(editor, name);
      case "bevel_edges":
        requireActive(editor).bevel(requireNumber(parsed, "offset"), {
          ...(hasNumber(parsed, "segments") ? { segments: parsed.segments as number } : {}),
        });
        return success(editor, name);
      case "subdivide_faces":
        requireActive(editor).subdivide(hasNumber(parsed, "cuts") ? (parsed.cuts as number) : 1);
        return success(editor, name);
      case "catmull_clark":
        requireActive(editor).catmullClark(
          hasNumber(parsed, "iterations") ? (parsed.iterations as number) : 1,
        );
        return success(editor, name);
      case "loop_cut": {
        const startEdgeId = optionalString(parsed, "startEdgeId");
        requireActive(editor).loopCut(hasNumber(parsed, "factor") ? (parsed.factor as number) : 0.5, {
          ...(hasNumber(parsed, "cuts") ? { cuts: parsed.cuts as number } : {}),
          ...(startEdgeId ? { startEdgeId: startEdgeId as EdgeId } : {}),
        });
        return success(editor, name);
      }
      case "dissolve_edges":
        requireActive(editor).dissolve();
        return success(editor, name);
      case "fill_boundary": {
        const method = optionalString(parsed, "method");
        requireActive(editor).fillHole(
          method === "fan" || method === "triangulate" || method === "ngon" ? method : "ngon",
        );
        return success(editor, name);
      }
      case "knife_stroke":
        requireActive(editor).knife(requirePointList(parsed, "points"), optionalNumber(parsed, "snapRadius") ?? 0.15);
        return success(editor, name);
      case "heal_mesh":
        requireActive(editor).heal();
        return success(editor, name);
      case "weld_vertices":
        requireActive(editor).weld(optionalNumber(parsed, "epsilon") ?? 1e-6);
        return success(editor, name);
      case "triangulate_faces":
        requireActive(editor).triangulate();
        return success(editor, name);
      case "merge_vertices": {
        const target = optionalString(parsed, "target");
        requireActive(editor).mergeVertices(
          target === "active" ||
            target === "first" ||
            target === "last" ||
            target === "cursor" ||
            target === "custom"
            ? target
            : "center",
        );
        return success(editor, name);
      }
      case "connect_vertices":
        requireActive(editor).connectVertices();
        return success(editor, name);
      case "transform_selection": {
        const delta: VecDelta = {
          ...(hasNumber(parsed, "x") ? { x: parsed.x as number } : {}),
          ...(hasNumber(parsed, "y") ? { y: parsed.y as number } : {}),
          ...(hasNumber(parsed, "z") ? { z: parsed.z as number } : {}),
        };
        editor.selection.move(delta);
        return success(editor, name);
      }
      case "undo":
        editor.undo();
        return success(editor, name);
      case "redo":
        editor.redo();
        return success(editor, name);
      case "inspect_scene":
        return success(editor, name);
      case "save_scene":
        return success(editor, name, { json: editor.session.saveNativeJson() });
      default:
        throw new RangeError(`Unknown editor tool: ${name}`);
    }
  } catch (error) {
    return {
      ok: false,
      tool: name,
      error: error instanceof Error ? error.message : String(error),
      inspection: editor.inspect(),
    };
  }
}

export { createEditor };
export type ToolDefinition = EditorToolDefinition;
export type ToolExecutionResult = EditorToolResult;

function success(editor: FluentEditor, toolName: string, data?: unknown): EditorToolSuccess {
  return data !== undefined
    ? { ok: true, tool: toolName, inspection: editor.inspect(), data }
    : { ok: true, tool: toolName, inspection: editor.inspect() };
}

function resolveTarget(editor: FluentEditor, objectId: string | undefined): FluentMeshObject | undefined {
  if (objectId) {
    const current = editor.session.selection.objectIds[0];
    if (current !== objectId) {
      editor.session.selection.replace({
        domain: "object",
        objectIds: [objectId as ObjectId],
        elementIds: [],
      });
    }
  }
  return editor.activeObject();
}

function requireActive(editor: FluentEditor): FluentMeshObject {
  const object = editor.activeObject();
  if (!object) {
    throw new RangeError("No active mesh object. Spawn or select one first.");
  }
  return object;
}

function parseArgs(args: unknown): Record<string, unknown> {
  if (typeof args === "string") {
    const parsed: unknown = JSON.parse(args);
    return asRecord(parsed);
  }
  if (args === undefined || args === null) {
    return {};
  }
  return asRecord(args);
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError("Tool arguments must be a JSON object");
  }
  return value as Record<string, unknown>;
}

function requireString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError(`Missing string argument: ${key}`);
  }
  return value;
}

function optionalString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" ? value : undefined;
}

function requireNumber(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError(`Missing number argument: ${key}`);
  }
  return value;
}

function hasNumber(record: Record<string, unknown>, key: string): boolean {
  return typeof record[key] === "number" && Number.isFinite(record[key] as number);
}

function optionalNumber(record: Record<string, unknown>, key: string): number | undefined {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function requirePointList(record: Record<string, unknown>, key: string): Array<readonly [number, number, number]> {
  const value = record[key];
  if (!Array.isArray(value) || value.length < 2) {
    throw new TypeError(`${key} must be an array of at least two [x,y,z] points`);
  }
  return value.map((item, index) => {
    if (!Array.isArray(item) || item.length < 3) {
      throw new TypeError(`${key}[${index}] must be [x, y, z]`);
    }
    const x = item[0];
    const y = item[1];
    const z = item[2];
    if (typeof x !== "number" || typeof y !== "number" || typeof z !== "number") {
      throw new TypeError(`${key}[${index}] must contain finite numbers`);
    }
    return [x, y, z] as const;
  });
}

function optionalStringArray(record: Record<string, unknown>, key: string): string[] {
  const value = record[key];
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string");
}

function resolvePrimitiveType(type: string): PrimitiveType {
  try {
    return canonicalizePrimitiveType(type);
  } catch {
    throw new RangeError(`Unsupported primitive type: ${type}`);
  }
}

function spawnParams(record: Record<string, unknown>): {
  name?: string;
  width?: number;
  height?: number;
  depth?: number;
  radius?: number;
  tube?: number;
  segments?: number;
  widthSegments?: number;
  heightSegments?: number;
  radialSegments?: number;
  tubularSegments?: number;
} {
  const params: {
    name?: string;
    width?: number;
    height?: number;
    depth?: number;
    radius?: number;
    tube?: number;
    segments?: number;
    widthSegments?: number;
    heightSegments?: number;
    radialSegments?: number;
    tubularSegments?: number;
  } = {};
  const name = optionalString(record, "name");
  if (name !== undefined) params.name = name;
  const numKeys = [
    "width",
    "height",
    "depth",
    "radius",
    "tube",
    "segments",
    "widthSegments",
    "heightSegments",
    "radialSegments",
    "tubularSegments",
  ] as const;

  for (const key of numKeys) {
    if (typeof record[key] === "number") {
      (params as Record<string, unknown>)[key] = record[key];
    }
  }

  return params;
}
