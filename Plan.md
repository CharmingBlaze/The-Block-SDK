# Master Development Prompt: Reusable Three.js and TypeScript 3D Modeling SDK

You are the principal engineer, computational-geometry engineer, Three.js specialist, TypeScript library architect, test engineer, and technical writer responsible for building a reusable 3D-modeling foundation.

The reference application is:

https://github.com/JannisX11/blockbench

Our objective is not to clone the Blockbench interface or create another monolithic modeling application.

Our objective is to study the capabilities, behaviors, workflows, data structures, editing concepts, and edge cases demonstrated by Blockbench, then create an independent, reusable, framework-agnostic TypeScript SDK for building many different 3D modeling, UV editing, painting, rigging, and animation applications.

The result must allow future applications to install the SDK and immediately gain a reliable modeling foundation instead of rebuilding:

- Mesh topology

- Objects and hierarchy

- Selection

- Transforms

- Modeling operations

- Snapping

- Materials

- UV coordinates

- Texture painting

- Bones and rigging

- Animation

- Undo and redo

- Import and export

- Three.js viewport synchronization

- Serialization

- Validation

- Extension APIs

This library must not contain a hard-coded application interface.

React, Vue, Svelte, Electron, Tauri, Dockview, web components, and plain JavaScript applications must all be able to use it.

## Critical licence and clean-room requirements

> [!IMPORTANT]
> **Strict No-Minecraft Directive:** This SDK is a general polygonal 3D modeling kit (`@modeling-kit/*`). It strictly excludes all Minecraft and game-specific formats (Bedrock geometry, Java block/item JSON, GeckoLib, OptiFine .jem/.jpm, MoLang expressions, skin presets, display slot transforms, and Blockbench .bbmodel files). Cuboids are general 6-face polygonal meshes, not game blocks.

Blockbench is GPL-3.0 software. Do not copy, translate, lightly rewrite, mechanically convert, or transplant Blockbench implementation code unless the repository owner has explicitly selected GPL-3.0 for this new SDK.

Default to a clean-room implementation.

You may inspect Blockbench to identify:

- Features

- User-visible behavior

- Modeling terminology

- Workflow sequences

- Expected results

- File-format behavior

- Edge cases

- Architecture problems we should avoid

Do not copy:

- Function bodies

- Classes

- Algorithms expressed in source code

- Comments

- Unique identifiers

- UI assets

- Icons

- Textures

- Shaders

- Documentation passages

- Blockbench-specific file format implementations

- Code structure that is sufficiently distinctive to be derivative

Create these files before implementation:

```text

docs/research/blockbench-capability-map.md

docs/research/clean-room-rules.md

docs/research/provenance-log.md

docs/architecture/sdk-architecture.md

docs/architecture/mesh-kernel.md

docs/architecture/document-model.md

docs/architecture/command-system.md

docs/architecture/three-adapter.md

docs/roadmap.md

```

For every feature researched, record:

```text

Feature:

Observed behavior:

Public reference:

Our independent design:

Major differences:

Implementation status:

Tests:

Licence/provenance notes:

```

If existing Blockbench code is copied or adapted, stop and report the exact file, licence consequence, and replacement options before continuing.

Do not claim that renaming variables or converting JavaScript to TypeScript creates an independent implementation. It does not.

## Product definition

Create an SDK tentatively named `modeling-kit`.

The final name must be easy to change and must not use Blockbench branding.

The SDK should support low-poly and general polygonal modeling. It must not be restricted to Minecraft models, cuboids, voxel objects, or one game format.

It must support:

- Cuboid-based workflows

- General polygon meshes

- Triangles

- Quads

- N-gons where operations permit them

- UV-mapped meshes

- Object hierarchies

- Bones and skinned meshes

- Multiple animations per document

- Custom application-specific metadata

- Application-specific format extensions

The core must work without the DOM, browser canvas, WebGL, WebGPU, Vue, or React.

Three.js is the rendering adapter, not the source of truth.

## Architectural principles

Follow these rules:

1\. The canonical model exists in our typed document model.

2\. Three.js objects are derived views of that model.

3\. Editing never directly mutates `THREE.BufferGeometry`.

4\. Every persistent edit is represented by a command or transaction.

5\. Undo and redo restore exact prior state.

6\. Selection is represented by stable element IDs.

7\. Render-buffer indices are never treated as persistent topology IDs.

8\. Algorithms operate on the mesh kernel, not scene objects.

9\. UI frameworks communicate with the SDK through public commands, queries, and events.

10\. Importers convert external data into the canonical document.

11\. Exporters read canonical data and do not depend on viewport objects.

12\. Packages must not rely on global mutable variables.

13\. Public APIs must be strongly typed.

