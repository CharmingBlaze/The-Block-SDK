# @modeling-kit/commands

**Modeling commands and session management.** Wires together mesh operations, history, and the document into undoable, re-playable command objects. Also provides `ModelingSession` — the central coordinator for all document mutations.

## Purpose

The `commands` package is the **command layer** that sits between tools (UI) and the mesh kernel:

- **Concrete command classes** — `CreatePrimitiveCommand`, `ExtrudeFacesCommand`, `BevelEdgesCommand`, `LoopCutCommand`, etc. — each wrapping a topology operation with undo support.
- **ModelingSession** — the central stateful coordinator that owns the document, history, selection, and material library. All mutations flow through the session.
- **PrimitiveCreationSession** — interactive 2D/3D primitive placement with pointer input and preview.
- **Profile extrude command** — creates extrusions from 2D profile definitions.

## Key Exports

```ts
import {
  ModelingSession,
  CreatePrimitiveCommand, CreateLibraryPrimitiveCommand,
  ExtrudeProfileCommand,
  ExtrudeFacesCommand, ExtrudeRegionCommand,
  InsetFacesCommand, SubdivideFacesCommand,
  HealMeshCommand, FillBoundaryCommand,
  BevelEdgesCommand, LoopCutCommand,
  DissolveEdgesCommand, DissolveVertexCommand, DissolveFaceCommand,
  CollapseEdgeCommand, ReverseFaceWindingCommand,
  BridgeLoopsCommand, SplitEdgeCommand, CutFaceCommand,
  ProjectUvCommand, AutomaticUnwrapCommand,
  AssignMaterialSlotCommand, AddMaterialSlotCommand,
  ReorderMaterialSlotsCommand, UpdateMaterialCommand,
  CreateMaterialCommand, AssignMaterialCommand,
  AddBoneCommand, SetBoneParentCommand,
  PaintStrokeCommand, PaintFloodFillCommand,
  DeleteCommand, DuplicateCommand, JoinCommand,
  type CreatePrimitiveParams, type CreatePrimitiveResult,
  type ExtrudeFacesParams, type ExtrudeRegionParams,
  type InsetFacesParams, type SubdivideFacesParams,
  // Primitive creation sessions
  PrimitiveCreationSession, CadPrimitiveDrawSession, PrimitivePlacementSession,
} from "@modeling-kit/commands";
```

## Usage Example

```ts
import { ModelingSession, ExtrudeFacesCommand } from "@modeling-kit/commands";
import { createEditorSession } from "@modeling-kit/document";

const editorSession = createEditorSession();
const session = new ModelingSession(editorSession);

// Create a primitive (undoable)
session.execute(new CreatePrimitiveCommand({ type: "cube", size: 2 }));

// Select a face and extrude
session.selection.set({ domain: "face", ids: ["f-0"] });
session.execute(new ExtrudeFacesCommand({ distance: 0.5 }));

// Undo
session.history.undo();  // undoes the extrude

// Redo
session.history.redo();  // re-applies the extrude
```

## Architecture Notes

- `ModelingSession` is the **single authority** for document state — no external code should mutate the document directly.
- Every command class defines: `execute()`, `undo()`, `redo()` — the command manager calls these automatically.
- Commands store **before/after state** for undo support (e.g., original vertex positions, deleted face records).
- `PrimitiveCreationSession` provides interactive primitive placement with pointer raycasting, work plane snapping, and live preview — used by the `cad` mode of the fluent editor.
- This package depends on nearly every other package (`mesh`, `document`, `history`, `selection`, `materials`, `uv`, etc.) — it's the integration layer.