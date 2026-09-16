# Skinning

Linear-blend skinning is evaluated in `@modeling-kit/rigging` without Three.js. The viewport adapter may use `THREE.SkinnedMesh` for GPU preview; CPU `applyCpuSkin` remains available for tests.

## Canonical binding

```ts
interface MeshSkinBinding {
  skeletonId: SkeletonId;
  maxInfluences: number; // default 4
  vertices: readonly { vertexId: VertexId; influences: readonly { boneId: BoneId; weight: number }[] }[];
  inverseBindMatrices?: readonly { boneId: BoneId; matrix: readonly number[] }[];
}
```

Joint array indices from glTF are **not** canonical IDs. Import maps them to new `BoneId` values.

## Evaluation

`skinPositions(mesh, skeleton, skin, localPose?)`:

1. Resolve world pose from rest + optional local pose.
2. Resolve IBM per bone (`resolveInverseBindMatrix`).
3. Skinning matrix = `jointWorld * inverseBind`.
4. Blend vertex positions by normalized weights.

Missing bones contribute nothing; a vertex with no valid influences stays at rest.

## Adapter boundary

`createThreeSkinnedMesh` copies indices/weights onto `skinIndex` / `skinWeight` and binds a `THREE.Skeleton`. The adapter never writes bone matrices back into `ModelDocument`. Dispose via `disposeThreeSkeleton` so rebuilds do not leak GPU or graph references.
