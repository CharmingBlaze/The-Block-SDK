# Simple weighted Catmull–Clark creases

This SDK ships a **predictable low-poly crease model**. It is not OpenSubdiv, not a limit-surface evaluator, and not a production feature-adaptive subdivider.

## Supported crease range

Edge sharpness is stored as a finite normalized `EdgeCreaseWeight`:

| Value | Meaning |
| --- | --- |
| `0` | Completely smooth |
| `1` | Completely sharp |
| `undefined` | Treated as `0` |

Normal modeling commands reject `NaN`, `Infinity`, values below `0`, and values above `1`. Imported values are clamped only in explicit repair mode (`validation: "repair"` or `repairEdgeCreaseWeights`).

`creaseAngle` remains a separate shading hint. Catmull–Clark uses `creaseWeight` only.

## Formulas

### Edge points

Interior edge with endpoints `P0`, `P1` and adjacent face points `F0`, `F1`:

```text
smoothEdgePoint = (P0 + P1 + F0 + F1) / 4
sharpEdgePoint  = (P0 + P1) / 2
edgePoint       = lerp(smoothEdgePoint, sharpEdgePoint, creaseWeight)
```

Boundary edges are treated as fully sharp (`creaseWeight = 1`). No fake second face is invented.

### Smooth vertices

Canonical Catmull–Clark for an interior vertex of valence `n`:

```text
smoothVertexPoint = (F + 2R + (n - 3)P) / n
```

`F` is the average of adjacent face points. `R` is the average of adjacent edge midpoints.

### Crease vertices

An incident edge is a crease when `creaseWeight > 1e-6` (including boundary edges, which count as weight `1`).

| Incident crease edges | Rule |
| --- | --- |
| 0 | Smooth rule |
| 1 | Smooth rule (a dart is not a corner) |
| 2 | `lerp(smooth, (6P + N0 + N1) / 8, (w0 + w1) / 2)` |
| 3+ | Simple weighted corner: `lerp(smooth, P, secondLargestCreaseWeight)` |

The three-or-more rule is the SDK’s **simple weighted-corner policy**. One weak crease cannot lock a high-valence vertex.

### Boundary vertices

Boundary edges are fully sharp creases. A vertex with exactly two boundary neighbors uses `(6P + N0 + N1) / 8`. A vertex with one or more than two boundary branches is non-manifold and is rejected with `non-manifold-boundary-vertex`. The ordinary interior smooth rule is never applied to a boundary vertex.

## Crease propagation

When a parent edge splits, both child edges inherit the parent weight:

```text
childCreaseWeight = parentCreaseWeight
```

There is no per-level sharpness decay. A crease stays equally sharp through repeated subdivision. A future `creaseDecayPerLevel` option is deferred.

New interior face-point edges default to zero crease. Child edges of a UV seam remain seams.

## Attributes

Subdivision preserves face material slots and slot IDs, UV channels, UV seams, corner colors, custom normals through the canonical interpolator, and optional skin weights (blended and normalized). Unsupported or missing attributes produce warnings rather than silent drops.

## Deferred

Not implemented and not exposed:

- Unbounded or integer OpenSubdiv sharpness
- Per-vertex corner sharpness independent of edges
- Crease decay, Chaikin rules, OpenSubdiv compatibility
- Extraordinary-vertex tangent corrections
- Limit-surface evaluation, adaptive or GPU tessellation