14\. Expensive operations must have worker-compatible boundaries.

15\. The SDK must be deterministic and testable without rendering.

16\. Invalid topology must be detected and reported, not silently accepted.

17\. Features must be implemented vertically with tests instead of being left as empty stubs.

## Repository structure

Use a TypeScript monorepo with pnpm workspaces and a build system appropriate for publishing multiple packages.

Create this structure:

```text

modeling-kit/

  apps/

    playground/

    example-vue/

    example-react/

  packages/

    math/

    core/

    document/

    mesh/

    scene/

    commands/

    history/

    selection/

    transform/

    snapping/

    tools/

    primitives/

    materials/

    uv/

    paint/

    rigging/

    animation/

    formats/

    three-adapter/

    workers/

    validation/

    test-utils/

  docs/

    architecture/

    guides/

    research/

    api/

  tests/

    integration/

    fixtures/

    visual/

```

Preferred tooling:

- TypeScript with strict mode

- pnpm workspaces

- Vite for example applications

- tsup or an equivalent library bundler

- Vitest for unit and integration tests

- Playwright for browser interaction tests

- Typedoc for API documentation

- ESLint

- Prettier

- Changesets for package versioning

- Three.js as a peer dependency where appropriate

Do not introduce a UI framework into the core packages.

## Public package model

The packages should eventually be installable separately:

```ts
import { ModelDocument, EditorSession } from "@modeling-kit/core";

import { Mesh, MeshBuilder } from "@modeling-kit/mesh";

import { CommandManager } from "@modeling-kit/history";

import { SelectionManager } from "@modeling-kit/selection";

import { TransformService } from "@modeling-kit/transform";

import { ThreeViewportAdapter } from "@modeling-kit/three-adapter";
```

Also provide a convenience package:

```ts
import { createModelingSession, createThreeViewport } from "@modeling-kit/sdk";
```

Applications must be able to use only the packages they need.

## Canonical document model

Design a versioned document model with stable UUID-style identifiers.

The root document should contain:

```ts
interface ModelDocument {
  schemaVersion: number;

  id: DocumentId;

  name: string;

  settings: DocumentSettings;

  scene: SceneGraph;

  meshes: EntityStore<MeshData>;

  materials: EntityStore<MaterialData>;

  textures: EntityStore<TextureData>;

  skeletons: EntityStore<SkeletonData>;

  animations: EntityStore<AnimationClipData>;

  metadata: Record<string, unknown>;
}
```

Use branded ID types rather than raw strings:

```ts
type Brand<T, Name extends string> = T & { readonly __brand: Name };

type DocumentId = Brand<string, "DocumentId">;

type ObjectId = Brand<string, "ObjectId">;

type MeshId = Brand<string, "MeshId">;

type VertexId = Brand<string, "VertexId">;

type EdgeId = Brand<string, "EdgeId">;

type FaceId = Brand<string, "FaceId">;

type MaterialId = Brand<string, "MaterialId">;

type BoneId = Brand<string, "BoneId">;

type AnimationId = Brand<string, "AnimationId">;
```

Document entities must be serializable. Do not store Three.js classes in persistent document data.

Provide:

- Schema validation

- Schema migrations

- Forward-version detection

- Corruption reporting

- Unknown metadata preservation

- Deterministic serialization

- Deep cloning where required

- Incremental dirty-state tracking

- Change sets

- Document revision numbers

## Editor session

Separate the saved document from transient editor state.

```ts
interface EditorSession {
  document: ModelDocument;

  selection: SelectionState;

  activeTool: ToolId;

  transformSpace: "world" | "local" | "parent" | "normal";

  pivotMode: "median" | "bounds" | "active" | "cursor" | "individual";

  snapping: SnappingSettings;

  history: CommandHistory;

  interaction: InteractionState;
}
```

Transient state includes:

- Hovered element

- Active viewport

- Drag state

- Box selection rectangle

- Lasso points

- Transform preview

- Primitive preview

- Snapping candidates

- Temporary tool overlays

- Current animation time

- Playback state

Transient preview operations must not create hundreds of undo entries during pointer movement.

## Scene graph

Implement a framework-independent scene hierarchy.

Node types should include:

- Group

- Mesh instance

- Primitive/cuboid object

- Empty or locator

- Bone

- Camera where applications need it

- Light where applications need it

- Reference image

- Custom extension node

Each node needs:

- Stable ID

- Name

- Parent ID

- Ordered child IDs

- Visibility

- Locked state

- Selectability

- Local transform

- Optional object payload reference

- Metadata

- Tags

Required hierarchy operations:

- Add

- Remove

- Reparent

- Reorder

- Duplicate

- Group

- Ungroup

- Rename

- Hide

