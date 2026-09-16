# Fluent editor

`createEditor()` is the recommended API for scripts, tests, and agents. It wraps a `ModelingSession` with chainable spawn, tagged selection, and operators. Raw commands remain valid.

```ts
import { createEditor } from "@modeling-kit/sdk";

const editor = createEditor();
editor.spawn
  .cylinder({ radius: 1.2, height: 0.2, name: "Stool" })
  .select("bottom")
  .extrude(0.1)
  .inset(0.15);

console.log(editor.inspect().summary);
editor.dispose();
```

`createEditor()` owns its session. Call `editor.dispose()` when the host unmounts. `createEditor(existingSession)` does **not** dispose that session.

After each modeling step, `editor.inspect().summary` reports object/face/vertex counts, selection, manifold status, and undo availability. If `inspect().isClosedManifold` is false after an operator you expected to stay solid, undo or `heal()`.

## Spawn

Named helpers cover the common catalog. Everything else goes through `spawn.primitive(type, params)` or `spawn.library(kind, params)`.

| Helper | Notes |
| --- | --- |
| `cube` / `box` | Six quads. `size` or `width` / `height` / `depth`. |
| `plane` | `width` × `depth` (`height` aliases `depth`). |
| `cylinder` | `radius`, `height`, `segments`. |
| `sphere` | Alias of `uvSphere`. `segments` / `rings` map to width/height segments. |
| `uvSphere` / `quadSphere` / `icosphere` | UV, quad, geodesic. |
| `cone` / `pyramid` / `torus` / `capsule` | Torus uses `tube` (`tubeRadius` alias). |
| `quad` / `rectangle` / `roundedRectangle` / `stadium` | 2D-ish catalog meshes on XZ. |
| `ellipse` / `annulus` / `superellipse` / `squircle` / `reuleux` | Profile disks. |
| `roundedCube` / `ellipsoid` / `tetrahedron` / `icosahedron` | Solid catalog. |
| `profile` / `floor` / `wallPath` | [`geometry-extrude`](profile-extrude.md) adapter. Catalog `wall` stays a MeshBuilder primitive. |
| `library` | Recipe IDs from `PRIMITIVE_CATALOG` (not the same as canonical cube/UV sphere). |

`spawn.primitive("grid" | "disc" | "stairs" | "arch" | "wall" | "column" | …)` covers the rest of `PrimitiveType`. Cubes are general 6-face polygonal meshes, not voxels.

## Face tags

`select(tag)` uses primitive face groups stored on mesh metadata.

| Tag | Meaning |
| --- | --- |
| `top` / `bottom` | +Y / −Y on boxes and similar solids |
| `front` / `back` | Semantic groups on the generator |
| `sides` / `caps` | Walls vs end caps (cylinder, capsule, …) |
| `all` | Every face |
| `left` / `right` | On boxes, `left` is −X and `right` is +X |

You can also pass explicit `FaceId[]`, or use `selectEdges` / `selectVertices` / `selectObject`. `editor.select.tagged("bottom")` operates on the active object.

## Operators

Each call executes one command (or a loop of identical commands for linear `subdivide`).

| Method | Command |
| --- | --- |
| `extrude(distance, options?)` | `ExtrudeFacesCommand` |
| `inset(distance, options?)` | `InsetFacesCommand` (`distance`, not inset factor) |
| `bevel(offset, options?)` | `BevelEdgesCommand` |
| `setCrease(weight, edgeIds?)` | `SetEdgeCreasesCommand` |
| `splitEdge(t?)` | `SplitEdgeCommand` (`t` in `(0, 1)`) |
| `cutFace(from, to)` | `CutFaceCommand` |
| `subdivide(iterations?)` | `SubdivideFacesCommand` (linear) |
| `catmullClark(iterations?)` | `CatmullClarkSubdivideCommand` |
| `loopCut(factor?, options?)` | `LoopCutCommand` |
| `dissolve()` | `DissolveEdgesCommand` |
| `fillHole(method?)` | `FillBoundaryCommand` (`ngon` / `fan` / `triangulate`) |
| `knife(points, snapRadius?)` | `KnifeCutCommand` |
| `heal()` | `HealMeshCommand` |
| `weld(epsilon?)` | `WeldVerticesCommand` |
| `triangulate()` | `TriangulateFacesCommand` |
| `mergeVertices(target?)` | `MergeVerticesCommand` |
| `connectVertices()` | `ConnectVerticesCommand` |
| `bridge(loopA, loopB, reverseB?)` | `BridgeLoopsCommand` |
| `move` / `nudge` | `SetTransformsCommand` (object or component) |
| `hide()` | `SetVisibilityCommand` |
| `addMaterialSlot` / `assignMaterialSlot` / `reorderMaterialSlots` | Material slot commands |

Transforms on the editor: `editor.selection.move({ y: 0.5 })`. History: `editor.undo()` / `editor.redo()`, `canUndo` / `canRedo`.

## Materials and UVs

```ts
const mat = editor.createPbrMaterial({ name: "Paint" });
editor.updateMaterial(mat, { baseColor: [0.8, 0.2, 0.1, 1] });
await editor.automaticUnwrap();
```

Automatic unwrap uses xatlas (watlas). It is not LSCM/ABF. See [UV editor](uv-editor.md) and [Materials](materials.md).

## Inspect and persist

```ts
const inspection = editor.inspect();
// inspection.summary, .objects, .selected, .isClosedManifold, .issues
const json = editor.session.saveNativeJson();
```

Reload with `ModelingSession.loadNativeJson(json)`. Native JSON is the document. Exported glTF is delivery, not the editor file.
