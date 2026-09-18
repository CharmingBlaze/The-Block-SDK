# AI / agent tools

`@modeling-kit/sdk/ai` exposes OpenAI-style function schemas plus a typed executor. Tools operate on a `FluentEditor`. They never import Three.js.

```ts
import {
  createEditor,
  getEditorToolDefinitions,
  executeEditorTool,
} from "@modeling-kit/sdk/ai";

const editor = createEditor();
const tools = getEditorToolDefinitions();
const result = executeEditorTool(editor, "spawn_primitive", {
  type: "cube",
  width: 2,
  height: 2,
  depth: 2,
});

if (result.ok) {
  console.log(result.inspection.summary);
} else {
  console.error(result.error);
}
editor.dispose();
```

Pass `tools` to the model as function/tool definitions. On each tool call, run `executeEditorTool` and return `inspection` (and `error` on failure) as the tool result. After topology ops, check `inspection.isClosedManifold` before continuing.

`type: "sphere"` is accepted as an alias of `uvSphere`. Cubes are 6-quad polygonal meshes, not voxels.

### The inspect → act loop

The read-only `get_*` / `inspect_*` / `list_*` tools let an agent understand the scene before mutating it. Each returns a structured `data` object (branded IDs, counts, error codes — never render indices):

```ts
const bounds = executeEditorTool(editor, "get_spatial_bounds", {});
const topology = executeEditorTool(editor, "get_mesh_topology_summary", {});
const anomalies = executeEditorTool(editor, "detect_mesh_anomalies", {});

// detect_mesh_anomalies.data has { valid, isManifold, isClosed, errors[], warnings[] }.
if (!anomalies.ok || (anomalies.data as { valid: boolean }).valid === false) {
  executeEditorTool(editor, "heal_mesh", {});
}
// get_faces_by_angle finds coplanar faces (angle: 0) or sharp edges (angle: 90).
executeEditorTool(editor, "get_faces_by_angle", { angle: 90, tolerance: 1 });
```

## Tool catalog

| Name | Effect |
| --- | --- |
| `spawn_primitive` | Create a catalog primitive and select it |
| `select_components` | Object or tagged faces (`top`, `bottom`, `sides`, `front`, `back`, `caps`) |
| `extrude_faces` | Extrude current faces |
| `inset_faces` | Inset current faces (`distance`) |
| `bevel_edges` | Bevel current edges |
| `set_edge_creases` | Normalized Catmull–Clark crease weights |
| `subdivide_faces` | Linear subdivide |
| `catmull_clark` | Catmull–Clark |
| `loop_cut` | Quad loop cut from the selected edge |
| `dissolve_edges` | Dissolve into n-gons |
| `fill_boundary` | Cap a boundary loop |
| `knife_stroke` | Cut along world-space snap points |
| `heal_mesh` | Isolated verts, zero-length edges, duplicate faces |
| `weld_vertices` | Distance weld |
| `triangulate_faces` | Selected or all |
| `merge_vertices` | Merge to a target |
| `connect_vertices` | Diagonal on a shared face |
| `transform_selection` | Translate selection or active object |
| `undo` / `redo` | History |
| `inspect_scene` | Compact structured summary |
| `save_scene` | Native versioned JSON in `data.json` |
| `load_scene` | Replace the session from native JSON (non-undoable) |
| `list_objects` | Search by id, name, type, parent, or bounds |
| `inspect_mesh` | Topology, tags, seams, and creases |
| `query_near` | Snap-query components near a world point |
| `get_spatial_bounds` | AABB min/max/center/size + vertex count |
| `get_mesh_topology_summary` | Counts, tris/quads/ngons, components, seams/creases, Euler χ, manifold |
| `detect_mesh_anomalies` | Structured validation: errors/warnings with codes + element IDs |
| `get_faces_by_angle` | Shared-edge face pairs within a dihedral-angle tolerance |
| `get_contiguous_surfaces` | Connected face/vertex island partition |
| `get_island_centroids` | Per-island centroid + bounds |
| `import_mesh` | OBJ text → new object + conversion report |
| `export_mesh` | OBJ or ASCII STL + conversion report |
| `begin_transaction` / `commit_transaction` / `rollback_transaction` | Multi-tool undo group |
| `issue_request_id` | Mint an idempotency key |

Unknown tool names and invalid arguments return `{ ok: false, error, code, retryable, inspection }` without throwing. `code` is `invalid_json`, `invalid_argument`, `invalid_state`, or `operation_failed`. Schema mismatches set `retryable: true`, a `field` path when possible, and the full validator `issues` array. Malformed JSON sets `code: "invalid_json"` and `retryable: false`. Pass `clientRequestId` (from `issue_request_id` or the host) to retry a tool without applying it twice.

`select_components` unions every requested face tag. `merge_vertices` `custom` / `cursor` require `position` / `cursorPosition`. See [Fluent editor](fluent-editor.md) for the underlying operators.
