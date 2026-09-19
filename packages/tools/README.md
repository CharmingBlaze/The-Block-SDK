# @modeling-kit/tools

**Interactive topology tools.** Provides modal tool sessions for knife cut, loop cut, extrude, bevel, merge/weld, profile drawing, and a tool manager that coordinates tool activation.

## Purpose

The `tools` package bridges between user input (pointer events) and mesh operations:

- **KnifeTool** — draw cut lines across faces; supports snapping, live preview, and multi-segment cuts
- **LoopCutTool** — interactive edge loop insertion with sliding factor
- **ModalToolSession** — manages tool lifecycle: activate, update (pointer move), commit/cancel
- **ToolManager** — ownes active tool state, handles tool switching and conflict resolution
- **ProfileDrawTool** — interactive 2D profile drawing for extrusion
- **InteractionCoordinator** — routes pointer events to the active tool

## Key Exports

```ts
// Tools
import {
  KnifeTool, type KnifeHitOptions,
  LoopCutTool, ExtrudeTool, BevelTool, MergeTool,
  ProfileDrawTool,
  type ProfileDrawKind, type ProfileDrawParameters, type ProfileDrawPoint,
} from "@modeling-kit/tools";

// Session management
import {
  ModalToolSession,
  ToolManager,
  InteractionCoordinator,
  type ActionResult, type Tool, type ToolContext, type ToolId,
} from "@modeling-kit/tools";

// Operations exposed via tools
import {
  insetFaces, subdivideFaces, weldVertices,
  bridgeLoops, bevelEdges, dissolveEdges,
  loopCut, previewLoopCut, loopCutFactors,
  splitEdge, cutFace,
} from "@modeling-kit/tools";
```

## Usage Example

```ts
import { KnifeTool, ToolManager } from "@modeling-kit/tools";
import type { ModelingSession } from "@modeling-kit/commands";

const toolManager = new ToolManager(session);

// Activate knife tool
const knife = new KnifeTool({ snapRadius: 0.1 });
toolManager.activate(knife);

// Feed pointer events
knife.onPointerDown({ worldPosition: [0.5, 1.0, 0.0], faceId: "f-0" });
knife.onPointerMove({ worldPosition: [1.5, 1.0, 0.0], faceId: "f-0" });
// ... preview updates automatically

// Commit the cut
const result = knife.commit();
// result.cuts contains the executed knife plan

// Or cancel
knife.cancel();
```

## Architecture Notes

- Tools follow a **modal session pattern**: activate → update (repeated) → commit | cancel.
- `ModalToolSession` wraps the lifecycle and provides common functionality (preview state, dirty tracking).
- `ToolManager` ensures only **one tool is active at a time** — activating a new tool cancels the previous one.
- Tools delegate to mesh operations (`@modeling-kit/mesh`) for the actual topology work — the tool layer handles user interaction state only.
- The `InteractionCoordinator` can route pointer events from any source (Three.js viewport, custom renderer, headless).
- See `docs/architecture/interactive-tools.md` for detailed tool lifecycle diagrams.