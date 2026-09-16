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
| `import_mesh` | OBJ text → new object + conversion report |
| `export_mesh` | OBJ or ASCII STL + conversion report |
| `begin_transaction` / `commit_transaction` / `rollback_transaction` | Multi-tool undo group |
| `issue_request_id` | Mint an idempotency key |

Unknown tool names and invalid arguments return `{ ok: false, error, code, retryable, inspection }` without throwing. `code` is `invalid_json`, `invalid_argument`, `invalid_state`, or `operation_failed`. Schema mismatches set `retryable: true`, a `field` path when possible, and the full validator `issues` array. Malformed JSON sets `code: "invalid_json"` and `retryable: false`. Pass `clientRequestId` (from `issue_request_id` or the host) to retry a tool without applying it twice.

`select_components` unions every requested face tag. `merge_vertices` `custom` / `cursor` require `position` / `cursorPosition`. See [Fluent editor](fluent-editor.md) for the underlying operators.
