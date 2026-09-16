# Animation

One canonical clip/track schema lives in `@modeling-kit/document`. `@modeling-kit/animation` validates and evaluates it. Legacy glTF-shaped `{ times, values, path }` tracks exist only behind `compatibility/`.

## Stability

**Stable:** clip/track/key/binding schema, validation, renderer-neutral evaluation (position, rotation, scale, visibility), loop modes, serialization, glTF import/export of translation/rotation/scale with STEP and LINEAR.

**Preview:** animation layers, additive authoring, NLA, motion matching, pose libraries, full CUBICSPLINE round-trip.

## Canonical tracks

Bindings are `{ targetKind: "object" | "bone", targetId, channel }`. Channels: `position` (3), `rotation` (4, quaternion), `scale` (3), `visibility` (1, objects only). Duplicate target/channel pairs are rejected. Key times must be finite, unique, and sorted. Component counts are exact.

Interpolation:

| Canonical | glTF | Notes |
| --- | --- | --- |
| `constant` | `STEP` | Held until the next key |
| `linear` | `LINEAR` | Quaternion uses normalized slerp, never component lerp |
| `cubic` | not standard CUBICSPLINE | Catmull-Rom on scalars; rotations slerp. Export as LINEAR with a loss |

glTF `CUBICSPLINE` is **rejected in strict mode** and **approximated as LINEAR keys in repair mode**, always with `unsupported-interpolation`. It is never treated as LINEAR silently.

Visibility tracks are SDK-only. Export omits them with `unsupported-animation-channel`. Markers are omitted with `markers-omitted`.

## Evaluation

`evaluateDocumentClip(clip, time, skeleton?)` wraps time by `loopMode`, applies tracks, and reports missing bone targets. Rest-pose fallback is used when a skeleton is supplied.

Three.js playback (`createThreeAnimationClip` / `AnimationMixer`) is preview-only and must not become the source of truth.

Host interchange: [`../guides/formats.md`](../guides/formats.md). NLA / layers authoring is out of 1.0.
