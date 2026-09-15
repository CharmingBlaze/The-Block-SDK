# Cursor AI Master Implementation Protocol & Execution Plan

You are partnering with the engineering team to finish all remaining capabilities of **The Block SDK (`@modeling-kit/*`)** to reach a rock-solid, production-grade 1.0 release.

---

## 1. Core Architecture & Ground Rules

1. **Clean-Room Boundary**: Zero code, patterns, or formats from Blockbench or other copyleft repositories (GPL-3.0). Zero Minecraft or game-specific concepts (`.bbmodel`, OptiFine, GeckoLib, MoLang).
2. **Headless Engine**: Packages `@modeling-kit/mesh`, `commands`, `document`, `tools`, `history`, and `validation` must run 100% in Node.js and WebWorkers with **zero** Three.js, DOM, window, or canvas dependencies.
3. **Three.js Isolation**: Three.js integration belongs exclusively in `@modeling-kit/three-adapter` or consumer host apps.
4. **Strict TypeScript**: Zero `any`. Respect `exactOptionalPropertyTypes: true` (never assign `undefined` to optional keys; use conditional spreads `...(val ? { key: val } : {})`).
5. **No Invented APIs**: Follow the exact type names, parameter names, and method signatures specified in `docs/architecture/modeling-operator-specification.md` and `docs/release-1.0-checklist.md`.
6. **Unified Operator Contract**: Every topology operation in `packages/mesh/src/operations/` must implement:
   - Typed Request interface
   - `ctx: MeshOperationContext` (tolerance, idFactory, validation, attributes)
   - Return an `OpResult` extending `MeshOperationResult` with full `TopologyMapping` (preserved, deleted, created, replacedBy, derivedFrom for vertices, edges, faces, and corners)
   - Maintain backward-compatible overloads where existing tests or commands call `(mesh, ...params, ids)`.
7. **Quality Gate on Every Step**: After finishing each work package, run `pnpm run typecheck` and `pnpm test`. Both must pass with 0 errors before updating the checklist.

---

## 2. Master Execution Plan (Work Packages 1 to 4)

Complete the remaining items in sequence. Read the reference files, implement the contracts, add unit tests, update `docs/release-1.0-checklist.md`, and verify the build.

---

### Work Package 1: Complete Remaining Core Mesh Operators
**Target Directory**: `packages/mesh/src/operations/`  
**Test File**: `packages/mesh/tests/operations.test.ts`

#### Task 1.1: `subdivideFaces` on Canonical Contract
- **File**: `packages/mesh/src/operations/subdivide.ts`
- **Canonical API**:
  ```ts
  export interface SubdivideFacesRequest {
    readonly faceIds: readonly FaceId[];
    readonly cuts?: number; // default 1
  }

  export interface SubdivideOpResult extends MeshOperationResult {
    readonly newFaceIds: FaceId[];
  }

  export function subdivideFaces(
    mesh: HalfEdgeMesh,
    request: SubdivideFacesRequest,
    ctx: MeshOperationContext,
  ): SubdivideOpResult;
  ```
- **Requirements**:
  - Linear quad-to-4-quads subdivision splitting boundary edges at midpoints and inserting a center vertex.
  - Shared edge midpoints across adjacent faces (no duplicate vertices).
  - Preserves FaceId on the first child face; records `mapping.replaceFace(oldId, childIds)`.
  - Interpolates corner UVs and colors.
  - Re-export in `packages/mesh/src/operations/index.ts`, `packages/mesh/src/index.ts`, and `packages/tools/src/subdivide.ts`.
  - Add test in `packages/mesh/tests/operations.test.ts` verifying manifold closed cube after subdivide and snapshot undo.

#### Task 1.2: Multi-Segment `bevelEdges` (Stage 2)
- **File**: `packages/mesh/src/operations/bevel-edges.ts`
- **Requirements**:
  - Support `segments?: number` (default 1).
  - When `segments > 1`, generate an arc/profile along the chamfer instead of a single flat facet.
  - Record complete `TopologyMapping` for created profile faces and vertices.
  - Add test verifying multi-segment bevel on a cube edge producing a smooth rounded chamfer.

