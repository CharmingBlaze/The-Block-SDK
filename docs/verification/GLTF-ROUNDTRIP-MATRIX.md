# glTF round-trip matrix

Pipeline under test:

```text
SDK document → glTF/GLB export → glTF Transform read → SDK import → semantic compare
```

Byte-identical output is **not** required. Branded IDs are not preserved. Compare names, hierarchy, transforms, counts, and numeric values with tolerance.

Khronos [glTF Validator](https://github.com/KhronosGroup/glTF-Validator) may be run on exported fixtures in CI when the binary is installed. It is not a runtime dependency of `@modeling-kit/formats`.

| Fixture | Covered by | Notes |
| --- | --- | --- |
| Static triangle mesh (cube) | `formats.test.ts` | 8 verts, 12 triangles after import |
| Quad-origin cube exported as triangles | `formats.test.ts` | `metadata-dropped` triangulation loss |
| Hierarchy + translation | `formats.test.ts` | Parent/child names |
| Multiple materials / PBR factors | `formats.test.ts` | metallic, roughness, emissive, alpha, doubleSided |
| Empty mesh skipped | `formats.test.ts` | No non-finite POSITION bounds |
| GLB container | `formats.test.ts`, `gltf-roundtrip.test.ts` | Magic/version + skins |
| Base color texture + sampler | `gltf-roundtrip.test.ts` | Encoded PNG bytes, mag/wrap |
| External `.bin` | `gltf-roundtrip.test.ts` | `MemoryResourceResolver` |
| Skeleton + multi-bone skin + IBM | `gltf-roundtrip.test.ts` | Joint names, IBM count |
| Single-bone GLB skin | `gltf-roundtrip.test.ts` | Weights present after import |
| Bone translation + rotation tracks | `gltf-roundtrip.test.ts` | LINEAR + STEP |
| POINTS primitive | `gltf-roundtrip.test.ts` | `unsupported-primitive-mode` |
| Omitted IBM | `gltf-roundtrip.test.ts` | Identity default repair |
| CUBICSPLINE strict / repair | `gltf-roundtrip.test.ts` | Never silent LINEAR |
| Cyclic scene export | `formats.test.ts` | Terminates |

Not yet in automated fixtures (still required before claiming lossless full glTF): negative scale, UV1, vertex colors, occlusion/emissive/normal textures as separate files, multiple scenes with non-default roots, morph targets, punctual light parameters, Khronos validator gate in CI.
