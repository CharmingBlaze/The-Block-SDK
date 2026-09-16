import type { EdgeId, FaceId, ObjectId, VertexId } from "@modeling-kit/core";
import { canonicalizePrimitiveType, type PrimitiveType } from "@modeling-kit/primitives";
import {
  createEditor,
  type FluentEditor,
  type FluentMeshObject,
  type VecDelta,
} from "@modeling-kit/commands";
import type { SceneInspectionResult } from "@modeling-kit/commands";
import type { MergeVertexTarget } from "@modeling-kit/mesh";
import { assertValidToolArgs, ToolArgumentError } from "./ai-schema";

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
  readonly code?: string;
  readonly field?: string;
  readonly retryable?: boolean;
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
  "quadSphere",
  "icosphere",
  "torus",
  "capsule",
  "ramp",
  "stairs",
  "arch",
  "wall",
  "column",
  "quad",
  "rectangle",
  "roundedRectangle",
  "stadium",
  "ellipse",
  "annulus",
  "superellipse",
  "squircle",
  "reuleux",
  "roundedCube",
  "ellipsoid",
  "tetrahedron",
  "icosahedron",
];

const FACE_TAGS = ["top", "bottom", "front", "back", "sides", "caps", "all", "left", "right"] as const;
const MERGE_TARGETS: readonly MergeVertexTarget[] = [
  "center",
  "active",
  "first",
  "last",
  "cursor",
  "custom",
];

const VEC3 = {
  type: "array",
  items: { type: "number" },
  minItems: 3,
  maxItems: 3,
} as const;

const TOOLS: Record<string, { description: string; parameters: JsonSchemaObject }> = {
  spawn_primitive: {
    description: "Create a polygonal primitive and select the new object.",
    parameters: {
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
    },
  },
  select_components: {
    description: "Select an object or tagged faces (top, bottom, sides, front, back, caps).",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        objectId: { type: "string" },
        domain: { type: "string", enum: ["object", "face", "edge", "vertex"] },
        tags: { type: "array", items: { type: "string", enum: [...FACE_TAGS] } },
        elementIds: { type: "array", items: { type: "string" } },
      },
    },
  },
  extrude_faces: {
    description: "Extrude the currently selected faces along their normals.",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["distance"],
      properties: { distance: { type: "number" } },
    },
  },
  inset_faces: {
    description: "Inset the currently selected faces.",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["distance"],
      properties: { distance: { type: "number" } },
    },
  },
  bevel_edges: {
    description: "Bevel the currently selected edges.",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["offset"],
      properties: {
        offset: { type: "number" },
        segments: { type: "integer" },
        miterMode: { type: "string", enum: ["sharp", "clip"] },
        overlapMode: { type: "string", enum: ["clamp", "error"] },
        allowClipFallback: { type: "boolean" },
        miterLimit: { type: "number" },
      },
    },
  },
  set_edge_creases: {
    description: "Set normalized Catmull-Clark crease weights on selected edges.",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["weight"],
      properties: { weight: { type: "number" } },
    },
  },
  subdivide_faces: {
    description: "Linear-subdivide the selected faces (or all faces).",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: { cuts: { type: "integer" } },
    },
  },
  catmull_clark: {
    description: "Catmull-Clark subdivide the active mesh.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: { iterations: { type: "integer" } },
    },
  },
  loop_cut: {
    description: "Cut a quad edge loop starting from the selected edge (Blender-style).",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        factor: { type: "number" },
        cuts: { type: "integer" },
        startEdgeId: { type: "string" },
      },
    },
  },
  dissolve_edges: {
    description: "Dissolve the currently selected edges into n-gons.",
    parameters: { type: "object", additionalProperties: false, properties: {} },
  },
  fill_boundary: {
    description: "Cap the selected or mesh boundary loop.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: { method: { type: "string", enum: ["ngon", "fan", "triangulate"] } },
    },
  },
  knife_stroke: {
    description: "Cut the active mesh along world-space snap points.",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["points"],
      properties: {
        points: { type: "array", minItems: 2, items: VEC3 },
        snapRadius: { type: "number" },
      },
    },
  },
  heal_mesh: {
    description: "Remove isolated vertices, collapse zero-length edges, and fix duplicate faces.",
    parameters: { type: "object", additionalProperties: false, properties: {} },
  },
  weld_vertices: {
    description: "Weld coincident vertices on the active mesh within a distance epsilon.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: { epsilon: { type: "number" } },
    },
  },
  triangulate_faces: {
    description: "Triangulate selected faces, or all faces if none are selected.",
    parameters: { type: "object", additionalProperties: false, properties: {} },
  },
  merge_vertices: {
    description: "Merge the currently selected vertices to a target position.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        target: { type: "string", enum: [...MERGE_TARGETS] },
        position: VEC3,
        cursorPosition: VEC3,
      },
    },
  },
  connect_vertices: {
    description: "Cut a diagonal between two selected vertices on a shared face.",
    parameters: { type: "object", additionalProperties: false, properties: {} },
  },
  transform_selection: {
    description: "Translate the current selection or active object.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        x: { type: "number" },
        y: { type: "number" },
        z: { type: "number" },
      },
    },
  },
  undo: {
    description: "Undo the last committed modeling command.",
    parameters: { type: "object", additionalProperties: false, properties: {} },
  },
  redo: {
    description: "Redo the last undone modeling command.",
    parameters: { type: "object", additionalProperties: false, properties: {} },
  },
  inspect_scene: {
    description: "Return a compact structured scene summary (counts, bounds, manifold, selection).",
    parameters: { type: "object", additionalProperties: false, properties: {} },
  },
  save_scene: {
    description: "Serialize the document to native versioned JSON for the host to persist.",
    parameters: { type: "object", additionalProperties: false, properties: {} },
  },
};

