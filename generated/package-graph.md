# Package graph

Generated from workspace manifests (dependencies + peerDependencies with `workspace:`). Refresh with `pnpm repo:map`.

```text
@modeling-kit/animation → @modeling-kit/core, @modeling-kit/document, @modeling-kit/math, @modeling-kit/rigging
@modeling-kit/commands → @modeling-kit/animation, @modeling-kit/core, @modeling-kit/document, @modeling-kit/history, @modeling-kit/materials, @modeling-kit/math, @modeling-kit/mesh, @modeling-kit/paint, @modeling-kit/primitives, @modeling-kit/rigging, @modeling-kit/scene, @modeling-kit/selection, @modeling-kit/snapping, @modeling-kit/tools, @modeling-kit/transform, @modeling-kit/uv, @modeling-kit/validation
@modeling-kit/core → (none)
@modeling-kit/document → @modeling-kit/core, @modeling-kit/math
@modeling-kit/formats → @modeling-kit/core, @modeling-kit/document, @modeling-kit/math, @modeling-kit/mesh, @modeling-kit/scene
@modeling-kit/history → @modeling-kit/core, @modeling-kit/document, @modeling-kit/mesh, @modeling-kit/selection
@modeling-kit/input → @modeling-kit/core, @modeling-kit/math
@modeling-kit/materials → @modeling-kit/core, @modeling-kit/document, @modeling-kit/mesh
@modeling-kit/math → (none)
@modeling-kit/mesh → @modeling-kit/core, @modeling-kit/math
@modeling-kit/paint → @modeling-kit/core, @modeling-kit/math, @modeling-kit/mesh, @modeling-kit/uv
@modeling-kit/primitives → @modeling-kit/core, @modeling-kit/mesh, @modeling-kit/validation
@modeling-kit/rigging → @modeling-kit/core, @modeling-kit/document, @modeling-kit/math, @modeling-kit/mesh
@modeling-kit/scene → @modeling-kit/core, @modeling-kit/document, @modeling-kit/math
@modeling-kit/sdk → @modeling-kit/animation, @modeling-kit/commands, @modeling-kit/core, @modeling-kit/document, @modeling-kit/formats, @modeling-kit/history, @modeling-kit/input, @modeling-kit/materials, @modeling-kit/math, @modeling-kit/mesh, @modeling-kit/paint, @modeling-kit/primitives, @modeling-kit/rigging, @modeling-kit/scene, @modeling-kit/selection, @modeling-kit/snapping, @modeling-kit/three-adapter, @modeling-kit/tools, @modeling-kit/transform, @modeling-kit/uv, @modeling-kit/validation, @modeling-kit/workers, three (peer)
@modeling-kit/selection → @modeling-kit/core, @modeling-kit/mesh
@modeling-kit/snapping → @modeling-kit/math
@modeling-kit/three-adapter → @modeling-kit/commands, @modeling-kit/core, @modeling-kit/document, @modeling-kit/mesh, @modeling-kit/rigging, @modeling-kit/scene, three (peer)
@modeling-kit/tools → @modeling-kit/core, @modeling-kit/input, @modeling-kit/math, @modeling-kit/mesh
@modeling-kit/transform → @modeling-kit/core, @modeling-kit/document, @modeling-kit/math, @modeling-kit/mesh, @modeling-kit/scene, @modeling-kit/snapping
@modeling-kit/uv → @modeling-kit/core, @modeling-kit/math, @modeling-kit/mesh
@modeling-kit/validation → @modeling-kit/core, @modeling-kit/math, @modeling-kit/mesh
@modeling-kit/workers → @modeling-kit/core, @modeling-kit/mesh, @modeling-kit/uv, @modeling-kit/validation
```

Source-import rules (including Three.js and layer bans) are enforced by `.dependency-cruiser.cjs` (`pnpm arch:check`).