- Lock

- Traverse

- Find ancestors and descendants

- Preserve world transform during reparenting

- Detect and reject hierarchy cycles

## Mesh kernel

This is the most important subsystem.

Do not use raw Three.js indexed geometry as the editable source of truth.

Implement an editable polygon mesh representation with stable vertex, edge, loop or corner, and face identities.

A half-edge structure is preferred if it is implemented carefully. A winged-edge or explicit vertex-edge-face structure is acceptable if it supports all required adjacency queries reliably.

The mesh must represent:

- Vertex position

- Edge endpoints

- Face boundary loops

- Per-corner UV coordinates

- Per-face material assignment

- Per-edge seam state

- Per-edge sharp or crease state

- Per-face smoothing state

- Optional vertex colors

- Optional skin weights

- Custom attributes

- Holes only if intentionally supported

Required adjacency queries:

```ts
getVertexEdges(vertexId);

getVertexFaces(vertexId);

getEdgeFaces(edgeId);

getFaceEdges(faceId);

getFaceVertices(faceId);

getFaceCorners(faceId);

getAdjacentFaces(faceId);

findBoundaryEdges();

findConnectedComponents();

findEdgeLoops();

findEdgeRings();
```

Maintain explicit invariants:

- Every edge references valid vertices.

- Every face references a valid ordered boundary.

- No face contains repeated consecutive vertices.

- No zero-length edge is silently created.

- Deleted IDs cannot remain in selection.

- Manifold status is discoverable.

- Boundary edges are identifiable.

- Face winding is consistent.

- Degenerate faces are reported.

- Non-manifold edges are reported.

- Duplicate faces are reported.

- Isolated vertices can be found and removed.

- Geometry calculations do not emit `NaN` or infinity.

Provide a structured validation result:

```ts
interface MeshValidationResult {
  valid: boolean;

  errors: MeshIssue[];

  warnings: MeshIssue[];

  statistics: MeshStatistics;
}
```

Do not automatically “repair” destructive topology errors without returning a detailed repair report.

## Render geometry generation

Create a derived-geometry pipeline that converts canonical meshes into `THREE.BufferGeometry`.

It must:

- Triangulate polygon faces for rendering.

- Preserve original face IDs.

- Preserve original vertex and edge mappings.

- Generate normals.

- Support flat and smooth shading.

- Generate tangents when UVs permit.

- Split render vertices where normals, UVs, colors, materials, or seams require it.

- Produce groups for material slots.

- Produce efficient picking attributes or lookup tables.

- Rebuild only dirty portions where practical.

- Dispose replaced GPU resources.

- Never overwrite canonical topology with triangulated render topology.

Maintain mapping tables such as:

```ts
interface RenderMapping {
  triangleToFace: FaceId[];

  renderVertexToVertex: VertexId[];

  renderSegmentToEdge?: EdgeId[];
}
```

This mapping is essential for reliable face, vertex, and edge selection.

## Commands, transactions, and undo/redo

Every persistent modification must use the command system.

Define:

```ts
interface Command<TResult = void> {
  readonly id: string;

  readonly label: string;

  execute(context: CommandContext): TResult;

  undo(context: CommandContext): void;

  redo?(context: CommandContext): TResult;

  mergeWith?(next: Command): Command | null;

  serialize?(): SerializedCommand;
}
```

Support:

- Execute

- Undo

- Redo

- Transactions

- Nested transactions where safe

- Command merging

- Drag coalescing

- Cancel and rollback

- History size limits

- Dirty/save point tracking

- Human-readable history labels

- Optional command serialization

- Before and after events

A transform drag should behave as:

1\. Capture initial state.

2\. Preview continuously without committing history.

3\. Commit one command on pointer release.

4\. Restore initial state on cancellation.

5\. Produce no command if no meaningful change occurred.

Topology commands should preserve enough information for exact reversal. Do not rely on floating-point reconstruction to undo mesh operations.

## Event system

Provide typed events:

```ts
type EditorEvents = {
  "document:changed": DocumentChangeSet;

  "selection:changed": SelectionChange;

  "history:changed": HistoryState;

  "tool:changed": ToolChange;

  "mesh:changed": MeshChangeSet;

  "animation:time-changed": AnimationTimeChange;
};
```

Requirements:

- Subscription returns an unsubscribe function.

- Event dispatch must not depend on the DOM.

- Batch events inside transactions.

- Avoid emitting full document snapshots.

- Include affected IDs and change types.

- Prevent subscriber failures from corrupting editor state.

## Selection system

Support selection domains:

- Object

- Vertex

- Edge

- Face

- UV vertex

- UV edge

- UV face

- Bone

- Keyframe

Support:

- Replace selection

- Add

