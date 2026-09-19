# @modeling-kit/validation

**Mesh validation and healing.** Detects topology and geometry problems — non-manifold edges, zero-area faces, duplicate vertices, inverted normals — and optionally auto-heals them.

## Purpose

The `validation` package provides:

- **MeshValidator** — comprehensive topology and geometry validation with typed issue reports
- **MeshHealer** — automatic repair of common problems: weld duplicate vertices, remove zero-area faces, fix inverted normals, resolve non-manifold edges
- **Issue types** — `NonManifoldEdgeIssue`, `ZeroAreaFaceIssue`, `DuplicateVertexIssue`, `InvertedNormalIssue`, `DanglingVertexIssue`, `IsolatedComponentIssue`
- **Severity levels** — issues tagged as `"error"`, `"warning"`, or `"info"` with human-readable descriptions and element IDs

## Key Exports

```ts
// Validator
import {
  MeshValidator,
  validateMesh,
  type MeshValidationResult,
  type MeshIssue,
} from "@modeling-kit/validation";

// Healer
import {
  MeshHealer,
  healMesh,
  type MeshHealResult,
} from "@modeling-kit/validation";

// Issue types
import type {
  ValidationSeverity,
  NonManifoldEdgeIssue,
  ZeroAreaFaceIssue,
  DuplicateVertexIssue,
  InvertedNormalIssue,
  DanglingVertexIssue,
  IsolatedComponentIssue,
} from "@modeling-kit/validation";
```

## Usage Example

```ts
import { MeshValidator, MeshHealer } from "@modeling-kit/validation";

// Validate a mesh
const result = MeshValidator.validate(mesh);
if (!result.valid) {
  for (const issue of result.issues) {
    console.log(`[${issue.severity}] ${issue.message}`);
    console.log(`  Affected elements:`, issue.elementIds);
  }
}

// Auto-heal
const healResult = MeshHealer.heal(mesh, {
  weldTolerance: 0.0001,
  removeZeroAreaFaces: true,
  fixInvertedNormals: true,
  resolveNonManifold: "split",
});

console.log(`Healed: ${healResult.changes.length} changes applied`);
console.log(`  Welded: ${healResult.verticesWelded} vertices`);
console.log(`  Removed: ${healResult.facesRemoved} faces`);
console.log(`  Fixed: ${healResult.normalsFixed} normals`);
```

## Architecture Notes

- Validation is **read-only** — `MeshValidator.validate()` does not mutate the mesh.
- Healing produces a **new mesh** or a list of **change operations** — the original mesh is not modified unless explicitly replaced.
- Issues include **element IDs** pointing to the specific vertices, edges, or faces that are problematic, enabling the UI to highlight them.
- `weldTolerance` for duplicate vertex detection should be set based on the mesh scale — too large and non-duplicate vertices merge; too small and real duplicates remain.
- The healer's `resolveNonManifold` policy can be `"split"` (duplicate the non-manifold edge's vertices) or `"report"` (only report, don't fix).
- This package is used by `@modeling-kit/commands` (`HealMeshCommand`) and by importers to auto-clean imported geometry.