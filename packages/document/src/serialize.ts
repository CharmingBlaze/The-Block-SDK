import {
  SchemaError,
  UnsupportedSchemaVersionError,
  emptyDocumentRevisions,
  type NodeId,
} from "@modeling-kit/core";
import { EntityStore } from "./entity-store";
import { CURRENT_SCHEMA_VERSION, type MeshRecord, type ModelDocument, type SceneNode } from "./types";
import { applyMigrations } from "./migrate";
import { normalizeMaterial, normalizeTexture } from "./pbr";
import { normalizeClip, normalizeSkeleton, normalizeSkin } from "./clips";
import { assertValidDocument } from "./validation";
import { parseDocumentRevisions } from "./revisions";
import { normalizeImageDocument } from "./image";

export interface SerializedDocument {
  readonly schemaVersion: number;
  readonly revision?: number;
  readonly revisions?: ModelDocument["revisions"];
  readonly id: string;
  readonly name: string;
  readonly settings: ModelDocument["settings"];
  readonly scene: {
    readonly rootNodeId: string;
    readonly rootIds: readonly string[];
    readonly nodes: readonly SceneNode[];
  };
  readonly meshes: ReturnType<ModelDocument["meshes"]["toJSON"]>;
  readonly materials: ReturnType<ModelDocument["materials"]["toJSON"]>;
  readonly materialInstances: ReturnType<ModelDocument["materialInstances"]["toJSON"]>;
  readonly textures: ReturnType<ModelDocument["textures"]["toJSON"]>;
  readonly textureSets: ReturnType<ModelDocument["textureSets"]["toJSON"]>;
  readonly images: ReturnType<ModelDocument["images"]["toJSON"]>;
  readonly skeletons: ReturnType<ModelDocument["skeletons"]["toJSON"]>;
  readonly animations: ReturnType<ModelDocument["animations"]["toJSON"]>;
  readonly metadata: Record<string, unknown>;
}

export function serializeDocument(document: ModelDocument): string {
  const payload = toSerializedDocument(document);
  return `${JSON.stringify(sortJson(payload), null, 2)}\n`;
}

export function toSerializedDocument(document: ModelDocument): SerializedDocument {
  const nodes = [...document.scene.nodes.values()].sort((a, b) =>
    (a.id as string).localeCompare(b.id as string),
  );
  return {
    schemaVersion: document.schemaVersion,
    revision: document.revision,
    revisions: document.revisions ?? emptyDocumentRevisions(),
    id: document.id,
    name: document.name,
    settings: document.settings,
    scene: {
      rootNodeId: document.scene.rootNodeId,
      rootIds: [...document.scene.rootIds],
      nodes,
    },
    meshes: document.meshes.toJSON(),
    materials: document.materials.toJSON(),
    materialInstances: document.materialInstances.toJSON(),
    textures: document.textures.toJSON(),
    textureSets: document.textureSets.toJSON(),
    images: document.images.toJSON(),
    skeletons: document.skeletons.toJSON(),
    animations: document.animations.toJSON(),
    metadata: document.metadata,
  };
}

