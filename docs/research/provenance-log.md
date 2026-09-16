# Provenance log

Record every research source and every third-party dependency. If Blockbench source is ever copied or adapted, stop and log it here before continuing.

## Repository licence (this SDK)

**Status:** MIT.

`LICENSE` is the MIT License. Host applications may depend on these packages without inheriting GPL from Blockbench, which remains a capability reference only.

## Blockbench (reference product only)

| Item                                | Value                                   |
| ----------------------------------- | --------------------------------------- |
| Product                             | Blockbench                              |
| Repository                          | https://github.com/JannisX11/blockbench |
| Source licence                      | GPL-3.0 (`LICENSE.MD`)                  |
| Use in this SDK                     | Capability and workflow reference only  |
| Code copied                         | **None**                                |
| Assets copied                       | **None**                                |
| Formats implemented from Blockbench | **None** (`.bbmodel` is out of scope)   |

### Public materials consulted (Phase 0)

| Source                                                        | What we took                                                                                               | What we did not take                                               |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| https://www.blockbench.net/                                   | Product scope: low-poly modeling, texturing, animation, plugins, Three.js-based app                        | Implementation                                                     |
| https://blockbench.net/wiki/guides/blockbench-overview-tips/  | Modes, cuboid vs mesh, UV panel behavior, paint tools, bone parenting, keyframe timeline, transform spaces | UI layout, keybindings as defaults, documentation text as ours     |
| https://www.blockbench.net/wiki/guides/export-formats/        | User-visible glTF/OBJ/FBX/DAE tradeoffs                                                                    | Exporter code; we will use open specs and independent libraries    |
| https://www.blockbench.net/wiki/blockbench/formats/           | Confirmation that many formats are game-specific                                                           | Those formats themselves (rejected)                                |
| https://www.blockbench.net/wiki/docs/bbmodel/                 | `.bbmodel` is an internal Blockbench JSON project                                                          | The format specification and `bbmodel` codec                       |
| https://www.blockbench.net/wiki/docs/plugin/                  | Plugin model is JS, tightly coupled to a host app                                                          | Plugin.register, Undo.initEdit, Canvas.updateView, or similar APIs |
| https://github.com/JannisX11/blockbench/blob/master/README.md | GPL source; Electron + web app; plugins                                                                    | Build scripts, app shell                                           |
| https://github.com/JannisX11/blockbench/releases/tag/v4.10.0  | Knife tool, loop-related mesh work, solidify, transform space rename to Parent, mesh selection hover       | Algorithms, Minecraft changelog items                              |

## Intentional exclusions

The following Blockbench-adjacent artefacts must never appear in this SDK as implementations or branded copies:

- `.bbmodel` import/export
- Minecraft Java block/item JSON
- Bedrock geometry and animation JSON
- OptiFine `.jem` / `.jpm`
- GeckoLib codecs
- Display mode (third-person, GUI, item frame slots)
- Skin presets and entity templates
- Blockbench icons, themes, and UI copy

## Third-party libraries (planned, not yet added)

Dependencies will be logged here when added, with licence and purpose. Expected candidates:

| Library                                                      | Likely licence | Purpose                                               | Notes                            |
| ------------------------------------------------------------ | -------------- | ----------------------------------------------------- | -------------------------------- |
| three                                                        | MIT            | Viewport adapter (`@modeling-kit/three-adapter` peer) | Added Phase 4                    |
| glTF validator / loaders                                     | per package    | Formats package                                       | Prefer Khronos-aligned libraries |
| TypeScript, Vitest, Vite, tsup, ESLint, Prettier, Changesets | various OSI    | Tooling                                               | Not shipped as modeling IP       |

| https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html | Open glTF 2.0 JSON/buffer layout and GLB chunk container for import/export | Blockbench’s exporter |

