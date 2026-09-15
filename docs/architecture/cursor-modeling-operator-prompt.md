# Cursor AI Instructions: Implementing the Modeling Operator System

## Objective
Implement the complete headless modeling operator system according to [modeling-operator-specification.md](file:///c:/Users/Snow/Documents/Projects/The%20Block%20SDK/docs/architecture/modeling-operator-specification.md).

---

## Step 1: Verification of Existing Implementations
Before writing new code, inspect the codebase to see what already exists and ensure architectural boundaries are strictly respected:

1. Check `packages/mesh/src/operations/` and `packages/tools/src/`:
   - Identify existing operations (e.g. `extrude.ts`, `inset.ts`, `bevel.ts`, `loop-cut.ts`, `weld.ts`, `dissolve.ts`).
   - Check if pure topology operations are wrongly located in `@modeling-kit/tools`. Pure geometry algorithms must live in `@modeling-kit/mesh/src/operations/`.
   - Check if operations adhere to the unified `MeshOperationResult` contract and report `TopologyMapping` (preserved, deleted, created, replaced, derived).

2. If an operation is located in `@modeling-kit/tools` without interaction logic:
   - Move the pure topology algorithm into `packages/mesh/src/operations/`.
   - Provide backwards-compatible re-exports from `@modeling-kit/tools` to avoid breaking existing callers.

---

## Step 2: Implement Common Operator Contract
In `packages/mesh/src/operations/contract.ts`, define:
- `MeshOperationContext`
- `MeshOperationResult`
- `MeshChangeSet`
- `TopologyMapping` & `ElementMapping<TId>`
- `SelectionSuggestion`
- `MeshOperationWarning`
- `AttributePropagationPolicy`

In `packages/mesh/src/internal/topology-mapping-builder.ts`:
- Create a reusable `TopologyMappingBuilder` to accurately track preserved, deleted, created, replacedBy, and derivedFrom IDs during topological modifications.

---

## Step 3: Implement & Strengthen Operations Sequentially
Implement each operator completely one by one. **Do not stub.** A feature is complete only when its topology, attribute propagation, ID mapping, snapshot undo, and Vitest unit tests pass.

### Sequence:
1. `splitEdge` in `packages/mesh/src/operations/split-edge.ts`
   - Interpolate position at `t \in (0, 1)`.
   - Separate per-corner UV interpolation on each incident face.
   - Interpolate vertex colors, normalize skin weights, preserve seam/sharp/crease.
   - Return `SplitEdgeResult` with `TopologyMapping`.
2. `cutFace` in `packages/mesh/src/operations/cut-face.ts`
   - Support vertex-to-vertex, vertex-to-edge, edge-to-vertex, edge-to-edge.
   - Split edges internally via `splitEdge`.
   - Verify cut diagonal lies within the face.
   - Deterministic FaceId preservation (lowest original corner ID retains original FaceId).
   - Return `CutFaceResult` with `TopologyMapping`.
3. `connectVertices` in `packages/mesh/src/operations/connect-vertices.ts`
4. `mergeVertices` & `mergeVerticesByDistance` in `packages/mesh/src/operations/merge-vertices.ts`
   - Handle position policies (`center`, `active`, `first`, `last`, `cursor`, `custom`).
   - Remove degenerate faces (< 3 vertices) and resolve duplicate edges.
5. `dissolveEdge` in `packages/mesh/src/operations/dissolve-edge.ts`
   - Merge adjacent faces into a single n-gon, validating non-degeneracy and attribute consistency.
6. `triangulateFaces` in `packages/mesh/src/operations/triangulate-faces.ts`
7. `findBoundaryLoops` & `extrudeRegion` in `packages/mesh/src/operations/extrude-region.ts`
8. `findQuadLoop` & `loopCut` in `packages/mesh/src/operations/loop-cut.ts`
9. `KnifePlanner` & `KnifeExecutor` in `packages/mesh/src/operations/knife/`
10. Single-segment & multi-segment `bevelEdges` in `packages/mesh/src/operations/bevel-edges.ts`
11. `bridgeLoops` in `packages/mesh/src/operations/bridge-loops.ts`

---

## Step 4: Wire Commands in `@modeling-kit/commands`
Wrap each operator into a corresponding command (`SplitEdgeCommand`, `CutFaceCommand`, `MergeVerticesCommand`, etc.) using snapshot undo/redo:
- Record serialized mesh before mutation.
- Execute operator.
- Record serialized mesh after mutation.
- Verify undo and redo restore exact topological hashes.

---

## Step 5: Verification & Quality Gate
Run the following after every operator implementation:
- `pnpm --filter @modeling-kit/mesh typecheck`
- `pnpm --filter @modeling-kit/mesh test`
- `pnpm run typecheck` (workspace-wide)
- `pnpm test` (workspace-wide)
