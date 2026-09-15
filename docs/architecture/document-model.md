# Document Model Architecture

**Packages:** `@modeling-kit/core`, `@modeling-kit/document`, `@modeling-kit/scene`  
**License posture:** Clean-room independent implementation. No GPL code. No Minecraft or game-specific constraints.

---

## 1. Overview and Core Philosophy

The `ModelDocument` is the canonical, serializable data model of the SDK. It represents the persistent state of a 3D modeling project.

Architectural invariants:

1. **Zero UI/Renderer Coupling:** No DOM types, Canvas, WebGL contexts, or Three.js objects exist in the document or scene graph.
2. **Deterministic Serialization:** Plain JSON serialization with ordered entity maps and explicit schema versioning.
3. **Immutability and Revisioning:** Document mutations increment revision numbers, producing granular change sets (`DocumentChangeSet`) consumed by adapters and UI frameworks.
4. **Separation of Concerns:** Transient UI state (tool modes, selection sets, gizmo drag previews, view cameras) resides exclusively in `EditorSession`, never in `ModelDocument`.

---

## 2. Canonical Document Schema

```ts
import { Brand } from "@modeling-kit/core";
import { MeshKernelData, MeshId } from "@modeling-kit/mesh";

export type DocumentId = Brand<string, "DocumentId">;
export type ObjectId = Brand<string, "ObjectId">;
export type MaterialId = Brand<string, "MaterialId">;
export type TextureId = Brand<string, "TextureId">;
export type SkeletonId = Brand<string, "SkeletonId">;
export type AnimationId = Brand<string, "AnimationId">;

export interface ModelDocument {
  readonly schemaVersion: number;
  readonly id: DocumentId;
  readonly name: string;
  readonly settings: DocumentSettings;
  readonly scene: SceneGraphData;
  readonly meshes: EntityStore<MeshKernelData>;
  readonly materials: EntityStore<MaterialData>;
  readonly textures: EntityStore<TextureData>;
  readonly skeletons: EntityStore<SkeletonData>;
  readonly animations: EntityStore<AnimationClipData>;
  readonly metadata: Record<string, unknown>;
}

export interface DocumentSettings {
  readonly units: "unitless" | "millimeter" | "centimeter" | "meter" | "inch";
  readonly unitsPerMeter: number;
  readonly upAxis: "Y";
  readonly forwardAxis: "-Z";
  readonly handedness: "right";
  readonly angleUnit: "degrees";
  readonly gridSize: number;
}
```

---

## 3. EntityStore Design

Entities are stored in typed `EntityStore<T>` collections providing $O(1)$ lookups, iteration, and dirty-state tracking:

```ts
export interface EntityStore<T extends { readonly id: Brand<string, string> }> {
  readonly entities: ReadonlyMap<T["id"], T>;
  readonly revision: number;
  get(id: T["id"]): T | undefined;
  has(id: T["id"]): boolean;
  values(): IterableIterator<T>;
  keys(): IterableIterator<T["id"]>;
  size: number;
}
```

---

## 4. Scene Graph Architecture

The scene graph defines parent-child spatial relationships and scene hierarchy. Canonical data lives in `@modeling-kit/document`; `@modeling-kit/scene` re-exports the same operations.

```ts
export interface SceneGraphData {
  readonly rootNodeId: NodeId;
  readonly rootIds: readonly NodeId[];
  readonly nodes: EntityStore<SceneNode>;
}
```

`rootNodeId` is the synthetic scene origin. `rootIds` is the outliner order of its children and must match `origin.childIds`. `NodeId` is the scene-graph name for `ObjectId`. Nodes store local transforms only; world matrices are cached and invalidated per subtree. Persistent edits go through document transactions and commands. Three.js remains a one-way mirror of `DocumentChangeSet` events.

### 4.1 Hierarchy Operations & Cycle Prevention

The scene graph manager enforces:

- **Acyclic Graph (DAG):** Reparenting validates that `newParentId` is not a descendant of `nodeId`. Any cycle attempt raises `CyclicHierarchyError`.
- **World Transform Preservation:** When moving a node to a new parent, the manager computes:
  $$\mathbf{M}_{\text{local\_new}} = \mathbf{M}_{\text{world\_new\_parent}}^{-1} \cdot \mathbf{M}_{\text{world\_old}}$$
  avoiding unintended shifts in 3D space unless local-preserve mode is explicitly requested.

---

## 5. Editor Session (Transient State)

Transient interaction state is isolated from the document:

```ts
export interface EditorSession {
  readonly document: ModelDocument;
  readonly selection: SelectionState;
  readonly activeTool: string;
  readonly transformSpace: "world" | "local" | "parent" | "normal";
  readonly pivotMode: "median" | "bounds" | "active" | "cursor" | "individual";
  readonly snapping: SnappingSettings;
  readonly history: CommandHistory;
  readonly interaction: InteractionState;
}

export interface InteractionState {
  readonly hoveredElement: HoverTarget | null;
  readonly isDragging: boolean;
  readonly previewPayload: unknown | null;
  readonly activeViewportId: string | null;
}
```

_Rule:_ Dragging, previewing, and hover states never write to `ModelDocument` or create history entries until a transaction commits or pointer is released.

---

## 6. Schema Migrations & Extension Safety

1. **Schema Versioning:** Every document carries an integer `schemaVersion`.
2. **Forward Migration:** Migration functions pipeline older versions sequentially (`v1 -> v2 -> v3`).
3. **Unknown Metadata Preservation:** Third-party extensions or application hosts can store arbitrary JSON in `metadata` fields; the serializer guarantees unmolested round-tripping.