Approved optional libraries (not installed until wrapped; see `docs/architecture/dependency-policy.md`): `earcut` (ISC), `robust-predicates` (Unlicense), `zod` (MIT), `three-mesh-bvh` (MIT), `manifold-3d`, `@gltf-transform/*` (MIT), `meshoptimizer`. Do not add them to required SDK dependencies without the 10-point review.

## Added development tooling (2026-09-15)

All of the following are **root `devDependencies` only**. They must not appear on published `@modeling-kit/*` runtime dependency lists. Removal: delete the package from root `package.json`, drop its config/scripts, and run `pnpm install`.

### fast-check 4.10.0 (MIT)

1. Problem: topology and invalid-input tests are example-based and miss shrunk edge cases.  
2. Why current stack cannot: Vitest has no generator/shrinker.  
3. Bundle-size: none (dev-only, tests).  
4. Runtime cost: property tests only when `pnpm test:properties` / `pnpm test` includes `*.property.test.ts`.  
5. Licence: MIT.  
6. Maintenance: actively maintained.  
7. Browser/Node: Node test runner; no browser bundle impact.  
8. Canonical model: unchanged.  
9. Abstraction: tests import operators; production code does not import fast-check.  
10. Tests: `packages/mesh/tests/split-edge.property.test.ts`.

### dependency-cruiser 18.3.0 (MIT)

1. Problem: agents can invert package direction or import `three` into headless code.  
2. Why current stack cannot: ESLint does not encode the workspace graph.  
3. Bundle-size: none (dev-only).  
4. Runtime cost: CI/`pnpm arch:check`.  
5. Licence: MIT.  
6. Maintenance: actively maintained; requires Node `^22 || ^24 || >=26`.  
7. Browser/Node: Node CLI.  
8. Canonical model: unchanged.  
9. Abstraction: rules in `.dependency-cruiser.cjs` match real package names.  
10. Tests: `pnpm arch:check` is the gate. Do not leave Three.js imports in headless packages as probes.

### knip 6.35.1 (ISC)

1. Problem: abandoned agent files and unused deps accumulate.  
2. Why current stack cannot: ESLint unused-vars is file-local.  
3. Bundle-size: none.  
4. Runtime cost: report-only (`pnpm deadcode -- --no-exit-code` is the script default).  
5. Licence: ISC.  
6. Maintenance: actively maintained.  
7. Browser/Node: Node CLI.  
8. Canonical model: unchanged.  
9. Abstraction: `knip.json` treats package `src/index.ts` as public entry (`!`).  
10. Tests: baseline report in `docs/verification/TOOLING-AUDIT.md`; no automatic deletion.

### repomix 1.18.0 (MIT)

1. Problem: agents load unrelated packages and blow the token budget.  
2. Why current stack cannot: no task-specific packer with token counts and secret scan.  
3. Bundle-size: none.  
4. Runtime cost: on-demand `pnpm repo:context`.  
5. Licence: MIT.  
6. Maintenance: actively maintained.  
7. Browser/Node: Node CLI.  
8. Canonical model: unchanged.  
9. Abstraction: presets in `scripts/generate-agent-context.ts`; output gitignored.  
10. Tests: mesh preset token count recorded in TOOLING-AUDIT.

### Serena MCP (Apache-2.0, not an npm dependency)

1. Problem: symbol search without reading whole files.  
2. Why current stack cannot: Cursor grep still pulls file bodies.  
3. Bundle-size: none (external MCP via `uvx`).  
4. Runtime cost: language server index in `.serena/` (cache gitignored).  
5. Licence: Apache-2.0.  
6. Maintenance: actively maintained (oraios/serena).  
7. Browser/Node: local stdio MCP; TypeScript language server.  
8. Canonical model: unchanged.  
9. Abstraction: read-only `.serena/project.yml`; Cursor still reviews all edits.  
10. Tests: manual MCP find-symbol after `uv` is installed (see TOOLING-AUDIT).

Do not add a dependency that is GPL unless the owner has chosen GPL for this SDK.

## Incident log

No GPL code has been copied. No implementation phase has started.
