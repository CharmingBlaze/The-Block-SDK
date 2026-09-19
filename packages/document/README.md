# @modeling-kit/document

**Canonical document model for The Block SDK.** Defines the serializable document structure, entity store, and document lifecycle — the single source of truth for all modeling data.

## Purpose

The `document` package provides:

- **EntityStore** — a type-safe container for all document entities (objects, meshes, materials, skeletons, animations, textures, images)
- **Document lifecycle** — creation, serialization, deserialization, and schema migration
- **Schema versioning** — `CURRENT_SCHEMA_VERSION` with explicit migration paths
- **Serialization** — JSON round-trip with base64 binary blobs for textures and images
- **Editor session creation** — `createEditorSession` bundling document, history, and selection

## Key Exports

```ts
import {
  createDocument, createEditorSession, createModelDocument,
  EntityStore, type EntityStoreJson,
  documentFromUnknown, parseDocument, serializeDocument, toSerializedDocument,
  bytesToBase64, base64ToBytes,
  CURRENT_SCHEMA_VERSION,
  type CreateDocumentOptions, type EditorSession,
} from "@modeling-kit/document";

// Also re-exports core data types used across the SDK:
import type {
  AlphaMode, AnimationChannel, AnimationClipData, AnimationKeyframe,
  AnimationLoopMode, AnimationTrackData, BoneData, ColorSpace,
  MaterialData, MeshObjectData, ObjectData, SkeletonData,
  TextureData, TextureSamplerData, UVChannelData,
  // ... and many more
} from "@modeling-kit/document";
```

## Usage Example

```ts
import { createModelDocument, serializeDocument, parseDocument } from "@modeling-kit/document";

// Create a fresh document
const doc = createModelDocument({ name: "MyModel" });

// Add entities...
// doc.store.add(objectData);
// doc.store.add(meshData);

// Serialize
const json = serializeDocument(doc);
const asString = JSON.stringify(json, null, 2);

// Deserialize (with schema migration)
const parsed = parseDocument(JSON.parse(asString));
// parsed is the same shape as the original document
```

## Architecture Notes

- The document is the **canonical source of truth** — Three.js BufferGeometries, GPU resources, and UI state are derived from it.
- `EntityStore` uses **branded ID keys** to prevent type confusion between different entity kinds.
- Serialization produces a **versioned JSON schema**; old documents are migrated on load.
- `createEditorSession` wires together document, `CommandManager` (undo/redo), and `SelectionManager` — this is the entry point used by `createEditor()` from `@modeling-kit/sdk`.
- The `types.ts` file is comprehensive — it defines the shape of every serializable entity in the SDK.