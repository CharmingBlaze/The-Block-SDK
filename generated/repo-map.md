# Repository map

Generated from `packages/*/package.json`. Do not edit by hand. Refresh with `pnpm repo:map`.

## @modeling-kit/animation

- Purpose: Canonical clips, tracks, and renderer-neutral evaluation
- Layer: editor
- Version: 0.1.0
- Public entry keys: .
- Internal directories: packages/animation/src/compatibility, packages/animation/src/evaluation, packages/animation/src/model, packages/animation/src/playback, packages/animation/src/validation
- Workspace dependencies: @modeling-kit/core, @modeling-kit/document, @modeling-kit/math, @modeling-kit/rigging
- Forbidden: three
- Requirement ID prefixes: ANIM
- Tests: packages/animation/tests

## @modeling-kit/commands

- Purpose: Documented edits, session, fluent editor
- Layer: editor
- Version: 0.1.0
- Public entry keys: .
- Internal directories: packages/commands/src/automatic-unwrap
- Workspace dependencies: @modeling-kit/animation, @modeling-kit/core, @modeling-kit/document, @modeling-kit/history, @modeling-kit/materials, @modeling-kit/math, @modeling-kit/mesh, @modeling-kit/paint, @modeling-kit/primitives, @modeling-kit/rigging, @modeling-kit/scene, @modeling-kit/selection, @modeling-kit/tools, @modeling-kit/transform, @modeling-kit/uv, @modeling-kit/validation
- Forbidden: three; DOM
- Requirement ID prefixes: CMD
- Tests: packages/commands/tests

## @modeling-kit/core

- Purpose: Branded IDs, Result, events, lifecycle machines, dirty flags
- Layer: foundation
- Version: 0.1.0
- Public entry keys: .
- Internal directories: (flat src)
- Workspace dependencies: (none)
- Forbidden: three; @modeling-kit/three-adapter; DOM
- Requirement ID prefixes: CORE, ID, LIFE
- Tests: packages/core/tests

## @modeling-kit/document

- Purpose: Canonical ModelDocument, hierarchy, serialization
- Layer: document
- Version: 0.1.0
- Public entry keys: .
- Internal directories: (flat src)
- Workspace dependencies: @modeling-kit/core, @modeling-kit/math
- Forbidden: three; DOM
- Requirement ID prefixes: DOC, SER
- Tests: packages/document/tests

## @modeling-kit/formats

- Purpose: glTF/OBJ/STL interchange via glTF Transform (PLY allowed, not implemented)
- Layer: io
- Version: 0.1.0
- Public entry keys: ., ./browser, ./node
- Internal directories: packages/formats/src/capability, packages/formats/src/gltf
- Workspace dependencies: @modeling-kit/animation, @modeling-kit/core, @modeling-kit/document, @modeling-kit/math, @modeling-kit/mesh, @modeling-kit/rigging, @modeling-kit/scene
- Forbidden: three
- Requirement ID prefixes: FMT
- Tests: packages/formats/tests

## @modeling-kit/history

- Purpose: Undo/redo stacks and command manager
- Layer: editor
- Version: 0.1.0
- Public entry keys: .
- Internal directories: (flat src)
- Workspace dependencies: @modeling-kit/core, @modeling-kit/document, @modeling-kit/mesh, @modeling-kit/selection
- Forbidden: three; DOM
- Requirement ID prefixes: HIST, CMD
- Tests: packages/history/tests

## @modeling-kit/input

- Purpose: Headless actions/gestures; DOM bind is ./dom
- Layer: interaction
- Version: 0.1.0
- Public entry keys: ., ./dom
- Internal directories: (flat src)
- Workspace dependencies: @modeling-kit/math
- Forbidden: three (main entry)
- Requirement ID prefixes: INP
- Tests: packages/input/tests

## @modeling-kit/materials

- Purpose: Material definitions and slots
- Layer: attributes
- Version: 0.1.0
- Public entry keys: .
- Internal directories: (flat src)
- Workspace dependencies: @modeling-kit/core, @modeling-kit/document, @modeling-kit/mesh
- Forbidden: three
- Requirement ID prefixes: MAT
- Tests: packages/materials/tests

