import {
  brand,
  createIdFactory,
  emptyDocumentRevisions,
  type Emitter,
  type EditorEvents,
  type IdFactory,
  type ObjectId,
  type ToolId,
} from "@modeling-kit/core";
import { identityTransform } from "@modeling-kit/math";
import { EntityStore } from "./entity-store";
import { CURRENT_SCHEMA_VERSION, type ModelDocument, type SceneNode } from "./types";

export interface CreateDocumentOptions {
  readonly name?: string;
  readonly ids?: IdFactory;
  readonly metadata?: Record<string, unknown>;
}

export function createModelDocument(options: CreateDocumentOptions = {}): ModelDocument {
  const ids = options.ids ?? createIdFactory();
  const rootId = ids.object();
  const root: SceneNode = {
    id: rootId,
    name: "Scene",
    type: "group",
    parentId: null,
    childIds: [],
    visible: true,
    locked: false,
    selectable: true,
    localTransform: identityTransform(),
    tags: [],
    metadata: {},
  };
  const nodes = new EntityStore<SceneNode>();
  nodes.set(root);
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    revision: 0,
    revisions: emptyDocumentRevisions(),
    id: ids.document(),
    name: options.name ?? "Untitled",
    settings: {
      units: "meter",
      unitsPerMeter: 1,
      upAxis: "Y",
      forwardAxis: "-Z",
      handedness: "right",
      angleUnit: "degrees",
      gridSize: 1,
    },
    scene: {
      rootNodeId: rootId,
      rootIds: [],
      nodes,
    },
    meshes: new EntityStore(),
    materials: new EntityStore(),
    materialInstances: new EntityStore(),
    textures: new EntityStore(),
    textureSets: new EntityStore(),
    images: new EntityStore(),
    skeletons: new EntityStore(),
    animations: new EntityStore(),
    metadata: { ...options.metadata },
    lifecycle: "ready",
  };
}

export interface SelectionState {
  domain: "object" | "vertex" | "edge" | "face" | "uv" | "bone" | "keyframe" | "none";
  objectIds: ObjectId[];
  elementIds: string[];
}

export interface SnappingSettings {
  enabled: boolean;
  gridSize: number;
}

export interface InteractionState {
  hoveredElement: { domain: string; id: string } | null;
  isDragging: boolean;
  previewPayload: unknown | null;
  activeViewportId: string | null;
}

export interface EditorSession {
  readonly document: ModelDocument;
  readonly events: Emitter<EditorEvents>;
  selection: SelectionState;
  activeTool: ToolId;
  transformSpace: "world" | "local" | "parent" | "normal" | "view";
  pivotMode: "median" | "bounds" | "active" | "cursor" | "individual";
  snapping: SnappingSettings;
  interaction: InteractionState;
}

export function createEditorSession(
  document: ModelDocument,
  events: Emitter<EditorEvents>,
): EditorSession {
  return {
    document,
    events,
    selection: { domain: "none", objectIds: [], elementIds: [] },
    activeTool: brand("select"),
    transformSpace: "parent",
    pivotMode: "median",
    snapping: { enabled: true, gridSize: 1 },
    interaction: {
      hoveredElement: null,
      isDragging: false,
      previewPayload: null,
      activeViewportId: null,
    },
  };
}