- Remove

- Toggle

- Select all

- Select none

- Invert

- Grow

- Shrink

- Linked selection

- Loop selection

- Ring selection

- Material-based selection

- Coplanar selection

- Similar selection

- Box selection

- Lasso selection

- Paint selection

Selection must use stable IDs, not array offsets.

Provide an active selection item separately from the selected set.

Changing topology must return an ID remapping or selection transfer result so selection can remain meaningful after operations such as extrusion, beveling, subdivision, and merging.

## Picking

Implement a Three.js picking adapter supporting:

- Object raycasting

- Face picking

- Vertex picking

- Edge picking

- Bone picking

- Hover picking

- Rectangle selection

- Lasso selection

- Front-face-only selection

- Through/X-ray selection

- Depth-aware priority

- Configurable pixel hit radii

Picking must account for:

- Device pixel ratio

- Perspective and orthographic cameras

- Zoom level

- Hidden and locked elements

- Backface rules

- Mirrored transforms

- Small geometry

- Overlapping vertices

- Overlapping edges

- Multiple viewports

Use acceleration structures only through an optional adapter. Do not force a specific BVH package into the core.

## Transform system

Implement translate, rotate, and scale over:

- Objects

- Vertices

- Edges

- Faces

- Bones

- UV elements

- Keyframes where applicable

Support transform spaces:

- World

- Local

- Parent

- View

- Normal

- Custom orientation

Support pivot modes:

- Bounding-box center

- Median point

- Active element

- 3D cursor

- Individual origins

- Custom pivot

Transform sessions must expose:

```ts
beginTransform(request);

updateTransform(delta);

commitTransform();

cancelTransform();
```

Correctly handle:

- Parent transforms

- Negative scale

- Mirrored objects

- Non-uniform scale

- Multiple selected objects

- Selected sub-elements

- Normal-based face movement

- Numeric input

- Axis constraints

- Plane constraints

- Precision modifiers

- Snapping

- Duplicate-and-transform

Three.js `TransformControls` may be used only as an input and visual adapter. It must not become the modeling architecture.

## Snapping

Build snapping as an independent service.

Support:

- Grid snapping

- Increment snapping

- Vertex snapping

- Edge snapping

- Edge midpoint snapping

- Face snapping

- Surface snapping

- Angle snapping

- UV pixel snapping

- Timeline snapping

- Bounding-box snapping

A snap query should return:

```ts
interface SnapResult {
  matched: boolean;

  targetType?: SnapTargetType;

  targetId?: string;

  worldPosition?: Vec3;

  normal?: Vec3;

  distance?: number;

  score?: number;

  guides?: SnapGuide[];
}
```

Use screen-space and world-space thresholds appropriately. Provide deterministic priority rules and hysteresis to prevent flickering between targets.

## Modeling operations

Implement operations as independently tested topology algorithms.

Required foundational operations:

- Add vertex

- Add edge

- Add face

- Delete vertices

- Delete edges

- Delete faces

- Dissolve vertices

- Dissolve edges

- Dissolve faces

- Merge vertices by center

- Merge vertices by first/last

- Merge by distance

- Split edge

- Split face

- Connect vertices

- Triangulate

- Convert triangles to quads where valid

- Reverse face winding

- Recalculate normals

- Separate selection

- Join meshes

- Duplicate selection

- Fill boundary

- Remove doubles

- Remove loose geometry

Required advanced operations:

- Extrude vertices

- Extrude edges

- Extrude faces

- Extrude region

- Inset faces

- Bevel vertices

- Bevel edges

- Loop cut

- Knife cut

- Subdivide edges

- Subdivide faces

- Catmull-Clark subdivision where appropriate

- Bridge edge loops

- Grid fill

- Solidify

- Mirror

- Symmetrize

- Flip

- Bend

- Twist

- Taper

- Spherize

- Flatten

- Align

- Relax

- Limited dissolve

- Boolean union, difference, and intersection through an optional adapter

Each operation must define:

- Accepted topology

- Rejected topology

- Parameters

- Deterministic output

- Attribute propagation

- UV propagation

- Material propagation

- Skin-weight propagation

- Stable-ID mapping

- Selection result

- Undo data

- Validation behavior

- Tests for boundary and non-manifold conditions

Do not mark an operation complete because it works on a cube. Test irregular meshes, triangles, quads, N-gons, open boundaries, transformed objects, and malformed input.

## Primitive system

Provide a common primitive builder API:

```ts
interface PrimitiveDefinition<TParams> {
  id: string;

  defaultParams: TParams;

  validate(params: TParams): ValidationResult;

  build(params: TParams): MeshData;
}
```

Implement:

- Cube or box

- Plane

- Grid

- Circle