## @modeling-kit/math

- Purpose: Headless vectors, matrices, and geometric helpers
- Layer: foundation
- Version: 0.1.0
- Public entry keys: .
- Internal directories: packages/math/src/bvh
- Workspace dependencies: (none)
- Forbidden: three; DOM; other workspace packages
- Requirement ID prefixes: MATH
- Tests: packages/math/tests

## @modeling-kit/mesh

- Purpose: Half-edge kernel and topology operators
- Layer: kernel
- Version: 0.1.0
- Public entry keys: .
- Internal directories: packages/mesh/src/internal, packages/mesh/src/operations, packages/mesh/src/triangulation
- Workspace dependencies: @modeling-kit/core, @modeling-kit/math
- Forbidden: tools; commands; document; three; DOM
- Requirement ID prefixes: MESH, MESH-OP
- Tests: packages/mesh/tests

## @modeling-kit/meshopt

- Purpose: Optional meshoptimizer adapter on derived triangles only
- Layer: io
- Version: 0.1.0
- Public entry keys: .
- Internal directories: (flat src)
- Workspace dependencies: @modeling-kit/core
- Forbidden: three; canonical mesh mutation
- Requirement ID prefixes: JOB
- Tests: packages/meshopt/tests

## @modeling-kit/paint

- Purpose: Image/paint revision helpers
- Layer: attributes
- Version: 0.1.0
- Public entry keys: .
- Internal directories: (flat src)
- Workspace dependencies: @modeling-kit/core, @modeling-kit/mesh, @modeling-kit/uv
- Forbidden: three
- Requirement ID prefixes: PAINT
- Tests: packages/paint/tests

## @modeling-kit/primitives

- Purpose: Procedural mesh generators (box, sphere, …)
- Layer: kernel
- Version: 0.1.0
- Public entry keys: .
- Internal directories: packages/primitives/src/library, packages/primitives/src/profile-extrude, packages/primitives/src/source
- Workspace dependencies: @modeling-kit/core, @modeling-kit/mesh, @modeling-kit/validation
- Forbidden: three; DOM
- Requirement ID prefixes: PRIM
- Tests: packages/primitives/tests

## @modeling-kit/rigging

- Purpose: Canonical skeletons, skins, inverse binds, and weight validation
- Layer: editor
- Version: 0.1.0
- Public entry keys: .
- Internal directories: packages/rigging/src/evaluation, packages/rigging/src/skeleton, packages/rigging/src/skin
- Workspace dependencies: @modeling-kit/core, @modeling-kit/document, @modeling-kit/math, @modeling-kit/mesh
- Forbidden: three
- Requirement ID prefixes: RIG
- Tests: packages/rigging/tests

## @modeling-kit/scene

- Purpose: Document scene helpers and re-exports
- Layer: document
- Version: 0.1.0
- Public entry keys: .
- Internal directories: (flat src)
- Workspace dependencies: @modeling-kit/core, @modeling-kit/document, @modeling-kit/math
- Forbidden: three; DOM
- Requirement ID prefixes: SCENE
- Tests: packages/scene/tests

## @modeling-kit/sdk

- Purpose: Host facade; currently pulls three-adapter (ARCH-003)
- Layer: facade
- Version: 0.1.0
- Public entry keys: ., ./ai, ./three
- Internal directories: (flat src)
- Workspace dependencies: @modeling-kit/animation, @modeling-kit/commands, @modeling-kit/core, @modeling-kit/document, @modeling-kit/formats, @modeling-kit/history, @modeling-kit/input, @modeling-kit/materials, @modeling-kit/math, @modeling-kit/mesh, @modeling-kit/paint, @modeling-kit/primitives, @modeling-kit/rigging, @modeling-kit/scene, @modeling-kit/selection, @modeling-kit/snapping, @modeling-kit/three-adapter, @modeling-kit/tools, @modeling-kit/transform, @modeling-kit/uv, @modeling-kit/validation, @modeling-kit/workers
- Peer dependencies: @modeling-kit/three-adapter, three
- Forbidden: new runtime engines without provenance
- Requirement ID prefixes: SDK, ARCH
- Tests: packages/sdk/tests

