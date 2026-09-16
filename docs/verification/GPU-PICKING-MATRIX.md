# GPU picking verification matrix

**Spec:** [`docs/architecture/GPU-ID-PICKING.md`](../architecture/GPU-ID-PICKING.md), [`docs/architecture/PICKING-COORDINATOR.md`](../architecture/PICKING-COORDINATOR.md)  
**WebGL evidence:** [`WEBGL-SMOKE.md`](./WEBGL-SMOKE.md)

| Area | Case | Tests | Status |
| --- | --- | --- | --- |
| Result typing | Identity has no position; surface requires finite XYZ; tools reject identity when XYZ is required | `pick-result.test.ts`, `hybrid-pick.test.ts` | covered |
| Session | Pointer-down/up share one result; no CPU/GPU mix; consume/reject/drag/cancel; scene cancel; camera rerun; pointer ids | `pick-session.test.ts`, `viewport-pointer.test.ts` | covered |
| Refinement | Triangle, quad, concave n-gon, transforms, ortho ray, front/back, closest triangle, barycentric, structured failure | `pick-refinement.test.ts` | covered |
| Face identity | Quad/n-gon triangles share `FaceId`; rebuild invalidates; fewer IDs than triangles | `gpu-picking-canonical.test.ts`, `gpu-picking-face.test.ts` | covered |
| Empty click | Replace clears; add/toggle/subtract preserve | `visibility-picking.test.ts` | covered |
| Host config | `gpuPicking`, `xray`, `selectThrough`, `backfaceMode`, `refineSurfacePoint`; `picking: false` attaches no handlers | `gpu-picking-canonical.test.ts`, `viewport-pointer.test.ts` | covered |
| Capacity | ID 0 reserved; max supported; overflow diagnostic; no wrap; CPU fallback | `gpu-pick-encode.test.ts`, `gpu-pick-registry.test.ts`, `hybrid-pick.test.ts` | covered |
| Lifecycle | Resize, invalidate, delete, repeated picks, double dispose | `gpu-picking-lifecycle.test.ts` | covered |
| Object/face GPU | Overlap, hidden/locked, transforms, backface, ortho | `gpu-picking-object.test.ts`, `gpu-picking-face.test.ts` | covered |
| Coordinates | DPR, offset canvas, split viewport | `viewport-pixel.test.ts` | covered |
| Real WebGL | Perspective, ortho, DPR 2, split, offset, empty click, quad FaceId, backface policy | `pnpm test:webgl` / `tests/webgl/gpu-picking.smoke.spec.ts` | required CI job `webgl-smoke` |
| Hover GPU | Throttle / scissor / cache | — | 1.1 deferred |
| Transparency | Alpha-test sampling, transparent depth, clipping planes | — | 1.1 deferred |
| Instancing | `THREE.InstancedMesh` identity | omitted from pass; documented | 1.1 deferred |
| GPU skinning | Shader skinning | CPU-skinned visual buffers only | 1.1 deferred |

Node tests use the software ID-buffer readback (`gpuPicking: "software"`) with the same registry, mapping, camera, and visibility filters as the WebGL pass. That is an explicit unit-test backend, not production evidence. Production without WebGL uses CPU `Raycaster`.

## Recorded 2026-09-16

```text
GPU picking verification: pass
  pnpm exec vitest run packages/selection/tests packages/three-adapter/tests
  → 25 files, 126 tests
  pnpm test:webgl
  → 1 passed (perspective, ortho, DPR 2, split viewport, canonical FaceId, empty click, backface policy)

Repository release gate: fail for independent reasons
  pnpm typecheck → packages/rigging/tests/rigging.test.ts TS2695 (unused comma operator)
  pnpm test → 4 failed in packages/formats/tests/formats.test.ts; 650 passed
  pnpm examples:typecheck → pass after playground identity/surface updates
```

Do not treat the repository as 1.0-verified because picking tests pass.
