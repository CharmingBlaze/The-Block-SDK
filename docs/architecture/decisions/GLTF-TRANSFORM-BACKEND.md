# ADR: glTF Transform as the interchange backend

**Status:** Accepted (2026-09-16)

**Context:** The SDK needed full glTF/GLB support (geometry, PBR, textures, samplers, skins, animations, external buffers) without a handwritten parser, without Three.js loaders in the headless core, and without pulling Draco/KTX/sharp into the base package.

**Decision:** `@modeling-kit/formats` uses `@gltf-transform/core` and `@gltf-transform/extensions` as the low-level read/write layer. SDK importers convert Transform documents into `ModelDocument` + `HalfEdgeMesh`. Exporters build a Transform document from canonical data and write JSON/GLB through in-memory `PlatformIO`.

**Consequences:**

- `importGltf` / `exportGltf` / `exportGlb` are asynchronous.
- Transform types stay internal.
- Three.js remains viewport-only (`@modeling-kit/three-adapter`).
- `@gltf-transform/functions`, `sharp`, Draco, meshopt *compression*, KTX2/Basis stay out of the base package; they may appear later as optional adapters.
- Khronos glTF Validator may run in CI or developer machines; it is not a runtime SDK dependency.

**Alternatives rejected:** hand-written glTF 2.0 codec as the long-term backend; Three.js `GLTFLoader`/`GLTFExporter` as canonical interchange; Assimp/FBX SDKs; a second scene graph.