## @modeling-kit/selection

- Purpose: Branded-ID selection and topology grow/shrink
- Layer: editor
- Version: 0.1.0
- Public entry keys: .
- Internal directories: packages/selection/src/picking
- Workspace dependencies: @modeling-kit/core, @modeling-kit/math, @modeling-kit/mesh
- Forbidden: three; DOM; commands
- Requirement ID prefixes: SEL
- Tests: packages/selection/tests

## @modeling-kit/snapping

- Purpose: Snap queries and tolerances
- Layer: editor
- Version: 0.1.0
- Public entry keys: .
- Internal directories: (flat src)
- Workspace dependencies: @modeling-kit/math, @modeling-kit/mesh
- Forbidden: three
- Requirement ID prefixes: SNAP
- Tests: packages/snapping/tests

## @modeling-kit/three-adapter

- Purpose: Derived Three.js viewport, picking, overlays
- Layer: adapter
- Version: 0.1.0
- Public entry keys: .
- Internal directories: packages/three-adapter/src/animation, packages/three-adapter/src/gpu-picking, packages/three-adapter/src/overlays, packages/three-adapter/src/rigging, packages/three-adapter/src/spatial-query, packages/three-adapter/src/sub-element
- Workspace dependencies: @modeling-kit/commands, @modeling-kit/core, @modeling-kit/document, @modeling-kit/math, @modeling-kit/mesh, @modeling-kit/rigging, @modeling-kit/selection
- Peer dependencies: three
- Forbidden: canonical mesh mutation
- Requirement ID prefixes: VP, ARCH
- Tests: packages/three-adapter/tests

## @modeling-kit/tools

- Purpose: Tool state machines and pointer claims
- Layer: interaction
- Version: 0.1.0
- Public entry keys: .
- Internal directories: (flat src)
- Workspace dependencies: @modeling-kit/core, @modeling-kit/input, @modeling-kit/mesh, @modeling-kit/snapping
- Forbidden: three
- Requirement ID prefixes: TOOL
- Tests: packages/tools/tests

## @modeling-kit/transform

- Purpose: Object/component transforms and gizmos data
- Layer: editor
- Version: 0.1.0
- Public entry keys: .
- Internal directories: (flat src)
- Workspace dependencies: @modeling-kit/core, @modeling-kit/document, @modeling-kit/math, @modeling-kit/mesh, @modeling-kit/scene, @modeling-kit/snapping
- Forbidden: three
- Requirement ID prefixes: XFORM
- Tests: packages/transform/tests

## @modeling-kit/uv

- Purpose: UV islands and 2D editing helpers
- Layer: attributes
- Version: 0.1.0
- Public entry keys: .
- Internal directories: packages/uv/src/unwrap
- Workspace dependencies: @modeling-kit/core, @modeling-kit/math, @modeling-kit/mesh
- Forbidden: three
- Requirement ID prefixes: UV
- Tests: packages/uv/tests

## @modeling-kit/validation

- Purpose: Mesh invariant checks and healing reports
- Layer: kernel
- Version: 0.1.0
- Public entry keys: .
- Internal directories: (flat src)
- Workspace dependencies: @modeling-kit/core, @modeling-kit/math, @modeling-kit/mesh
- Forbidden: three; DOM
- Requirement ID prefixes: VAL
- Tests: packages/validation/tests

## @modeling-kit/workers

- Purpose: Async job boundaries for heavy mesh work
- Layer: io
- Version: 0.1.0
- Public entry keys: ., ./browser, ./node
- Internal directories: (flat src)
- Workspace dependencies: @modeling-kit/mesh, @modeling-kit/uv, @modeling-kit/validation
- Forbidden: three; DOM in the runtime-neutral entry
- Requirement ID prefixes: JOB
- Tests: packages/workers/tests

