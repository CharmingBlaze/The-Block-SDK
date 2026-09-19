# @modeling-kit/sdk

**Main entry point for The Block SDK.** Re-exports the full public API surface of all packages and provides the fluent `createEditor()` facade for quick-start modeling.

## Purpose

The `sdk` package is the **primary consumer-facing interface**:

- **Fluent editor** — `createEditor()` returns a chainable builder for spawning primitives, selecting faces, performing operations, and inspecting state
- **Full re-export** — every public type and function from all 24 packages is available from a single import
- **Optional sub-path exports** — `@modeling-kit/sdk/three` for viewport creation, `@modeling-kit/sdk/ai` for agent tool integration

## Key Exports

```ts
// Main entry — everything
import {
  // Fluent editor
  createEditor, type FluentEditor,
  // Core types
  brand, Emitter, type MeshId, type FaceId, type ObjectId,
  // Math
  Vector3, Matrix4, Quaternion, Ray, BoundingBox,
  // Mesh
  HalfEdgeMesh, MeshBuilder, extrudeFaces, bevelEdges,
  // Document & session
  createModelDocument, ModelingSession,
  // And everything else from all packages...
} from "@modeling-kit/sdk";

// Three.js viewport (optional)
import { createThreeViewport } from "@modeling-kit/sdk/three";

// AI agent tools (optional)
import { createAiTools } from "@modeling-kit/sdk/ai";
```

## Usage Example

```ts
import { createEditor } from "@modeling-kit/sdk";

const editor = createEditor();

// Fluent modeling
editor.spawn
  .cube({ size: 2, name: "Base" })
  .select("top")
  .extrude(0.5)
  .inset(0.1)
  .extrude(0.3);

// Inspect state
console.log(editor.inspect().summary);
// "Objects: 1 | Faces: 14 | Vertices: 16 | Selected: 1 face | Manifold: true"

// Undo/redo
editor.undo();  // undoes last extrude
editor.redo();  // re-applies it

// Selection transform
editor.selection.move({ y: 1 });
editor.selection.rotate({ angle: 45, axis: "y" });

// Cleanup
editor.dispose();
```

```ts
// Three.js viewport
import { createEditor } from "@modeling-kit/sdk";
import { createThreeViewport } from "@modeling-kit/sdk/three";

const editor = createEditor();
const viewport = createThreeViewport({
  container: document.getElementById("viewport")!,
  session: editor.session,
  orbitControls: true,
  picking: true,
  pickDomain: "face",
});

editor.spawn.cube({ size: 2 });
// Viewport renders automatically

viewport.dispose();
editor.dispose();
```

## Architecture Notes

- `@modeling-kit/sdk` is a **re-export facade** — it does not contain implementation code, only `package.json` exports pointing to the individual packages.
- The fluent editor (`createEditor`) creates a `ModelingSession`, wires up history and selection, and exposes the `spawn` API with face tags (`"top"`, `"bottom"`, `"sides"`, `"caps"`, `"all"`).
- `sdk/three` is a separate entry point that imports `three` (peer dependency) — applications that don't need Three.js don't bundle it.
- `sdk/ai` provides schematized tool descriptions for AI agents (LLM integration) to call SDK operations.
- See `docs/guides/getting-started.md` for the complete quick-start guide.