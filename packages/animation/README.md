# @modeling-kit/animation

**Animation clip authoring and playback.** Defines keyframe-based animation clips, track evaluation, interpolation, and a timeline player.

## Purpose

The `animation` package provides the canonical animation system:

- **CanonicalClipBuilder** — programmatic construction of animation clips with tracks and keyframes
- **Keyframe model** — keyframes at specific times with value, interpolation mode, and tangent control
- **Track evaluation** — sample animation tracks at arbitrary times with interpolation (step, linear, hermite)
- **AnimationPlayer** — timeline controller with play, pause, seek, speed control, and looping
- **Validation** — `validateClip`, `validateTrack`, `validateBinding` ensure clip integrity
- **glTF conversion** — bidirectional conversion between SDK clips and glTF-style animation data

## Key Exports

```ts
// Clip building
import {
  CanonicalClipBuilder, keyframe, marker,
} from "@modeling-kit/animation";

// Playback
import {
  AnimationPlayer, reverseClip, scaleClipTime,
  isLooping, type LoopPolicy,
} from "@modeling-kit/animation";

// Evaluation
import {
  evaluateDocumentClip, evaluateTrackValue,
  interpolateNumbers, interpolateHermite, interpolateRotation,
  interpolateVector, evaluatePosition, evaluateScale, evaluateVisibility,
  wrapTime,
} from "@modeling-kit/animation";

// Validation
import {
  validateClip, validateDocumentClip, validateTrack, validateBinding,
} from "@modeling-kit/animation";

// Compatibility (legacy ↔ glTF)
import {
  AnimationClipBuilder, evaluateClip,
  animationClipToDocumentClip, keyframeTrackToDocumentTrack,
  findKeyframeIndex, sampleTrack, validateKeyframeTrack,
  type AnimationClip, type KeyframeTrack, type AnimationInterpolation,
} from "@modeling-kit/animation";
```

## Usage Example

```ts
import {
  CanonicalClipBuilder, keyframe, AnimationPlayer,
} from "@modeling-kit/animation";

// Build a bouncing animation
const builder = new CanonicalClipBuilder({ name: "Bounce", duration: 2.0 });

builder.addTrack({
  targetKind: "bone",
  targetId: "bone-root",
  path: "translation",
});
builder.addKeyframe("track-0", keyframe(0.0, [0, 0, 0]));
builder.addKeyframe("track-0", keyframe(0.5, [0, 1, 0], "hermite", [0, 4, 0], [0, 4, 0]));
builder.addKeyframe("track-0", keyframe(1.0, [0, 0, 0], "hermite", [0, -4, 0], [0, -4, 0]));
builder.addKeyframe("track-0", keyframe(2.0, [0, 0, 0]));

const clip = builder.build();

// Play
const player = new AnimationPlayer(clip, {
  loop: "repeat",
  speed: 1.0,
});
player.play();

// Query pose at time
const t = player.currentTime;
const values = evaluateDocumentClip(clip, t);
```

## Architecture Notes

- Clips are stored in the document as `AnimationClipData` — they are serializable and version-controlled.
- Tracks target **bindings** (`targetKind` + `targetId` + `path`) that connect to scene objects, bones, or material properties.
- Interpolation supports **STEP**, **LINEAR**, and **CUBICSPLINE** (Hermite with in/out tangents) — matching glTF 2.0.
- `AnimationPlayer` is **headless** — it updates time but does not drive rendering. The three-adapter's `AnimationMixer` applies evaluated poses to Three.js objects.
- The compatibility layer (`legacy-clip`, `gltf-track`) bridges between the new document clip model and glTF-style `AnimationClip`/`KeyframeTrack` types.