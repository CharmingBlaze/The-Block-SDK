# UV editor

Headless UV editing lives in `@modeling-kit/uv`. Hosts draw with `UVViewData`; they do not put DOM or Three.js in this package.

Seam-based LSCM / ABF unwrap is **not** implemented. **Automatic chart unwrap** (`automaticUnwrap`) uses xatlas via watlas to chart and pack meshes. `projectUvs({ projection: "smart" })` is a **per-face planar projection**: each face is mapped onto the tangent/bitangent frame of that face’s geometric normal, then optionally normalized into `[0,1]`. Adjacent faces do not share a least-squares conformal chart. Use `planar`, `box`, `cylindrical`, or `spherical` when you want a single shared projection for a selection. Use `automaticUnwrap` for arbitrary connected geometry.

## Two machines

| Machine | Where | Role |
| ------- | ----- | ---- |
| `ResourceLifecycleMachine` | `UVEditor.resources` | Editor lifetime: initializing → ready → disposing → disposed |
| `OperationLifecycleMachine` | `UvTransformSession.lifecycle` | Same gesture as 3D `TransformGesture`: idle → beginning → active → committing → completed (then `recycle()` back to idle) |
| `UVInteractionMachine` | `UVEditor.interaction` | Pointer only: hover, press, box, lasso. Not used for undo |

Illegal operation transitions throw in non-production (`IllegalLifecycleTransitionError`), matching CORE-003.

## Session integration

```ts
import { createModelingSession, CreatePrimitiveCommand, ProjectUvsCommand } from "@modeling-kit/sdk";
import { uv } from "@modeling-kit/sdk";

const session = createModelingSession();
const cube = session.execute(new CreatePrimitiveCommand("cube", { width: 2, height: 2, depth: 2 }));
session.selection.replace({ domain: "object", objectId: cube.objectId });
session.execute(new ProjectUvsCommand({ projection: "box" }));

const editor = uv.createEditor({ session, meshId: cube.meshId, objectId: cube.objectId });
const view = editor.createViewAdapter();

editor.select({ mode: "vertex", operation: "replace", ids: [/* UVVertexId */] });
editor.transform.begin({ operation: "move", pivot: "selection-center" });
editor.transform.update({ translate: [0.1, 0] }); // preview; no history
editor.transform.commit(); // one SetCornerUvsCommand
editor.transform.cancel(); // restore baseline; zero commands

editor.dispose(); // views, cache, selection + mesh:changed subscriptions
```

Pointer marquee (UV space, not pixels):

```ts
editor.pointerDown([u0, v0], { mode: "vertex" });
editor.pointerMove([u1, v1]);
editor.pointerUp([u1, v1]);
```

## Invariants

- One history entry per committed gesture; cancel and zero-delta commits write none.
- Preview mutates the kernel then restores on cancel or before the commit command (when `onCommit` is set).
- Pinned corners stay at baseline unless `respectPins: false`.
- Hover must not rebuild UV connectivity (`UvTopologyCache` refreshes positions when only `uvRevision` changes).
- Derived cache keeps one entry per mesh+channel so drag previews cannot grow without bound.
- `UVViewAdapter.dispose()` unregisters from the editor; editor dispose is idempotent.
- 3D face selection sync is optional (`syncSelection`). Face replace is the only 3D domain that maps into the UV editor.

## Host draw loop

Call `view.getViewData()` after dirty flushes (or pass `schedule: (flush) => { const id = requestAnimationFrame(flush); return () => cancelAnimationFrame(id); }`). Cancel that schedule from `dispose` — the adapter already invokes the returned cancel function.

Automatic unwrap: [`../architecture/AUTOMATIC-UV-UNWRAP.md`](../architecture/AUTOMATIC-UV-UNWRAP.md). Index: [`../README.md`](../README.md).