#### Task 1.3: `bridgeLoops` & `fillBoundary`
- **File**: Move from `packages/tools/src/bridge.ts` to `packages/mesh/src/operations/bridge-loops.ts` and add `fill-boundary.ts`.
- **Requirements**:
  - Bridge two ordered boundary loops with quad strips on the canonical `MeshOperationResult` contract.
  - Implement `fillBoundary(mesh, request: { boundaryEdgeIds: EdgeId[]; method: "ngon" | "fan" | "triangulate" }, ctx)`.
  - Add unit tests verifying manifold closure.

---

### Work Package 2: Headless Knife Planner & Executor
**Target Directory**: `packages/mesh/src/operations/knife/`  
**Test File**: `packages/tools/tests/knife.test.ts`

#### Task 2.1: `KnifePlanner`
- **File**: `packages/mesh/src/operations/knife/knife-planner.ts`
- **Types**:
  ```ts
  export interface KnifePoint {
    readonly faceId: FaceId;
    readonly position: Vec3;
    readonly attachment:
      | { readonly type: "vertex"; readonly vertexId: VertexId }
      | { readonly type: "edge"; readonly edgeId: EdgeId; readonly t: number }
      | { readonly type: "face" };
  }

  export interface PlannedCut {
    readonly faceId: FaceId;
    readonly start: CutEndpoint;
    readonly end: CutEndpoint;
  }

  export interface KnifeCutPlan {
    readonly cuts: readonly PlannedCut[];
    readonly warnings: readonly MeshOperationWarning[];
  }
  ```
- **Requirements**:
  - Takes ordered picked surface points across faces.
  - Traces intermediate face edge intersections between points.
  - Emits a sequence of topologically sorted edge splits and face cuts.

#### Task 2.2: `KnifeExecutor`
- **File**: `packages/mesh/src/operations/knife/knife-executor.ts`
- **Requirements**:
  - Takes `KnifeCutPlan` and applies `splitEdge` and `cutFace` atomically within one transaction.
  - Returns unified `MeshOperationResult` with accumulated `TopologyMapping`.
  - Add command `KnifeCutCommand` in `packages/commands/src/knife.ts` with snapshot undo.
  - Test multi-face contiguous cuts across a closed cube in `packages/tools/tests/knife.test.ts`.

---

### Work Package 3: Topology Validation & Auto-Healing
**Target Directory**: `packages/validation/src/`  
**Test File**: `packages/validation/tests/validation.test.ts`

#### Task 3.1: Non-Manifold Detection
- **File**: `packages/validation/src/mesh-validator.ts`
- **Requirements**:
  - Detect non-manifold edges (edges shared by $> 2$ faces).
  - Detect non-manifold vertices (pinched fans where vertices are shared by disjoint face cycles).
  - Emit `NON_MANIFOLD_EDGE` and `NON_MANIFOLD_VERTEX` error codes.

#### Task 3.2: `healMesh` Operator
- **File**: `packages/validation/src/mesh-healer.ts`
- **Requirements**:
  - Purges isolated vertices with no incident edges.
  - Collapses zero-length edges ($< 10^{-6}$).
  - Resolves duplicate faces.
  - Unifies inconsistent polygon winding.
  - Returns a `MeshCleanupReport` detailing repaired and removed elements.
  - Add tests verifying healing of corrupt test meshes.

---

### Work Package 4: Interactive Viewport Overlays & Packaging Polish
**Target Directory**: `packages/three-adapter/src/`, `packages/sdk/src/`

#### Task 4.1: Viewport Knife Guides & Snap Overlays
- **File**: `packages/three-adapter/src/overlays/knife-overlay.ts`
- **Requirements**:
  - Lightweight Three.js line/point overlay showing current snapped knife cursor and guide segments before confirmation.
  - Wires into `createThreeViewport()`.

#### Task 4.2: SDK Facade & Documentation Sync
- **Files**: `packages/sdk/src/index.ts`, `README.md`, `docs/release-1.0-checklist.md`
- **Requirements**:
  - Ensure all operators, commands, and validators are cleanly re-exported at the top level of `@modeling-kit/sdk`.
  - Verify `pnpm run typecheck`, `pnpm test`, and `pnpm run build` pass across all 23 monorepo packages.
  - Mark all completed checklist items in `docs/release-1.0-checklist.md`.

---

## 3. How to Proceed Now
1. Open `docs/release-1.0-checklist.md` and review the remaining unchecked items.
2. Start with **Work Package 1 (subdivideFaces on canonical contract)**.
3. Verify with `pnpm run typecheck` and `pnpm test`.
4. Proceed sequentially to the next package until all checkboxes are checked.
