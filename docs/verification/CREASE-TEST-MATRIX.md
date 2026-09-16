# Crease test matrix

| Case | File | Expectation |
| --- | --- | --- |
| Cube, zero crease | `packages/mesh/tests/catmull-clark-creases.test.ts` | Standard CC; corners move inward; 8→26 verts |
| Cube, all edges weight `1` | same | Corners stay put (3-crease corner policy) |
| Weights `0.25`, `0.5`, `0.75` | same | Monotonic toward the sharp rule |
| Single creased edge | same | Dart: endpoints stay on the smooth rule |
| Two creases at a vertex | same | Crease vertex blend |
| Three creases at a vertex | same | Corner stays at `P` |
| Four creases at a vertex | same | Grid center stays put |
| Open plane boundaries | same | Boundary vertices use `(6P+N0+N1)/8` |
| Mixed boundary + crease | same | Valid open mesh |
| Non-manifold boundary | same | `non-manifold-boundary-vertex`; no mutation |
| Multiple levels | same | Child edges keep parent weight |
| Crease propagation | same | Weight `0.75` survives two iterations |
| UV seam preservation | same | Child seam edges remain seams |
| Material preservation | same | Source `materialSlot` on child faces |
| Skin-weight normalization | same | Influences sum to 1 |
| Invalid crease values | same | `invalid-crease-weight`; mesh unchanged |
| Serialization | `packages/mesh/tests/kernel-queries.test.ts` | `creaseWeight` round-trips |
| Split-edge inheritance | `packages/mesh/tests/operations.test.ts` | Child edges copy `creaseWeight` |
| Undo / redo | `packages/commands/tests/creases-bevel.test.ts` | Snapshot restore |
| Strict validation | crease tests | `validateMesh` after every successful subdiv |
