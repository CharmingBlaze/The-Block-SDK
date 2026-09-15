import { querySnap } from "@modeling-kit/snapping";
import { brand, createSequenceIdFactory, type ToolId } from "@modeling-kit/core";
import type { ActionContext } from "@modeling-kit/input";
import {
  createMeshOperationContext,
  cutEndpointPoint,
  meshSnapRadius,
  planKnifeStroke,
  type HalfEdgeMesh,
  type Vec3Tuple,
} from "@modeling-kit/mesh";
import { ModalToolSession } from "./modal-session";
import type { ActionResult, EditorTool, ToolContext } from "./tool";

export interface KnifeHitOptions {
  readonly mesh?: HalfEdgeMesh;
  readonly snapRadius?: number;
}

const MAX_KNIFE_HITS = 4096;

export class KnifeTool implements EditorTool {
  readonly id: ToolId = brand("knife");
  readonly label = "Knife";
  readonly session = new ModalToolSession();
  private hits: Vec3Tuple[] = [];
  private readonly previewIds = createSequenceIdFactory("knife-preview");

  get points(): readonly Vec3Tuple[] {
    return this.hits;
  }

  activate(_context: ToolContext): void {
    this.resetStroke();
    this.session.begin();
  }

  deactivate(_context: ToolContext): void {
    this.abort();
  }

  abort(): void {
    this.resetStroke();
    this.session.cancel();
  }

  dispose(): void {
    this.abort();
  }

  previewPoint(point: Vec3Tuple, options?: KnifeHitOptions): Vec3Tuple {
    if (options?.mesh) {
      const snap = querySnap(options.mesh, point, {
        snapRadius: options.snapRadius ?? meshSnapRadius(options.mesh),
      });
      if (snap.matched && snap.worldPosition) {
        return [snap.worldPosition.x, snap.worldPosition.y, snap.worldPosition.z];
      }
    }
    return [point[0], point[1], point[2]];
  }

  addHit(point: Vec3Tuple, options?: KnifeHitOptions): void {
    if (!this.session.active) {
      this.session.begin();
    }
    this.session.markActive();
    const next = this.previewPoint(point, options);
    const last = this.hits[this.hits.length - 1];
    if (last && last[0] === next[0] && last[1] === next[1] && last[2] === next[2]) {
      return;
    }
    if (this.hits.length >= MAX_KNIFE_HITS) {
      return;
    }
    this.hits.push(next);
  }

  clear(): void {
    this.resetStroke();
    this.session.cancel();
  }

  /**
   * Commit the stroke for a command. Does not mutate the mesh.
   * Returns null if fewer than two distinct hits were recorded.
   */
  takeStroke(): Vec3Tuple[] | null {
    if (this.hits.length < 2) {
      return null;
    }
    const points = this.hits.map((point) => [point[0], point[1], point[2]] as Vec3Tuple);
    this.resetStroke();
    this.session.commit();
    return points;
  }

  guideSegments(): readonly (readonly [Vec3Tuple, Vec3Tuple])[] {
    const segments: Array<readonly [Vec3Tuple, Vec3Tuple]> = [];
    for (let i = 0; i < this.hits.length - 1; i += 1) {
      segments.push([this.hits[i]!, this.hits[i + 1]!]);
    }
    return segments;
  }

  overlayState(cursor?: Vec3Tuple, options?: KnifeHitOptions): {
    readonly active: true;
    readonly cursor?: Vec3Tuple;
    readonly vertices: readonly Vec3Tuple[];
    readonly segments: readonly (readonly [Vec3Tuple, Vec3Tuple])[];
  } {
    const vertices: Vec3Tuple[] = this.hits.map((point) => [point[0], point[1], point[2]] as Vec3Tuple);
    const segments: Array<readonly [Vec3Tuple, Vec3Tuple]> = [...this.guideSegments()];
    let resolvedCursor = cursor;
    if (!resolvedCursor && this.hits.length > 0) {
      resolvedCursor = this.hits[this.hits.length - 1];
    }
    if (resolvedCursor) {
      const last = this.hits[this.hits.length - 1];
      if (last && !samePoint(last, resolvedCursor)) {
        segments.push([last, resolvedCursor]);
      }
    }
    const stroke: Vec3Tuple[] = [...this.hits];
    if (resolvedCursor && (stroke.length === 0 || !samePoint(stroke[stroke.length - 1]!, resolvedCursor))) {
      stroke.push(resolvedCursor);
    }
    if (options?.mesh && stroke.length >= 2) {
      try {
        const plan = planKnifeStroke(
          options.mesh,
          { points: stroke, snapRadius: options.snapRadius ?? meshSnapRadius(options.mesh) },
          createMeshOperationContext(this.previewIds),
        );
        if (plan.cuts.length > 0) {
          segments.length = 0;
          for (const cut of plan.cuts) {
            const from = cutEndpointPoint(options.mesh, cut.from);
            const to = cutEndpointPoint(options.mesh, cut.to);
            segments.push([from, to]);
            vertices.push(from, to);
          }
        }
      } catch {
        // Keep the rubber-band overlay if the preview planner rejects the stroke.
      }
    }
    return {
      active: true,
      ...(resolvedCursor ? { cursor: resolvedCursor } : {}),
      vertices,
      segments,
    };
  }

  action(action: ActionContext, _context: ToolContext): ActionResult {
    if (action.action === "tool.cancel") {
      this.abort();
      return { consumed: true };
    }
    if (action.action === "tool.confirm") {
      return { consumed: this.hits.length >= 2 };
    }
    return { consumed: false };
  }

  private resetStroke(): void {
    this.hits = [];
  }
}

function samePoint(a: Vec3Tuple, b: Vec3Tuple): boolean {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}