export function parseDocument(text: string): ModelDocument {
  let raw: unknown;
  try {
    raw = JSON.parse(text) as unknown;
  } catch (error) {
    throw new SchemaError(
      `Document JSON is malformed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  return documentFromUnknown(raw);
}

export function documentFromUnknown(raw: unknown): ModelDocument {
  if (!isRecord(raw)) {
    throw new SchemaError("Document must be an object");
  }
  const schemaVersion = requireNumber(raw, "schemaVersion");
  if (!Number.isInteger(schemaVersion) || schemaVersion < 1) {
    throw new SchemaError("schemaVersion must be a positive integer");
  }
  if (schemaVersion > CURRENT_SCHEMA_VERSION) {
    throw new UnsupportedSchemaVersionError(schemaVersion, CURRENT_SCHEMA_VERSION);
  }
  const migrated = applyMigrations(raw, schemaVersion);
  const id = requireString(migrated, "id");
  const name = requireString(migrated, "name");
  const settingsRaw = requireRecord(migrated, "settings");
  const sceneRaw = requireRecord(migrated, "scene");
  const rootNodeId = requireString(sceneRaw, "rootNodeId") as NodeId;
  const nodesArray = requireArray(sceneRaw, "nodes");
  const nodes = new EntityStore<SceneNode>();
  for (const item of nodesArray) {
    const node = parseNode(item);
    nodes.set(node);
  }
  if (!nodes.has(rootNodeId)) {
    throw new SchemaError("scene.rootNodeId is missing from nodes");
  }
  const origin = nodes.require(rootNodeId);
  const rootIds = Array.isArray(sceneRaw.rootIds)
    ? (sceneRaw.rootIds as NodeId[])
    : [...origin.childIds];
  const document: ModelDocument = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    revision: typeof migrated.revision === "number" ? migrated.revision : 0,
    revisions: parseDocumentRevisions(migrated.revisions),
    id: id as ModelDocument["id"],
    name,
    settings: parseSettings(settingsRaw),
    scene: { rootNodeId, rootIds, nodes },
    meshes: EntityStore.fromJSON(parseMeshes(migrated.meshes)),
    materials: EntityStore.fromJSON(parseMaterials(migrated.materials)),
    materialInstances: EntityStore.fromJSON(parseOptionalStore(migrated.materialInstances)),
    textures: EntityStore.fromJSON(parseTextures(migrated.textures)),
    textureSets: EntityStore.fromJSON(parseTextureSets(migrated.textureSets)),
    images: EntityStore.fromJSON(parseImages(migrated.images)),
    skeletons: EntityStore.fromJSON(parseSkeletons(migrated.skeletons)),
    animations: EntityStore.fromJSON(parseClips(migrated.animations)),
    metadata: isRecord(migrated.metadata) ? { ...migrated.metadata } : {},
    lifecycle: "ready",
  };
  assertValidDocument(document);
  return document;
}

function parseSettings(raw: Record<string, unknown>): ModelDocument["settings"] {
  const legacyUnit = parseUnit(raw.units ?? raw.unit);
  const units = legacyUnit === "generic" ? "unitless" : legacyUnit;
  const unitsPerMeter =
    typeof raw.unitsPerMeter === "number"
      ? raw.unitsPerMeter
      : units === "millimeter"
        ? 1000
        : units === "centimeter"
          ? 100
          : units === "inch"
            ? 39.37007874
            : 1;
  return {
    units,
    unitsPerMeter,
    upAxis: "Y",
    forwardAxis: "-Z",
    handedness: "right",
    angleUnit: "degrees",
    gridSize:
      typeof raw.gridSize === "number"
        ? raw.gridSize
        : typeof raw.gridSpacing === "number"
          ? raw.gridSpacing
          : 1,
  };
}

function parseMeshes(raw: unknown): { revision: number; items: MeshRecord[] } {
  const store = parseStore<MeshRecord>(raw);
  return {
    revision: store.revision,
    items: store.items.map((item) => {
      const skin = normalizeSkin(item.skin);
      return {
        ...item,
        materialSlots: Array.isArray(item.materialSlots) ? item.materialSlots : [],
        materialIds: Array.isArray(item.materialIds) ? item.materialIds : [],
        metadata: item.metadata ?? {},
        ...(skin ? { skin } : {}),
      };
    }),
  };
}

function parseMaterials(raw: unknown): {
  revision: number;
  items: ReturnType<typeof normalizeMaterial>[];
} {
  const store = parseStore(raw);
  return {
    revision: store.revision,
    items: store.items.map((item) => normalizeMaterial(item)),
  };
}

function parseTextures(raw: unknown): {
  revision: number;
  items: ReturnType<typeof normalizeTexture>[];
} {
  const store = parseStore(raw);
  return {
    revision: store.revision,
    items: store.items.map((item) => normalizeTexture(item)),
  };
}

function parseSkeletons(raw: unknown): {
  revision: number;
  items: ReturnType<typeof normalizeSkeleton>[];
} {
  const store = parseStore(raw);
  return { revision: store.revision, items: store.items.map((item) => normalizeSkeleton(item)) };
}

function parseClips(raw: unknown): { revision: number; items: ReturnType<typeof normalizeClip>[] } {
  const store = parseStore(raw);
  return { revision: store.revision, items: store.items.map((item) => normalizeClip(item)) };
}

function parseStore<T extends { readonly id: string }>(
  raw: unknown,
): { revision: number; items: T[] } {
  if (raw === undefined) {
    return { revision: 0, items: [] };
  }
  if (!isRecord(raw) || !Array.isArray(raw.items)) {
    throw new SchemaError("entity store must be { revision, items }");
  }
  return {
    revision: typeof raw.revision === "number" ? raw.revision : 0,
    items: raw.items as T[],
  };
}

function parseNode(raw: unknown): SceneNode {
  if (!isRecord(raw)) {
    throw new SchemaError("scene node must be an object");
  }
  const id = requireString(raw, "id") as NodeId;
  const childIds = Array.isArray(raw.childIds) ? (raw.childIds as NodeId[]) : [];
  const transform = isRecord(raw.localTransform) ? raw.localTransform : {};
  const position = isRecord(transform.position) ? transform.position : { x: 0, y: 0, z: 0 };
  const rotation = isRecord(transform.rotation) ? transform.rotation : { x: 0, y: 0, z: 0, w: 1 };
  const scale = isRecord(transform.scale) ? transform.scale : { x: 1, y: 1, z: 1 };
  const node: SceneNode = {
    id,
    name: typeof raw.name === "string" ? raw.name : id,
    type: parseNodeType(raw.type),
    parentId: typeof raw.parentId === "string" ? (raw.parentId as NodeId) : null,
    childIds,
    visible: raw.visible !== false,
    locked: raw.locked === true,
    selectable: raw.selectable !== false,
    localTransform: {
      position: {
        x: num(position.x, 0),
        y: num(position.y, 0),
        z: num(position.z, 0),
      },
      rotation: {
        x: num(rotation.x, 0),
        y: num(rotation.y, 0),
        z: num(rotation.z, 0),
        w: num(rotation.w, 1),
      },
      scale: {
        x: num(scale.x, 1),
        y: num(scale.y, 1),
        z: num(scale.z, 1),
      },
    },
    tags: Array.isArray(raw.tags) ? raw.tags.filter((t): t is string => typeof t === "string") : [],
    metadata: isRecord(raw.metadata) ? { ...raw.metadata } : {},
  };
  return {
    ...node,
    ...(typeof raw.payloadRef === "string" ? { payloadRef: raw.payloadRef } : {}),
    ...(typeof raw.meshId === "string" ? { meshId: raw.meshId as NonNullable<SceneNode["meshId"]> } : {}),
    ...(typeof raw.skeletonId === "string"
      ? { skeletonId: raw.skeletonId as NonNullable<SceneNode["skeletonId"]> }
      : {}),
    ...(typeof raw.extensionType === "string" ? { extensionType: raw.extensionType } : {}),
  };
}

function parseNodeType(value: unknown): SceneNode["type"] {
  const allowed: SceneNode["type"][] = [
    "group",
    "mesh",
    "mesh_instance",
    "primitive",
    "primitive_instance",
    "armature",
    "locator",
    "empty",
    "camera",
    "light",
    "bone",
    "reference-image",
    "reference_image",
    "extension",
  ];
  if (typeof value === "string" && (allowed as string[]).includes(value)) {
    return value as SceneNode["type"];
  }
  return "empty";
}

function parseImages(raw: unknown): {
  revision: number;
  items: ReturnType<typeof normalizeImageDocument>[];
} {
  const store = parseOptionalStore(raw);
  return {
    revision: store.revision,
    items: store.items.map((item) => normalizeImageDocument(item)),
  };
}

function parseTextureSets(raw: unknown): {
  revision: number;
  items: import("./types").TextureSet[];
} {
  const store = parseOptionalStore<import("./types").TextureSet>(raw);
  return {
    revision: store.revision,
    items: store.items.map((item) => {
      const channels =
        item.channels && typeof item.channels === "object" ? item.channels : {};
      const textureIds = Array.isArray(item.textureIds)
        ? item.textureIds
        : Object.values(channels).filter((id): id is NonNullable<typeof id> => typeof id === "string");
      return {
        id: item.id,
        name: item.name ?? "Texture Set",
        channels,
        textureIds,
        metadata: item.metadata ?? {},
      };
    }),
  };
}

function parseOptionalStore<T extends { readonly id: string }>(
  raw: unknown,
): { revision: number; items: T[] } {
  if (raw === undefined) {
    return { revision: 0, items: [] };
  }
  return parseStore<T>(raw);
}

function parseUnit(value: unknown): "meter" | "centimeter" | "millimeter" | "generic" | "inch" {
  if (
    value === "centimeter" ||
    value === "millimeter" ||
    value === "generic" ||
    value === "meter" ||
    value === "inch" ||
    value === "unitless"
  ) {
    return value === "unitless" ? "generic" : value;
  }
  return "meter";
}

function num(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireString(raw: Record<string, unknown>, key: string): string {
  const value = raw[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new SchemaError(`Missing string field '${key}'`);
  }
  return value;
}

function requireNumber(raw: Record<string, unknown>, key: string): number {
  const value = raw[key];
  if (typeof value !== "number") {
    throw new SchemaError(`Missing number field '${key}'`);
  }
  return value;
}

function requireRecord(raw: Record<string, unknown>, key: string): Record<string, unknown> {
  const value = raw[key];
  if (!isRecord(value)) {
    throw new SchemaError(`Missing object field '${key}'`);
  }
  return value;
}

function requireArray(raw: Record<string, unknown>, key: string): unknown[] {
  const value = raw[key];
  if (!Array.isArray(value)) {
    throw new SchemaError(`Missing array field '${key}'`);
  }
  return value;
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortJson);
  }
  if (isRecord(value)) {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      sorted[key] = sortJson(value[key]);
    }
    return sorted;
  }
  return value;
}