function tool(name: string, description: string, parameters: JsonSchemaObject): EditorToolDefinition {
  return { type: "function", function: { name, description, parameters } };
}

/** OpenAI-style function schemas for plugging `@modeling-kit` into an agent. */
export function getEditorToolDefinitions(): readonly EditorToolDefinition[] {
  return Object.entries(TOOLS).map(([name, item]) => tool(name, item.description, item.parameters));
}

export function listEditorToolNames(): readonly string[] {
  return getEditorToolDefinitions().map((item) => item.function.name);
}

export function executeEditorTool(
  editor: FluentEditor,
  name: string,
  args: unknown = {},
): EditorToolResult {
  try {
    const parsed = parseArgs(args);
    const definition = TOOLS[name];
    if (!definition) {
      throw new RangeError(`Unknown editor tool: ${name}`);
    }
    const record = assertValidToolArgs(definition.parameters, parsed);
    switch (name) {
      case "spawn_primitive": {
        const type = resolvePrimitiveType(requireString(record, "type"));
        const object = editor.spawn.primitive(type, spawnParams(record));
        return success(editor, name, { objectId: object.objectId, meshId: object.meshId });
      }
      case "select_components": {
        const object = resolveTarget(editor, optionalString(record, "objectId"));
        if (!object) {
          throw new RangeError("select_components requires a spawned or identified object");
        }
        const domain = optionalString(record, "domain") ?? "face";
        const tags = stringArray(record, "tags");
        const elementIds = stringArray(record, "elementIds");
        if (domain === "object" || (tags.length === 0 && elementIds.length === 0)) {
          object.selectObject();
        } else if (domain === "face" && tags.length > 0) {
          const taggedIds = object.faceIdsForTags(tags);
          const extra = elementIds as FaceId[];
          object.selectFaces(extra.length > 0 ? [...taggedIds, ...extra] : taggedIds);
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
        requireActive(editor).extrude(requireNumber(record, "distance"));
        return success(editor, name);
      case "inset_faces":
        requireActive(editor).inset(requireNumber(record, "distance"));
        return success(editor, name);
      case "bevel_edges": {
        const miterMode = optionalString(record, "miterMode");
        const overlapMode = optionalString(record, "overlapMode");
        requireActive(editor).bevel(requireNumber(record, "offset"), {
          ...(hasNumber(record, "segments") ? { segments: record.segments as number } : {}),
          ...(miterMode === "sharp" || miterMode === "clip" ? { miterMode } : {}),
          ...(overlapMode === "clamp" || overlapMode === "error" ? { overlapMode } : {}),
          ...(record.allowClipFallback === true ? { allowClipFallback: true } : {}),
          ...(hasNumber(record, "miterLimit") ? { miterLimit: record.miterLimit as number } : {}),
        });
        return success(editor, name);
      }
      case "set_edge_creases":
        requireActive(editor).setCrease(requireNumber(record, "weight"));
        return success(editor, name);
      case "subdivide_faces":
        requireActive(editor).subdivide(hasNumber(record, "cuts") ? (record.cuts as number) : 1);
        return success(editor, name);
      case "catmull_clark":
        requireActive(editor).catmullClark(
          hasNumber(record, "iterations") ? (record.iterations as number) : 1,
        );
        return success(editor, name);
      case "loop_cut": {
        const startEdgeId = optionalString(record, "startEdgeId");
        requireActive(editor).loopCut(hasNumber(record, "factor") ? (record.factor as number) : 0.5, {
          ...(hasNumber(record, "cuts") ? { cuts: record.cuts as number } : {}),
          ...(startEdgeId ? { startEdgeId: startEdgeId as EdgeId } : {}),
        });
        return success(editor, name);
      }
      case "dissolve_edges":
        requireActive(editor).dissolve();
        return success(editor, name);
      case "fill_boundary": {
        const method = optionalString(record, "method");
        requireActive(editor).fillHole(
          method === "fan" || method === "triangulate" || method === "ngon" ? method : "ngon",
        );
        return success(editor, name);
      }
      case "knife_stroke":
        requireActive(editor).knife(requirePointList(record, "points"), optionalNumber(record, "snapRadius") ?? 0.15);
        return success(editor, name);
      case "heal_mesh":
        requireActive(editor).heal();
        return success(editor, name);
      case "weld_vertices":
        requireActive(editor).weld(optionalNumber(record, "epsilon") ?? 1e-6);
        return success(editor, name);
      case "triangulate_faces":
        requireActive(editor).triangulate();
        return success(editor, name);
      case "merge_vertices": {
        const target = (optionalString(record, "target") ?? "center") as MergeVertexTarget;
        const position = optionalVec3(record, "position");
        const cursorPosition = optionalVec3(record, "cursorPosition");
        if (target === "custom" && !position) {
          throw new ToolArgumentError("merge_vertices target custom requires position: [x, y, z]", {
            field: "position",
          });
        }
        if (target === "cursor" && !cursorPosition) {
          throw new ToolArgumentError(
            "merge_vertices target cursor requires cursorPosition: [x, y, z]",
            { field: "cursorPosition" },
          );
        }
        requireActive(editor).mergeVertices(target, {
          ...(position ? { position } : {}),
          ...(cursorPosition ? { cursorPosition } : {}),
        });
        return success(editor, name);
      }
      case "connect_vertices":
        requireActive(editor).connectVertices();
        return success(editor, name);
      case "transform_selection": {
        const delta: VecDelta = {
          ...(hasNumber(record, "x") ? { x: record.x as number } : {}),
          ...(hasNumber(record, "y") ? { y: record.y as number } : {}),
          ...(hasNumber(record, "z") ? { z: record.z as number } : {}),
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
        return success(editor, name, { json: editor.session.serializeNativeJson() });
      default:
        throw new RangeError(`Unknown editor tool: ${name}`);
    }
  } catch (error) {
    return failure(editor, name, error);
  }
}

export { createEditor };
export type ToolDefinition = EditorToolDefinition;
export type ToolExecutionResult = EditorToolResult;

function success(editor: FluentEditor, toolName: string, data?: unknown): EditorToolSuccess {
  return data !== undefined
    ? { ok: true, tool: toolName, inspection: safeInspect(editor), data }
    : { ok: true, tool: toolName, inspection: safeInspect(editor) };
}

function failure(editor: FluentEditor, toolName: string, error: unknown): EditorToolFailure {
  const argumentError = error instanceof ToolArgumentError ? error : undefined;
  return {
    ok: false,
    tool: toolName,
    error: error instanceof Error ? error.message : String(error),
    inspection: safeInspect(editor),
    ...(argumentError ? { code: argumentError.code, retryable: true } : {}),
    ...(argumentError?.field ? { field: argumentError.field } : {}),
  };
}

function safeInspect(editor: FluentEditor): SceneInspectionResult {
  try {
    return editor.inspect();
  } catch (error) {
    return {
      totalObjects: 0,
      canUndo: false,
      canRedo: false,
      objects: [],
      summary: `inspection unavailable: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
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
    throw new ToolArgumentError("Tool arguments must be a JSON object");
  }
  return value as Record<string, unknown>;
}

function requireString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new ToolArgumentError(`Missing string argument: ${key}`, { field: key });
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
    throw new ToolArgumentError(`Missing number argument: ${key}`, { field: key });
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

function stringArray(record: Record<string, unknown>, key: string): string[] {
  const value = record[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function optionalVec3(
  record: Record<string, unknown>,
  key: string,
): readonly [number, number, number] | undefined {
  const value = record[key];
  if (!Array.isArray(value)) {
    return undefined;
  }
  const x = value[0];
  const y = value[1];
  const z = value[2];
  if (
    typeof x !== "number" ||
    typeof y !== "number" ||
    typeof z !== "number" ||
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    !Number.isFinite(z)
  ) {
    throw new ToolArgumentError(`${key} must be [x, y, z] finite numbers`, { field: key });
  }
  return [x, y, z];
}

function requirePointList(record: Record<string, unknown>, key: string): Array<readonly [number, number, number]> {
  const value = record[key];
  if (!Array.isArray(value) || value.length < 2) {
    throw new ToolArgumentError(`${key} must be an array of at least two [x,y,z] points`, { field: key });
  }
  return value.map((item, index) => {
    if (!Array.isArray(item) || item.length !== 3) {
      throw new ToolArgumentError(`${key}[${index}] must be [x, y, z]`, { field: `${key}[${index}]` });
    }
    const x = item[0];
    const y = item[1];
    const z = item[2];
    if (
      typeof x !== "number" ||
      typeof y !== "number" ||
      typeof z !== "number" ||
      !Number.isFinite(x) ||
      !Number.isFinite(y) ||
      !Number.isFinite(z)
    ) {
      throw new ToolArgumentError(`${key}[${index}] must contain finite numbers`, {
        field: `${key}[${index}]`,
      });
    }
    return [x, y, z] as const;
  });
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
    if (hasNumber(record, key)) {
      params[key] = record[key] as number;
    }
  }

  return params;
}
