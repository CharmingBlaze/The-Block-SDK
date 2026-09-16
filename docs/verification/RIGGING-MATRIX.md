# Rigging verification matrix

| Case | Package | Assertion |
| --- | --- | --- |
| Unique skeleton / bone IDs | rigging | Duplicate bone ids throw |
| Missing parent | rigging | Build throws |
| Parent cycle | rigging | `CyclicHierarchyError` |
| Multiple roots | rigging | Forest of two unparented bones |
| Finite rest transform | rigging | Non-finite / zero scale / zero quat rejected |
| Rest IBM | rigging | `inverseBindMatrix ≈ inverse(jointWorldRest)` |
| Authored identity IBM | rigging | Present IBM map uses identity; missing bone → identity |
| Weight normalize | rigging | Combine, drop ≤0, truncate to 4, sum ≈ 1, report dropped |
| Empty influences | rigging | Throws unless `fallbackBoneId` |
| One-bone rigid skin | rigging | Child rotation moves the vertex |
| Two-bone hierarchy | rigging | Parent-child rest pose |
| Three.js skeleton | three-adapter | Parent links and rest translation match |
| Three.js skinned mesh | three-adapter | `skinIndex` / `skinWeight` present |
| Dispose / recreate | three-adapter | Repeated create/dispose does not throw |