- Disc

- Cylinder

- Cone

- Pyramid

- UV sphere

- Icosphere

- Capsule

- Torus

- Wedge or ramp

- Stairs

- Arch

- Wall

- Column

Primitive results must have:

- Correct outward winding

- Predictable pivots

- Useful UVs

- Consistent dimensions

- Valid normals

- Optional caps

- Configurable segments

- No accidental duplicate vertices

- No missing faces

- No internal faces unless requested

Support both immediate creation and interactive creation:

```ts
beginPrimitive();

updateFootprint();

updateHeight();

commitPrimitive();

cancelPrimitive();
```

This allows future CAD-like applications to use point, footprint, and height placement without rewriting the primitive kernel.

## Tool framework

Tools must be separate from UI buttons.

Define a stateful tool interface:

```ts
interface EditorTool<TState = unknown> {
  id: ToolId;

  label: string;

  activate(context: ToolContext): void;

  deactivate(context: ToolContext): void;

  pointerDown?(event: ToolPointerEvent): void;

  pointerMove?(event: ToolPointerEvent): void;

  pointerUp?(event: ToolPointerEvent): void;

  keyDown?(event: ToolKeyEvent): void;

  cancel?(): void;

  getOverlayData?(): ToolOverlayData;
}
```

Implement foundational tools:

- Select

- Box select

- Lasso select

- Move

- Rotate

- Scale

- Universal transform

- Extrude

- Inset

- Bevel

- Loop cut

- Knife

- Measure

- Primitive placement

- 3D cursor

- Bone creation

- Weight painting

- Texture painting

Tool logic must accept normalized input events from any host application. Do not bind directly to specific mouse buttons inside the core.

Allow each application to map:

- Mouse buttons

- Stylus buttons

- Touch gestures

- Keyboard shortcuts

- Radial menu actions

- Context menus

## Materials and textures

Define framework-independent material data supporting:

- Base color

- Opacity

- Alpha modes

- Double-sided rendering

- Flat or smooth shading

- Base-color texture

- Normal texture

- Metallic-roughness texture

- Emissive texture

- Occlusion texture

- Nearest and linear filtering

- Wrap modes

- Pixel-art settings

- Custom shader metadata

Texture assets need:

- Stable IDs

- URI or embedded source

- Width and height

- Color-space metadata

- Sampling settings

- Dirty state

- Optional editable pixel buffer

- Resource lifecycle

Do not store `THREE.Material` or `THREE.Texture` instances in document data.

The Three.js adapter creates and disposes runtime resources.

## UV system

UV data must be stored per face corner, not only per canonical vertex, because one spatial vertex can have different UV positions on different faces.

Support:

- UV vertex, edge, face, and island selection

- Planar projection

- Box projection

- Cylindrical projection

- Spherical projection

- Smart projection

- Reset UV

- Fit to texture

- Normalize

- Pack islands

- Rotate

- Scale

- Translate

- Flip

- Mirror

- Weld

- Split

- Mark and clear seams

- Island detection

- Texel-density calculation

- Pixel-grid snapping

- Out-of-bounds UVs where the format allows them

The UV API must work without a rendered UV editor.

Expose data that Vue, React, Canvas2D, SVG, or WebGL interfaces can render.

## Painting system

Build painting as an optional package.

Support:

- Pencil

- Eraser

- Fill

- Color picker

- Line

- Rectangle

- Ellipse

- Gradient

- Selection mask

- Brush hardness

- Opacity

- Spacing

- Symmetry

- Texture layers if enabled

- Undoable strokes

- UV-aware painting

- Optional direct painting through a 3D viewport

Separate stroke sampling from pixel application.

A stroke should create one undo entry, not one entry per sampled point.

Avoid coupling painting to one canvas library.

## Rigging

Implement a reusable skeleton model:

```ts
interface BoneData {
  id: BoneId;

  name: string;

  parentId: BoneId | null;

  restTransform: Transform;

  visible: boolean;

  locked: boolean;

  metadata: Record<string, unknown>;
}
```

Support:

- Bone creation

- Bone deletion

- Reparenting

- Bone chains

- Rest pose

- Pose transforms

- Multiple root bones where allowed

- Bone display settings

- Automatic weight assignment

- Manual weight editing

- Normalize weights

- Limit influences

- Mirror weights

- Copy weights

- Weight validation

Mesh deformation must use standard skinning concepts. Do not make bones depend on parenting directly to selected faces or vertices as the primary rigging system.

Allow rigid assignment as a simplified workflow by assigning vertices completely to one bone.

Store up to a configurable number of influences per vertex and provide a default compatible with common real-time formats.

## Animation

Support multiple animation clips per document.

Each clip should contain typed tracks targeting stable IDs and properties.

