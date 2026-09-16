# Simple bevel miters

Bevel supports **simple manifold edge networks** with two explicit corner modes. It does not generate Blender-style arc, patch, or grid-fill junctions.

## Supported selection

Supported:

- One manifold interior edge
- Multiple disconnected manifold edges
- Open connected chains
- Closed loops
- Two selected edges meeting at a vertex
- Simple convex corners
- Simple concave corners whose offset intersection stays valid
- One bevel segment, plus the existing small fixed segment count

Rejected before mutation:

- Three or more selected edges at one vertex (`unsupported-bevel-junction`)
- Non-manifold edges
- Boundary edges
- Degenerate adjacent faces
- Overlaps when `overlapMode: "error"`
- Complex concave miters (`unsupported-complex-concave-miter`)
- Sharp miters that exceed the miter limit unless clip fallback is explicit

The entire selection is planned first. A failure in one component does not leave another component committed.

## Miter modes

```ts
type SimpleBevelMiterMode = "sharp" | "clip";
```

**Sharp** extends the two adjacent offset lines to their intersection when that point is finite, does not reverse adjacent edges, and stays inside the miter limit.

**Clip** cuts the corner with a short connecting edge (and a simple filler face when needed). Modes are never switched silently. `allowClipFallback: true` is required before a failed sharp miter may clip, and the result includes a `bevel-clip-fallback` warning.

## Width and overlap

`offset` (or alias `width`) is a positive finite value. Zero and negative widths are errors.

- `"offset"`: world/model-space distance
- `"percent"`: fraction of the adjacent edge length, in `(0, 0.5)`

```ts
type BevelOverlapMode = "clamp" | "error";
```

`"error"` rejects before mutation. `"clamp"` applies the maximum safe width and returns a structured `bevel-clamped` warning with requested width, applied width, and affected edge IDs. Clamping is never silent. Mixed-length edges record `appliedWidths` per source edge.

The default overlap mode is `"clamp"` so existing hosts keep working, but the warning is always present when a clamp occurs.

## Miter limit

```ts
interface SimpleBevelOptions {
  readonly miterLimit?: number;
}
```

Interpretation: `miterDistance / appliedWorldWidth`. Default is `2`. Spike-like miters are rejected (or clipped only when fallback is enabled).

## Attribute policy

- Replacement portions of source faces keep source materials and interpolated UVs.
- New bevel faces inherit the first adjacent source face’s material slot.
- Chamfer UVs are interpolated from source corners when those corners have UVs. They are not filled with `[0, 0]`.
- Replacement edges parallel to a creased/seam source edge inherit crease and seam. New chamfer interior edges default to zero crease.
- Attribute loss produces diagnostics.

## Deferred

Not implemented and not claimed:

- Three-edge (or higher) bevel junctions
- Custom profiles, profile curves, per-vertex bevel weights
- Arc, patch, or grid-fill miters
- Multi-material junction patches
- Boundary-edge bevel
