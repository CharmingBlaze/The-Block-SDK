# Interactive tools and transform gestures

Host apps activate one `EditorTool` at a time through `ToolManager`. Tools own **preview session state**. Topology and object transforms commit through `@modeling-kit/commands` and `@modeling-kit/transform`.

## Lifecycle

`CORE-003` / `XF-002` / `INP-003` share `OperationLifecycleMachine`:

`idle → beginning → active → committing → completed`  
or `… → cancelling → cancelled`  
or `failed`.

- **`TransformGesture`** is one-shot. After `commit()` or `restoreBaseline()`, further `update()` throws. Call `dispose()` to cancel an open drag and drop baselines.
- **Modal tools** (`KnifeTool`, `LoopCutTool`, `ExtrudeTool`, `BevelTool`, `MergeTool`) wrap the machine in `ModalToolSession`. After commit/cancel they `recycle()` to `idle` so the same instance can start another stroke.
- **`ToolManager.dispose()`** aborts the active tool, disposes every registered tool, and clears pointer claims. It is idempotent.

## Preview vs commit

| Tool | Preview (no kernel mutate) | Commit (command) |
| ---- | -------------------------- | ---------------- |
| Knife | hits, `overlayState` / `planKnifeStroke` | `takeStroke()` → `KnifeCutCommand` |
| Loop cut | `previewLoopCut` segments | `takeParams()` → `LoopCutCommand` |
| Extrude | `distance` / `slide` | `takeParams()` → `ExtrudeFacesCommand` |
| Bevel | `offset` / `segments` | `takeParams()` → `BevelEdgesCommand` |
| Merge | `epsilon` | `takeParams()` → merge command |

Knife strokes are capped at 4096 hits so a stuck pointer cannot grow unbounded. Overlay planning reuses one `IdFactory` on the tool instance.

## Memory

Do not clone the live mesh on pointer move for extrude/bevel. Overlay geometry is ephemeral arrays. `runTransactionalMeshOp` snapshots only inside kernel ops that may throw mid-mutate; that snapshot is stack-scoped and discarded after the call.