```ts
interface AnimationClipData {
  id: AnimationId;

  name: string;

  duration: number;

  loopMode: "once" | "repeat" | "ping-pong" | "hold";

  tracks: AnimationTrackData[];

  markers: TimelineMarker[];

  metadata: Record<string, unknown>;
}
```

Support tracks for:

- Bone position

- Bone rotation

- Bone scale

- Object position

- Object rotation

- Object scale

- Visibility

- Morph weights if later supported

- Custom numeric properties

Support:

- Keyframes

- Multiple keyframes at the same time where meaningful

- Constant interpolation

- Linear interpolation

- Cubic interpolation

- Quaternion rotation interpolation

- Copy/paste

- Duplicate

- Move

- Scale time

- Reverse

- Loop ranges

- Timeline markers

- Onion or ghost pose data hooks

- Playback

- Scrubbing

- Auto-key

- Pose reset

- Rest-pose comparison

- Animation events

- Clip duplication

- Clip rename

- Clip deletion

Keep animation evaluation independent of Three.js. The Three.js adapter may convert clips to `THREE.AnimationClip`, but it must not be the only evaluator.

## Formats

Create a format registry:

```ts
interface ModelFormat {
  id: string;

  extensions: string[];

  import(data: FormatInput, options?: unknown): Promise<ImportResult>;

  export(document: ModelDocument, options?: unknown): Promise<ExportResult>;
}
```

Initial formats:

- Native versioned JSON format

- glTF/GLB

- OBJ

- STL

- PLY if feasible

Later adapters may support application-specific game formats.

Every importer must return warnings instead of silently discarding unsupported data.

Every exporter must describe:

- Unsupported features

- Converted features

- Lost features

- Coordinate-system conversion

- Unit conversion

- Material conversion

- Animation conversion

The native format must preserve all canonical information and unknown extension metadata.

## Three.js adapter

Build a dedicated runtime adapter responsible for:

- Creating a Three.js scene representation

- Mapping document nodes to `THREE.Object3D`

- Mapping meshes to `THREE.BufferGeometry`

- Mapping materials and textures

- Synchronizing incremental changes

- Picking

- Transform-control integration

- Skeleton and skinning runtime objects

- Animation preview

- Helpers and overlays

- GPU resource disposal

Expose an API similar to:

```ts
const adapter = new ThreeViewportAdapter({
  session,

  scene,

  camera,

  renderer,
});

adapter.mount();

adapter.sync();

adapter.resize(width, height, pixelRatio);

adapter.dispose();
```

The adapter must not own the canonical document.

Do not require the adapter to create the renderer, camera, DOM element, application shell, Dockview layout, or event bindings.

Support multiple adapters viewing the same session so applications can provide top, front, right, and perspective viewports.

## Rendering overlays

Provide reusable overlay renderers or overlay data for:

- Selected object outlines

- Selected vertices

- Selected edges

- Selected faces

- Hover highlights

- Bone shapes

- Grid

- 3D cursor

- Pivot

- Snapping markers

- Measurement labels

- Knife preview

- Loop-cut preview

- Primitive preview

- Transform guides

Separate overlay state from model data.

Make overlay sizes readable in screen space. Vertex markers and edge hit areas must not become unusably small when the camera zooms out.

## Extension system

Applications must be able to add behavior without modifying SDK internals.

Support registering:

- Commands

- Tools

- Primitive types

- Node types

- Material models

- Importers

- Exporters

- Validators

- Panels through host-defined metadata only

- Custom document data

- Custom animation tracks

Define explicit extension points. Do not expose arbitrary internal mutation.

Extensions must be disposable and removable.

## Performance

Set performance targets and measure them.

Initial targets:

- Smooth navigation with 100,000 visible triangles on ordinary hardware.

- Interactive sub-element selection without full scene reconstruction.

- Transform preview without serializing the document every frame.

- Undo/redo without cloning the entire document for every simple edit.

- Incremental updates when one object changes.

- Worker execution for expensive geometry, UV packing, and file processing.

- No unbounded event listeners.

- No leaked Three.js geometries, materials, textures, or render targets.

Add development diagnostics:

- Dirty entity counts

- Geometry rebuild counts

- Command timings

- Picking timings

- Worker timings

- GPU resource counts where possible

Do not prematurely optimize at the expense of correctness. Establish benchmarks early and optimize measured bottlenecks.

## Testing strategy

Use several test layers.

### Unit tests

Test:

- Vector and matrix utilities

- IDs

- Entity stores

- Scene hierarchy

- Mesh adjacency

- Mesh validation

- Every topology operation

- UV operations

- Commands

- Undo and redo

- Snapping

- Animation interpolation

