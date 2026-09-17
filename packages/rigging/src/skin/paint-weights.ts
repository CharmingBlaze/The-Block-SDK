import type { BoneId, VertexId } from "@modeling-kit/core";
import type { HalfEdgeMesh } from "@modeling-kit/mesh";
import type { BoneWeight } from "../types";
import { DEFAULT_MAX_BONE_INFLUENCES, WEIGHT_ZERO_EPSILON } from "../constants";
import { normalizeWeightsWithReport } from "./normalize-weights";

/**
 * Weight-brush authoring operations.
 *
 * These are pure transforms over an influence map: they never touch the mesh or
 * the document, so they stay undo-friendly at the command layer and trivially
 * testable. Everything funnels through `normalizeWeightsWithReport`, so painted
 * results obey the same canonical ordering, influence cap, and sum-to-one rule as
 * imported and automatically-assigned weights.
 */

/** One vertex touched by a weight brush stroke. */
export interface WeightPaintHit {
  readonly vertexId: VertexId;
  /** Brush influence in 0..1, with radius falloff already applied by the host. */
  readonly strength: number;
}

export interface PaintWeightsOptions {
  readonly boneId: BoneId;
  readonly hits: readonly WeightPaintHit[];
  /**
   * - `add` raises the target bone and lets normalisation dilute the others.
   * - `replace` pins the target bone to `strength` and scales the others into
   *   the remaining budget, so the vertex total stays 1 without renormalising.
   */
  readonly mode?: "add" | "replace";
  readonly maxInfluences?: number;
  /** Canonicalise and renormalise each touched vertex. Defaults to true. */
  readonly normalize?: boolean;
}

export interface PaintWeightsResult {
  readonly weights: ReadonlyMap<VertexId, readonly BoneWeight[]>;
  /** Vertices whose influence list actually changed, in hit order. */
  readonly changed: readonly VertexId[];
}

