# Bevel miter test matrix

| Case | File | Expectation |
| --- | --- | --- |
| Single interior edge | `packages/mesh/tests/bevel-miters.test.ts` | One chamfer; `appliedWidth` matches request |
| Two disconnected edges | same | Two chamfers; one topology pass |
| Open edge chain | same | Two meeting cube edges, sharp miter |
| Closed edge loop | same | Four cube-face edges |
| Convex two-edge corner, sharp | same | Valid closed mesh, no clip warning |
| Convex two-edge corner, clip | same | Valid mesh with clip topology |
| Simple concave corner | same | Valid result or structured `unsupported-complex-concave-miter` rollback |
| Miter limit | same | Sharp `miterLimit: 1.1` rejects; `allowClipFallback` warns and clips |
| Clamp overlap | same | `offset: 50` warns and applies a smaller width |
| Error overlap | same | Rejects before mutation |
| Mixed-length edges | same | Per-edge `appliedWidths` |
| Duplicate selected IDs | same | Deduped; one bevel |
| Missing edge | same | Throw; fingerprint unchanged |
| Boundary edge | same | Reject manifold-interior |
| Three selected edges at a vertex | same | `unsupported-bevel-junction`; no malformed topology |
| Non-manifold edge | same | Reject; fingerprint unchanged |
| UV / crease / material | same | Source attributes survive |
| Undo / redo / serialization | same + `packages/commands/tests/creases-bevel.test.ts` | Snapshot restore |
| Failure rollback | same | Zero width and overlap-error leave the original mesh |
| Strict validation | bevel tests | `validateMesh` after successful bevels |
| Existing segment / chain / UV tests | `packages/mesh/tests/operations.test.ts` | Preserved behavior |