- Serialization and migrations

### Property-based tests

Use generated meshes where practical to verify invariants such as:

- Undo followed by redo returns the same state.

- Serialization round trips preserve the document.

- Operations do not create dangling references.

- Face boundaries only reference existing vertices and edges.

- Selection contains only valid IDs.

- Valid input stays valid after supported operations.

### Integration tests

Test complete workflows:

1\. Create primitive.

2\. Select faces.

3\. Extrude.

4\. Bevel.

5\. Assign material.

6\. Unwrap UVs.

7\. Create skeleton.

8\. Assign weights.

9\. Animate bones.

10\. Save.

11\. Reload.

12\. Export glTF.

13\. Import the exported file.

14\. Validate the result.

### Visual regression tests

Render deterministic scenes and compare screenshots for:

- Face winding

- Normals

- Flat shading

- Smooth shading

- Material groups

- UV textures

- Mirrored geometry

- Skinning

- Animation poses

- Selection overlays

### Required regression fixtures

Include:

- Single triangle

- Quad

- Concave polygon

- Cube

- Open cube

- Cylinder

- Sphere

- Mirrored mesh

- Negative-scale object

- Non-manifold edge

- Duplicate vertices

- Degenerate face

- Multiple disconnected components

- UV seams

- Two-bone skinned mesh

- Multiple animation clips

## Documentation

Generate complete documentation for SDK consumers.

Required guides:

```text

docs/guides/getting-started.md

docs/guides/vue-integration.md

docs/guides/react-integration.md

docs/guides/multiple-viewports.md

docs/guides/custom-tool.md

docs/guides/custom-primitive.md

docs/guides/custom-format.md

docs/guides/undoable-command.md

docs/guides/mesh-operations.md

docs/guides/rigging-and-animation.md

docs/guides/performance.md

docs/guides/licensing-and-provenance.md

```

Every public class, interface, function, and event must have TSDoc.

Examples must compile as part of CI.

## Example applications

Create three examples.

### Framework-neutral playground

Demonstrate:

- Scene creation

- Primitive creation

- Object selection

- Vertex, edge, and face selection

- Move, rotate, and scale

- Extrusion

- Undo and redo

- Save and load

### Vue example

Demonstrate how PolyEcho or ViperCAD could consume the SDK without placing Vue inside the SDK.

Include:

- One Three.js viewport

- Outliner

- Properties panel

- Tool buttons

- Undo and redo

- Selection state

- A minimal timeline

### React example

Demonstrate the same library working independently of Vue.

These examples are integration demonstrations, not the main product.

## Build and publishing requirements

Produce:

- ESM builds

- Type declarations

- Source maps

- Tree-shakeable modules

- Explicit package exports

- Peer dependency declarations

- No accidental Node-only imports in browser packages

- No accidental DOM dependencies in headless packages

- Semantic versioning

- Changesets

- API extraction or compatibility checks

- Automated tests in CI

- Licence files

- Third-party notices

- Provenance documentation

Do not publish during development unless explicitly authorized.

## Development process

Do not attempt to implement the entire SDK in one uncontrolled pass.

Work through these phases.

### Phase 0: Repository investigation

Inspect Blockbench and write the capability map.

Also inspect our current repository if it exists.

Identify:

- Reusable concepts

- Blockbench-specific concepts

- UI-coupled systems

- Global state

- Format-specific code

- Three.js coupling

- Geometry editing responsibilities

- Undo architecture

- Selection architecture

- Animation architecture

- Import/export boundaries

Do not modify production code during this phase.

Deliver:

- Capability map

- Licence/provenance report

- Proposed architecture

- Risk register

- Implementation roadmap

### Phase 1: Foundation

Implement:

- Monorepo

- Strict TypeScript configuration

- IDs

- Math types

- Entity stores

- Document schema

- Scene graph

- Events

- Serialization

- Validation infrastructure

Acceptance criteria:

- Headless tests run in Node.

- A document can be created, serialized, loaded, and validated.

- Scene nodes can be added, removed, and reparented.

- Hierarchy cycles are rejected.

- No Three.js dependency exists in the document package.

### Phase 2: Mesh kernel

Implement:

- Topology representation

- Adjacency

- Mesh builder

- Validation

- Triangulation boundary

- Attribute storage

- ID mapping

Acceptance criteria:

- Triangle, quad, concave face, cube, and open mesh fixtures pass.

- No dangling topology appears after basic changes.

- Render triangulation preserves source face IDs.

- Meshes serialize deterministically.

### Phase 3: Commands and selection

Implement:

- Commands

- Transactions

- Undo/redo

- Selection domains

- Selection transfer

- Basic mesh commands

Acceptance criteria:

- Every edit can be undone and redone exactly.

