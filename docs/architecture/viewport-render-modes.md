# Three.js viewport render modes

## Ownership boundary

`ViewportDisplayController` is presentation infrastructure in `@modeling-kit/three-adapter`. The canonical document remains the sole owner of editable meshes, material records, textures, UVs, seams, creases, selection IDs, and history. Mode changes temporarily bind cached derived Three.js materials for a frame and restore the adapter material immediately afterward.

Each viewport independently owns and disposes:

- one neutral studio light rig with one shadow-casting directional key;
- one transparent ground receiver;
- lazily cached material variants and cloned display textures;
- one shared UV-checker texture;
- optional triangulation overlay objects that share adapter geometry;
- the directional light's single shadow map.

No ambient-occlusion or full-screen post-processing pass, composer, or screen-sized render target is created.

## Canonical topology overlays

Wireframe and Shaded Wireframe use `SubElementVisualizer`, which builds segments from canonical half-edges rather than the triangulated render index. Its edge-role classifier keeps boundary, interior, seam, sharp/crease, hovered, and selected styling distinct. Triangulation is a separate derived overlay and defaults off.

## Shadow invalidation

`renderer.shadowMap.autoUpdate` is false. The controller marks its single shadow map dirty for geometry, transform, hierarchy, visibility, selection/fitting-region, material/texture, light-preset, and render-setting changes. A static frame sets neither `autoUpdate` nor `needsUpdate`, so the map is reused.

The orthographic shadow camera fits the selected visible object when one exists, otherwise the visible model scene. `maxShadowFitSize` clamps the fitted area to avoid sacrificing depth and texel precision for outliers. Only the key light casts; fill, rim, and hemisphere lights never allocate shadow maps.

## Resource and performance budget

Deterministic shadow-map allocation at four bytes per depth texel is approximately:

| Quality | Resolution | Approximate depth storage |
| --- | ---: | ---: |
| Off | — | 0 MiB |
| Low | 512² | 1 MiB |
| Medium (default) | 1024² | 4 MiB |
| High | 2048² | 16 MiB |

There are no additional screen-resolution effect targets. Material and texture variants are created once per source/mode/flat-shading/filter combination, reused across switches, pruned when source materials disappear, and disposed with the viewport. Canonical edge buffers are reused by the existing visualizer; triangulation overlays share source geometry and allocate no duplicate geometry.

Automated evidence in `viewport-display-settings.test.ts` verifies 512/1024/2048 sizing, all mode transitions, cache stability on repeated frames, single-map dirty/static behavior, canonical cube edge count (12 rather than triangulated 18), multi-viewport isolation, and disposal. On the current validation run, all 123 three-adapter tests completed in about 1.6 seconds of test execution time (roughly eight seconds including transform/collection), the real-WebGL suite rendered all nine modes and checked static shadow reuse in about five seconds, and the Sol3D production build completed in under ten seconds. GPU frame time remains device/content dependent and should be profiled by host applications with their representative assets.
