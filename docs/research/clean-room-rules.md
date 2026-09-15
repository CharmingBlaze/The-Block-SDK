# Clean-room rules

This SDK is an independent TypeScript modeling foundation. Blockbench is a **reference product** for user-visible capabilities and edge cases. It is **not** a source of implementation.

## Licence posture

Blockbench source code is GPL-3.0. This repository must not become a derivative work of that source.

Until the repository owner chooses a licence for this SDK, treat every contribution as original work that could later be published under a permissive licence (MIT/Apache-2.0) **or** GPL. Copying GPL code would force GPL on the whole library. Do not copy it.

## Allowed research

Inspect public materials only for:

- Features and workflows
- User-visible results
- Terminology used by artists
- File-format **behavior** of open standards (glTF, OBJ, STL, PLY)
- Edge cases (winding, seams, overlapping vertices, undo during drag)
- Architecture problems to avoid (global mutable editor state, UI-owned model, Three.js as source of truth)

Public sources we may use:

- [Blockbench website](https://www.blockbench.net/)
- [Blockbench wiki](https://www.blockbench.net/wiki/)
- GitHub README and release notes (feature lists, not code)
- Open format specifications (Khronos glTF, Wavefront OBJ, etc.)

## Forbidden

Do not copy, translate, lightly rewrite, or transplant:

- Function bodies, classes, or algorithms expressed in Blockbench source
- Comments, unique identifiers, UI assets, icons, textures, shaders
- Documentation passages
- Blockbench-specific file format implementations (including `.bbmodel`)
- Distinctive code structure that would make this library a derivative work

Renaming variables or converting JavaScript to TypeScript is **not** an independent implementation.

## Minecraft and game-format exclusion

This SDK must not include:

- Minecraft Java or Bedrock model formats
- OptiFine, GeckoLib, or other game-mod formats
- Display-slot / inventory / first-person item presentation
- MoLang or game expression languages
- Game-specific cube limits, rotation snaps (for example 22.5°), or integer-only sizes
- Skin templates, entity presets, or game branding

Cuboids remain a **general primitive**, not a Minecraft cube workflow.

## If GPL material is needed

Stop. Record in `docs/research/provenance-log.md`:

1. Exact upstream file or passage
2. Licence consequence
3. Replacement options (specify independently, use an open-standard library, or drop the feature)

Do not continue until the owner decides.

## Working method

1. Write the capability, expected result, and tests from public behavior.
2. Design our data structures and algorithms from first principles and standard CG literature.
3. Implement against our types and tests.
4. Never keep a second window of Blockbench source open while writing implementation.