function clampUnit(value: number, label: string): number {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${label} must be finite`);
  }
  return Math.min(1, Math.max(0, value));
}

function toMap(influences: readonly BoneWeight[]): Map<BoneId, number> {
  const byBone = new Map<BoneId, number>();
  for (const item of influences) {
    byBone.set(item.boneId, (byBone.get(item.boneId) ?? 0) + item.weight);
  }
  return byBone;
}

function fromMap(byBone: Map<BoneId, number>): BoneWeight[] {
  const out: BoneWeight[] = [];
  for (const [boneId, weight] of byBone) {
    out.push({ boneId, weight });
  }
  return out;
}

function sameInfluences(
  a: readonly BoneWeight[],
  b: readonly BoneWeight[],
): boolean {
  return (
    a.length === b.length &&
    a.every(
      (item, index) =>
        item.boneId === b[index]?.boneId &&
        Math.abs(item.weight - (b[index]?.weight ?? Number.NaN)) < 1e-12,
    )
  );
}

/**
 * Applies a weight brush to the given vertices.
 *
 * A vertex absent from `weights` is treated as unweighted, so a first stroke on
 * an unbaked mesh works without a separate bind step.
 */
export function paintWeights(
  weights: ReadonlyMap<VertexId, readonly BoneWeight[]>,
  options: PaintWeightsOptions,
): PaintWeightsResult {
  const mode = options.mode ?? "add";
  if (mode !== "add" && mode !== "replace") {
    throw new RangeError(`Unknown weight paint mode '${String(mode)}'`);
  }
  const normalize = options.normalize !== false;
  const maxInfluences = options.maxInfluences ?? DEFAULT_MAX_BONE_INFLUENCES;

  const next = new Map<VertexId, readonly BoneWeight[]>(weights);
  const changed: VertexId[] = [];

  for (const hit of options.hits) {
    const strength = clampUnit(hit.strength, "Weight brush strength");
    const current = next.get(hit.vertexId) ?? [];
    const byBone = toMap(current);
    const before = byBone.get(options.boneId) ?? 0;

    if (mode === "add") {
      byBone.set(options.boneId, Math.min(1, before + strength));
    } else {
      const remainder = 1 - strength;
      for (const [boneId, weight] of [...byBone.entries()]) {
        if (boneId === options.boneId) {
          continue;
        }
        const scaled = weight * remainder;
        if (scaled <= 0) {
          byBone.delete(boneId);
        } else {
          byBone.set(boneId, scaled);
        }
      }
      if (strength <= 0) {
        byBone.delete(options.boneId);
      } else {
        byBone.set(options.boneId, strength);
      }
    }

    let settled = fromMap(byBone);
    if (normalize && settled.length > 0) {
      settled = [...normalizeWeightsWithReport(settled, { maxInfluences }).influences];
    }

    if (!sameInfluences(settled, current)) {
      next.set(hit.vertexId, settled);
      if (!changed.includes(hit.vertexId)) {
        changed.push(hit.vertexId);
      }
    }
  }

  return { weights: next, changed };
}

/** Direct edge neighbours of a vertex, excluding itself. */
function vertexNeighbours(mesh: HalfEdgeMesh, vertexId: VertexId): VertexId[] {
  const neighbours: VertexId[] = [];
  for (const edgeId of mesh.getVertexEdges(vertexId)) {
    const ends = mesh.getEdgeVertices(edgeId);
    if (!ends) {
      continue;
    }
    const other = ends[0] === vertexId ? ends[1] : ends[0];
    if (other !== vertexId && !neighbours.includes(other)) {
      neighbours.push(other);
    }
  }
  return neighbours;
}

export interface PruneWeightsOptions {
  /** Influences at or below this weight are removed. Defaults to `WEIGHT_ZERO_EPSILON`. */
  readonly threshold?: number;
  readonly maxInfluences?: number;
  readonly normalize?: boolean;
}

export interface PruneWeightsResult {
  readonly weights: ReadonlyMap<VertexId, readonly BoneWeight[]>;
  readonly removed: number;
  /** Vertices left with no influences at all, so the host can warn or re-bind. */
  readonly emptied: readonly VertexId[];
}

/**
 * Drops negligible influences so exporters and GPU skinning see only real
 * weights, then renormalises what remains.
 */
export function pruneWeights(
  weights: ReadonlyMap<VertexId, readonly BoneWeight[]>,
  options: PruneWeightsOptions = {},
): PruneWeightsResult {
  const threshold = options.threshold ?? WEIGHT_ZERO_EPSILON;
  if (!Number.isFinite(threshold) || threshold < 0) {
    throw new RangeError("Prune threshold must be a finite non-negative number");
  }
  const normalize = options.normalize !== false;
  const maxInfluences = options.maxInfluences ?? DEFAULT_MAX_BONE_INFLUENCES;

  const next = new Map<VertexId, readonly BoneWeight[]>();
  const emptied: VertexId[] = [];
  let removed = 0;

  for (const [vertexId, influences] of weights) {
    const kept = influences.filter((item) => item.weight > threshold);
    removed += influences.length - kept.length;
    if (kept.length === 0) {
      emptied.push(vertexId);
      next.set(vertexId, []);
      continue;
    }
    next.set(
      vertexId,
      normalize ? [...normalizeWeightsWithReport(kept, { maxInfluences }).influences] : kept,
    );
  }

  return { weights: next, removed, emptied };
}

export interface SmoothWeightsOptions {
  /** Defaults to every vertex that currently carries influences. */
  readonly vertices?: Iterable<VertexId>;
  readonly iterations?: number;
  readonly maxInfluences?: number;
}

export interface SmoothWeightsResult {
  readonly weights: ReadonlyMap<VertexId, readonly BoneWeight[]>;
  readonly smoothed: readonly VertexId[];
}

/**
 * Laplacian-smooths influences across edge adjacency to remove brush stair-stepping.
 *
 * Each pass replaces a vertex's per-bone weight with the mean of itself and its
 * direct neighbours, then renormalises. Unweighted neighbours contribute zero, so
 * smoothing toward a bare region is intended behaviour, not a leak.
 */
export function smoothWeights(
  mesh: HalfEdgeMesh,
  weights: ReadonlyMap<VertexId, readonly BoneWeight[]>,
  options: SmoothWeightsOptions = {},
): SmoothWeightsResult {
  const iterations = options.iterations ?? 1;
  if (!Number.isInteger(iterations) || iterations < 1) {
    throw new RangeError("Smooth iterations must be a positive integer");
  }
  const maxInfluences = options.maxInfluences ?? DEFAULT_MAX_BONE_INFLUENCES;

  let current = new Map<VertexId, readonly BoneWeight[]>(weights);
  const domain = options.vertices
    ? [...new Set(options.vertices)]
    : [...current.keys()].filter((id) => (current.get(id)?.length ?? 0) > 0);
  const smoothed = new Set<VertexId>();

  for (let pass = 0; pass < iterations; pass += 1) {
    const snapshot = current;
    const updated = new Map<VertexId, readonly BoneWeight[]>(snapshot);
    for (const vertexId of domain) {
      const neighbours = vertexNeighbours(mesh, vertexId);
      const samples = neighbours.length + 1;
      const totals = new Map<BoneId, number>();
      const accumulate = (influences: readonly BoneWeight[] | undefined): void => {
        for (const item of influences ?? []) {
          totals.set(item.boneId, (totals.get(item.boneId) ?? 0) + item.weight / samples);
        }
      };
      accumulate(snapshot.get(vertexId));
      for (const neighbourId of neighbours) {
        accumulate(snapshot.get(neighbourId));
      }

      const blended = fromMap(totals);
      if (blended.length === 0) {
        continue;
      }
      const settled = [...normalizeWeightsWithReport(blended, { maxInfluences }).influences];
      updated.set(vertexId, settled);
      if (!sameInfluences(settled, snapshot.get(vertexId) ?? [])) {
        smoothed.add(vertexId);
      }
    }
    current = updated;
  }

  return { weights: current, smoothed: [...smoothed] };
}

export interface DilateWeightsOptions {
  readonly boneId: BoneId;
  /** Seed vertices, usually the ones a stroke just touched. */
  readonly vertices: Iterable<VertexId>;
  /** Multiplier applied per ring, in 0..1. Defaults to 0.7. */
  readonly growth?: number;
  readonly iterations?: number;
  readonly maxInfluences?: number;
}

export interface DilateWeightsResult {
  readonly weights: ReadonlyMap<VertexId, readonly BoneWeight[]>;
  readonly grew: readonly VertexId[];
  /**
   * Neighbours with no influences at all. They are deliberately left alone: an
   * unbound vertex has nothing to displace, so renormalising a freshly injected
   * weight would hand it 1.0 and make `growth` a no-op.
   */
  readonly skipped: number;
}

/**
 * Grows one bone's influence outward from seed vertices.
 *
 * This is the "widen the blend region without repainting it" tool. Each ring
 * receives the strongest seed weight times `growth`, and a vertex only ever
 * increases for that bone, so dilating never steals a bone a vertex already had.
 * Vertices that carry no influences are skipped rather than created.
 */
export function dilateWeights(
  mesh: HalfEdgeMesh,
  weights: ReadonlyMap<VertexId, readonly BoneWeight[]>,
  options: DilateWeightsOptions,
): DilateWeightsResult {
  const growth = clampUnit(options.growth ?? 0.7, "Dilate growth");
  const iterations = options.iterations ?? 1;
  if (!Number.isInteger(iterations) || iterations < 1) {
    throw new RangeError("Dilate iterations must be a positive integer");
  }
  const maxInfluences = options.maxInfluences ?? DEFAULT_MAX_BONE_INFLUENCES;

  const current = new Map<VertexId, readonly BoneWeight[]>(weights);
  const grew = new Set<VertexId>();
  const skipped = new Set<VertexId>();

  const weightOf = (vertexId: VertexId): number =>
    current.get(vertexId)?.find((item) => item.boneId === options.boneId)?.weight ?? 0;

  // Each pass advances the frontier outward, so ring n carries growth^n of the
  // strongest weight reaching it. Re-seeding from the original vertices each pass
  // would only re-strengthen ring 1.
  let frontierWeights = new Map<VertexId, number>(
    [...new Set(options.vertices)].map((vertexId) => [vertexId, weightOf(vertexId)]),
  );

  for (let pass = 0; pass < iterations; pass += 1) {
    const nextFrontier = new Map<VertexId, number>();
    for (const [vertexId, seedWeight] of frontierWeights) {
      const strength = seedWeight * growth;
      if (strength <= 0) {
        continue;
      }
      for (const neighbourId of vertexNeighbours(mesh, vertexId)) {
        if (strength > (nextFrontier.get(neighbourId) ?? 0)) {
          nextFrontier.set(neighbourId, strength);
        }
      }
    }
    if (nextFrontier.size === 0) {
      break;
    }

    const advanced = new Map<VertexId, number>();
    for (const [vertexId, strength] of nextFrontier) {
      const existing = current.get(vertexId) ?? [];
      if (existing.length === 0) {
        skipped.add(vertexId);
        continue;
      }
      const byBone = toMap(existing);
      if ((byBone.get(options.boneId) ?? 0) >= strength) {
        continue;
      }
      byBone.set(options.boneId, strength);
      current.set(
        vertexId,
        [...normalizeWeightsWithReport(fromMap(byBone), { maxInfluences }).influences],
      );
      grew.add(vertexId);
      advanced.set(vertexId, strength);
    }
    if (advanced.size === 0) {
      break;
    }
    frontierWeights = advanced;
  }

  return { weights: current, grew: [...grew], skipped: skipped.size };
}