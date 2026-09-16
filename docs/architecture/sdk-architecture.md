# SDK architecture

Working name: **modeling-kit** (`@modeling-kit/*`). The name must stay easy to rename. No Blockbench branding.

## Purpose

A framework-agnostic TypeScript SDK for polygonal modeling, UV editing, painting, rigging, and animation. Hosts (Vue, React, Svelte, Electron, Tauri, plain canvas) own UI. This library owns the document, mesh kernel, commands, and optional Three.js views.

## Non-goals

- A Blockbench clone or competing DCC application
- Minecraft or other game-specific formats and display pipelines
- DOM, Vue, or React inside core packages
- Three.js as the editable model

## Source of truth

```
Host UI  →  commands / queries / events
                ↓
         EditorSession (transient)
                ↓
         ModelDocument (canonical, serializable)
                ↓
         Mesh kernel / scene / materials / rig / clips
                ↓
         ThreeViewportAdapter (derived GPU view)
```

Rules:

1. Persistent edits go through commands.
2. Algorithms run on the mesh kernel, never on `THREE.BufferGeometry`.
3. Selection uses branded IDs, never render indices.
4. Packages have no required global mutable state.

## Package dependency graph

Arrows mean “depends on”.

```
math
  ↑
core (IDs, Result, events primitives, branded types)
  ↑
document  ← validation
  ↑
mesh
  ↑
scene  selection  materials  uv
  ↑         ↑          ↑       ↑
  └─────────┴──────────┴───────┘
              commands
                 ↑
        history  transform  snapping  primitives  tools  input
                 ↑
        rigging  animation  paint  formats  workers
                 ↑
           three-adapter
                 ↑
        sdk (headless facade; `sdk/three` optional re-export)
```

`test-utils` may depend on any package but must not be published as a runtime requirement.

**Hard rule:** `document`, `mesh`, `scene`, `commands`, `history`, and `@modeling-kit/input` (main entry) must not import `three` or any DOM type. Hosts import `bindDom` from `@modeling-kit/input/dom`.

**Peer:** `three-adapter` takes `three` as a peer. `@modeling-kit/sdk` is headless; `three` / `three-adapter` are optional peers for `@modeling-kit/sdk/three` only.

## Public import shape (target)

```ts
import { ModelDocument, EditorSession } from "@modeling-kit/core";
import { Mesh, MeshBuilder } from "@modeling-kit/mesh";
import { CommandManager } from "@modeling-kit/history";
import { SelectionManager } from "@modeling-kit/selection";
import { TransformService } from "@modeling-kit/transform";
import { ThreeViewportAdapter, createThreeViewport } from "@modeling-kit/three-adapter";
import { createModelingSession } from "@modeling-kit/sdk";
```

See `docs/architecture/dependency-policy.md` for the approved library set and backend wrappers.

## Workers

`@modeling-kit/workers` stays runtime-neutral: no `node:` imports and no `process` global. Heavy jobs (triangulate, pack UVs, validate) run through `AsyncComputePool`.

| Import | Runtime |
| --- | --- |
| `@modeling-kit/workers` | Inline cooperative fallback. Safe for the headless SDK and for TypeScript hosts with no Node types. |
| `@modeling-kit/workers/browser` | `new Worker(new URL(..., import.meta.url), { type: "module" })`, transferable buffers, bounded queue, crash replacement. |
| `@modeling-kit/workers/node` | `worker_threads`. |

Bundlers that honor the `browser` export condition resolve `@modeling-kit/workers` to the browser worker. Node's `node` condition resolves to `worker_threads`. Hosts construct a pool with `createInlineComputePool`, `createBrowserComputePool`, or `createNodeComputePool` and call `dispose()` on unmount. There is no shared global pool.

The headless `@modeling-kit/sdk` re-exports the runtime-neutral pool so browser example apps do not pull Node types. Paint, format IO, and GPU picking stay on the main thread until they have their own task types.

Input is documented in `docs/architecture/input.md`. Hosts bind DOM separately (`@modeling-kit/input/dom`); the adapter does not own keymaps.

Ownership of document, session, tools, and derived Three.js objects is in `docs/architecture/ownership.md`.

## Session vs document

`ModelDocument` is what you save. `EditorSession` holds selection, active tool, transform space, pivot mode, snapping, history, interaction (hover, drag, box/lasso, previews), animation time, and playback.

Previews must not append history. Commit or cancel is explicit.

## Extension points

Host or plugin code may register: commands, tools, primitives, node types, material models, importers/exporters, validators, custom document keys, custom animation tracks.

Internal mutation APIs stay unpublished.

## Performance posture

Measure before specializing. Targets (from the master plan): interactive transforms without full serialize; undo without cloning the whole document for small edits; incremental viewport sync; workers for packing, heavy geometry, and IO. Diagnostics counters live behind a debug flag.

## Tooling (Phase 1)

pnpm workspaces, strict TypeScript, tsup (or equivalent) for libraries, Vite for apps, Vitest, ESLint, Prettier, Changesets. Playwright and Typedoc later. No publish without owner approval.
