# Documentation

**The Block SDK** is a headless TypeScript SDK for polygonal 3D modeling. Public packages are `@modeling-kit/*`. The private workspace root is `modeling-kit`. Hosts own cameras, renderers, and UI. Persistent edits go through commands. Topology lives on the half-edge kernel. `THREE.BufferGeometry` is derived only.

There is no Minecraft, Blockbench, or other game-format pipeline. Native versioned JSON is the canonical save format. Implemented interchange is glTF/GLB, Wavefront OBJ, ASCII STL, and PPM images. PLY is an allowed open standard; there is no codec yet.

Public packages are MIT-licensed and currently versioned `0.1.0`. They are not on npm until `v0.1.0` is tagged with `NPM_TOKEN` set. See [Publishing](guides/publishing.md).

**Requirements:** Node.js 22+, pnpm 11. Do not lower `engines.node` until a Node 20 job using a package manager that supports Node 20 is green. This repo's `packageManager` is pnpm 11.7, which requires Node >=22.13.

## Start here

| If you want to… | Read |
| --- | --- |
| Install and run the first cube → extrude → undo loop | [Getting started](guides/getting-started.md) |
| Script models with tagged faces | [Fluent editor](guides/fluent-editor.md) |
| Mount a Three.js viewport | [Viewport](guides/viewport.md) |
| Import / export glTF, OBJ, STL | [Formats](guides/formats.md) |
| Plug the SDK into an agent | [AI tools](guides/ai-tools.md) |
| Run host apps in this repo | [Examples](guides/examples.md) |
| Contribute or run the test gate | [Contributing](guides/contributing.md) |

The root [README](../README.md) lists every package and the systems they implement.

## Host guides

| Guide | Contents |
| --- | --- |
| [Getting started](guides/getting-started.md) | Install, fluent editor, session/commands, viewport, workers, dispose |
| [Fluent editor](guides/fluent-editor.md) | `createEditor()`, spawn, face tags, operators, inspect |
| [Viewport](guides/viewport.md) | `createThreeViewport`, GPU click picking, overlays, disposal |
| [Custom host picking](guides/custom-host-picking.md) | `picking: false` and host-owned pointer handlers |
| [Selection, transform, snapping](guides/selection-transform.md) | Domains, grow/shrink, gestures, snap query |
| [Formats](guides/formats.md) | Native JSON, glTF/GLB, OBJ, STL, PPM; what is lost |
| [Workers](guides/workers.md) | Inline / browser / Node compute pools |
| [AI tools](guides/ai-tools.md) | `getEditorToolDefinitions` / `executeEditorTool` |
| [UV editor](guides/uv-editor.md) | Headless UV session, projections, automatic unwrap |
| [Paint and images](guides/paint-image.md) | Tiles, layers, strokes, 3D paint |
| [Materials](guides/materials.md) | PBR/unlit, slots, texture sets |
| [Examples](guides/examples.md) | Playground, React, Vue, gallery, smoke |
| [Publishing](guides/publishing.md) | Changesets, `v*` tags, npm |
| [Contributing](guides/contributing.md) | Tooling, tests, clean-room, agent workflow |

### Geometry backends

| Guide | Contents |
| --- | --- |
| [Geometry predicates](guides/geometry-predicates.md) | Robust `orient2d`/`orient3d` vs `GeometryTolerance` |
| [Primitive-geometry](guides/primitive-geometry.md) | Library recipes → `HalfEdgeMesh` |
| [Triangulation](guides/triangulation.md) | Ear clip vs Earcut; 0.1 interactive limits; [1.1 profiler](investigations/large-mesh-triangulation/) |
| [Profile extrude](guides/profile-extrude.md) | 2D profile / path walls |
| [Meshopt](guides/meshopt.md) | Derived-triangle reorder and LOD |

## Architecture

These documents are the design source of truth. Do not treat the historical [roadmap](roadmap.md) as completion evidence.

| Doc | Contents |
| --- | --- |
| [Operator specification](architecture/modeling-operator-specification.md) | Release 1.0 requirement IDs (master spec) |
| [SDK architecture](architecture/sdk-architecture.md) | Package graph, workers, public import shape |
| [Ownership](architecture/ownership.md) | Who owns document, session, GPU objects |
| [Dependency policy](architecture/dependency-policy.md) | Approved third-party libraries |
| [Mesh kernel](architecture/mesh-kernel.md) | Half-edge invariants |
| [Document model](architecture/document-model.md) | Schema and scene |
| [Command system](architecture/command-system.md) | Undo model |
| [Input](architecture/input.md) | Headless keymaps vs DOM |
| [Interactive tools](architecture/interactive-tools.md) | Preview vs commit |
| [Three.js adapter](architecture/three-adapter.md) | Sync, overlays, picking |
| [GPU ID picking](architecture/GPU-ID-PICKING.md) | Click ID-buffer pass |
| [Picking coordinator](architecture/PICKING-COORDINATOR.md) | Hybrid click/hover policy |
| [Primitive topology](architecture/primitive-topology.md) | Canonical vs library meshes |
| [Automatic UV unwrap](architecture/AUTOMATIC-UV-UNWRAP.md) | xatlas/watlas backend |
| [glTF pipeline](architecture/GLTF-PIPELINE.md) | glTF Transform interchange |
| [External resources](architecture/EXTERNAL-RESOURCES.md) | URI resolvers, no fetch in core |
| [Rigging](architecture/RIGGING.md) / [Skinning](architecture/SKINNING.md) / [Animation](architecture/ANIMATION.md) | Canonical skeleton/clip data (preview authoring) |
| [Simple bevels](architecture/SIMPLE-BEVEL-MITERS.md) / [Simple creases](architecture/SIMPLE-CREASES.md) | 1.0 limits |
| [ADRs](architecture/decisions/) | Recorded decisions |

## Verification and coordination

| Doc | Contents |
| --- | --- |
| [Release 1.0 evidence](verification/RELEASE-1.0-EVIDENCE.md) | Requirement status, tests, recorded gates |
| [Current milestone](coordination/CURRENT-MILESTONE.md) | What just shipped and what remains |
| [Release plan](coordination/RELEASE-PLAN.md) | Historical milestone order |
| [Task board](coordination/TASK-BOARD.md) | Antigravity/Cursor packets |
| [API freeze](coordination/API-FREEZE.md) | Frozen contracts |
| [Package boundaries](coordination/PACKAGE-BOUNDARIES.md) | Dependency direction |
| [Clean-room rules](research/clean-room-rules.md) | No GPL / no game formats |
| [Provenance log](research/provenance-log.md) | Third-party licenses |

Generated indexes (do not edit by hand): [`generated/repo-map.md`](../generated/repo-map.md), [`generated/public-api-index.md`](../generated/public-api-index.md), [`generated/package-graph.md`](../generated/package-graph.md), [`generated/test-index.md`](../generated/test-index.md). Refresh with `pnpm repo:indexes`.

## Out of 1.0

Boolean CSG, LSCM/ABF unwrap, paint/IO worker jobs, GPU hover, `THREE.InstancedMesh` picking, GPU-skinned picking, PLY codec, and DCC application UI. Rigging/animation **authoring** (IK, weight painting, NLA) is preview. Canonical skeleton/skin/clip data, evaluation, and glTF skins/animations/textures are implemented interchange targets.