- Selection survives supported topology operations.

- One drag creates one history entry.

- Cancellation restores the initial state.

### Phase 4: Three.js adapter

Implement:

- Scene synchronization

- BufferGeometry generation

- Materials

- Cameras supplied by host

- Multiple viewport support

- Picking

- Overlays

- Disposal

Acceptance criteria:

- One document can appear in four viewports.

- Editing the document updates all viewports.

- Clicking rendered triangles resolves to canonical face IDs.

- GPU resources are released on replacement and disposal.

### Phase 5: Modeling tools

Implement foundational modeling operations first:

- Create

- Delete

- Move

- Extrude

- Inset

- Bevel

- Loop cut

- Knife

- Merge

- Dissolve

- Subdivide

- Bridge

Each operation requires tests before proceeding to the next.

### Phase 6: UV and materials

Implement:

- Materials

- Texture assets

- UV representation

- Projections

- Seams

- Islands

- UV transforms

- Initial packing

- Three.js material synchronization

### Phase 7: Rigging and animation

Implement:

- Skeleton

- Weights

- Pose evaluation

- Multiple clips

- Keyframes

- Interpolation

- Playback

- Three.js preview conversion

- glTF animation export

### Phase 8: Painting and formats

Implement:

- Texture editing

- Undoable painting

- Native format

- glTF/GLB

- OBJ

- STL

- Format registry

### Phase 9: Hardening

Complete:

- Performance benchmarks

- Worker boundaries

- Memory-leak tests

- Visual regression testing

- API documentation

- Vue example

- React example

- Migration examples

- Release candidate

## First usable milestone

Do not wait until every advanced feature is finished before producing something testable.

The first vertical milestone must allow this exact code:

```ts
import * as THREE from "three";

import {
  createModelingSession,
  CreatePrimitiveCommand,
  ExtrudeFacesCommand,
  ThreeViewportAdapter,
} from "@modeling-kit/sdk";

const session = createModelingSession();

const cube = session.execute(
  new CreatePrimitiveCommand("cube", {
    width: 2,

    height: 2,

    depth: 2,
  }),
);

session.selection.replace({
  domain: "face",

  objectId: cube.objectId,

  elementIds: [cube.faceIds.top],
});

session.execute(
  new ExtrudeFacesCommand({
    distance: 1,
  }),
);

const adapter = new ThreeViewportAdapter({
  session,

  scene: new THREE.Scene(),

  camera,

  renderer,
});

adapter.mount();
```

This milestone must support:

- Create a cube

- Display it

- Select one face

- Extrude that face

- Undo

- Redo

- Save as native JSON

- Reload

- Preserve IDs and topology

- Dispose the viewport adapter cleanly

## Cursor operating instructions

Use Agent mode and work directly in the repository.

Before every phase:

1\. Inspect the current repository.

2\. Read the architecture documents.

3\. List affected packages.

4\. State assumptions.

5\. Define acceptance tests.

6\. Implement the smallest complete vertical slice.

7\. Run type checking.

8\. Run tests.

9\. Run linting.

10\. Update documentation and roadmap.

11\. Report remaining failures truthfully.

Do not:

- Generate hundreds of disconnected placeholder files.

- Mark TODO stubs as completed features.

- use `any` to avoid designing correct types.

- Suppress TypeScript errors without documenting the reason.

- Store all systems in one giant class.

- Make Vue or React the state owner.

- Mutate Three.js geometry as canonical state.

- Rebuild every scene object after every small edit.

- Use array indices as persistent IDs.

- Implement an operation only for cubes.

- Claim compatibility without tests.

- silently discard unsupported imported data.

- bundle Blockbench branding or assets.

- copy GPL code into a differently licensed library.

- overwrite unrelated existing work.

- delete files merely because they appear unused.

- publish packages without permission.

When a decision is unclear, prefer:

- Explicit data

- Stable IDs

- Pure algorithms

- Small packages

- Dependency inversion

- Deterministic results

- Structured errors

- Exact undo

- Incremental synchronization

- Host-controlled UI

- Tests before broad feature claims

## Required first response

Do not begin mass implementation immediately.

Your first response must provide:

1\. A concise assessment of whether the current repository is suitable.

2\. A Blockbench capability map grouped by subsystem.

3\. A licence and clean-room risk report.

4\. The proposed package dependency graph.

5\. The canonical document and mesh architecture.

6\. A list of existing code that can be retained, adapted, or replaced.

7\. A phased roadmap.

8\. Clear acceptance criteria for Phase 1.

9\. The exact files you propose to create or modify.

10\. Any questions that genuinely block implementation.

Then create only the Phase 0 research and architecture documents.

Wait for approval before starting Phase 1.
