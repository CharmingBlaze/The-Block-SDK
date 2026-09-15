import { brand, type EdgeId, type ToolId } from "@modeling-kit/core";
import type { ActionContext } from "@modeling-kit/input";
import {
  collectOrientedQuadEdgeLoop,
  factorOnOrientedEdge,
  previewLoopCut,
  type HalfEdgeMesh,
  type LoopCutPreview,
  type Vec3Tuple,
} from "@modeling-kit/mesh";
import { ModalToolSession } from "./modal-session";
import type { ActionResult, EditorTool, ToolContext } from "./tool";

export type LoopCutPhase = "hover" | "slide";

export class LoopCutTool implements EditorTool {
  readonly id: ToolId = brand("loop-cut");
  readonly label = "Loop Cut";
  readonly session = new ModalToolSession();
  phase: LoopCutPhase = "hover";
  hoverEdgeId: EdgeId | null = null;
  startEdgeId: EdgeId | null = null;
  factor = 0.5;
  cuts = 1;

  activate(_context?: ToolContext): void {
    this.reset();
    this.session.begin();
  }

  deactivate(_context?: ToolContext): void {
    this.abort();
  }

  abort(): void {
    this.reset();
    this.session.cancel();
  }

  dispose(): void {
    this.abort();
  }

  reset(): void {
    this.phase = "hover";
    this.hoverEdgeId = null;
    this.startEdgeId = null;
    this.factor = 0.5;
    this.cuts = 1;
  }

  setHoverEdge(edgeId: EdgeId | null): void {
    if (this.phase !== "hover") {
      return;
    }
    this.hoverEdgeId = edgeId;
  }

  addCut(): void {
    if (this.phase !== "hover") {
      return;
    }
    this.cuts = Math.min(32, this.cuts + 1);
  }

  removeCut(): void {
    if (this.phase !== "hover") {
      return;
    }
    this.cuts = Math.max(1, this.cuts - 1);
  }

  beginSlide(): boolean {
    const edgeId = this.hoverEdgeId;
    if (!edgeId) {
      return false;
    }
    this.startEdgeId = edgeId;
    this.session.markActive();
    if (this.cuts > 1) {
      this.factor = 0.5;
      return true;
    }
    this.phase = "slide";
    this.factor = 0.5;
    return true;
  }

  slideTo(mesh: HalfEdgeMesh, point: Vec3Tuple): void {
    const edgeId = this.startEdgeId;
    if (this.phase !== "slide" || !edgeId) {
      return;
    }
    this.session.markActive();
    const oriented = collectOrientedQuadEdgeLoop(mesh, edgeId).find((edge) => edge.edgeId === edgeId);
    if (!oriented) {
      return;
    }
    this.factor = factorOnOrientedEdge(mesh, oriented, point);
  }

  preview(mesh: HalfEdgeMesh): LoopCutPreview | null {
    const edgeId = this.phase === "slide" ? this.startEdgeId : this.hoverEdgeId;
    if (!edgeId || !mesh.edges.has(edgeId)) {
      return null;
    }
    return previewLoopCut(mesh, {
      startEdgeId: edgeId,
      factor: this.factor,
      cuts: this.cuts,
    });
  }

  commitParams(): { startEdgeId: EdgeId; factor: number; cuts: number } | null {
    const edgeId = this.startEdgeId ?? this.hoverEdgeId;
    if (!edgeId) {
      return null;
    }
    return { startEdgeId: edgeId, factor: this.factor, cuts: this.cuts };
  }

  takeParams(): { startEdgeId: EdgeId; factor: number; cuts: number } | null {
    const params = this.commitParams();
    if (!params) {
      return null;
    }
    this.session.commit();
    this.reset();
    return params;
  }

  setStartEdge(edgeId: EdgeId): void {
    this.hoverEdgeId = edgeId;
    this.startEdgeId = edgeId;
  }

  action(action: ActionContext): ActionResult {
    if (action.action === "tool.cancel") {
      if (this.phase === "slide") {
        this.phase = "hover";
        this.startEdgeId = null;
        this.factor = 0.5;
        this.session.cancel();
        this.session.begin();
        return { consumed: true };
      }
      this.abort();
      this.session.begin();
      return { consumed: true };
    }
    if (action.action === "tool.confirm") {
      return { consumed: this.commitParams() !== null };
    }
    return { consumed: false };
  }
}

export class ExtrudeTool implements EditorTool {
  readonly id: ToolId = brand("extrude");
  readonly label = "Extrude";
  readonly session = new ModalToolSession();
  distance = 0.5;
  private baseline = 0.5;

  activate(_context?: ToolContext): void {
    this.distance = 0.5;
    this.baseline = 0.5;
    this.session.begin();
  }

  deactivate(_context?: ToolContext): void {
    this.abort();
  }

  abort(): void {
    this.distance = this.baseline;
    this.session.cancel();
  }

  dispose(): void {
    this.abort();
  }

  slide(delta: number): void {
    this.session.markActive();
    this.distance = this.baseline + delta;
  }

  commitParams(): { distance: number } {
    return { distance: this.distance };
  }

  takeParams(): { distance: number } | null {
    if (!this.session.commit()) {
      return null;
    }
    const params = { distance: this.distance };
    this.baseline = this.distance;
    return params;
  }

  action(action: ActionContext): ActionResult {
    if (action.action === "tool.cancel") {
      this.distance = 0.5;
      this.baseline = 0.5;
      this.session.cancel();
      this.session.begin();
      return { consumed: true };
    }
    if (action.action === "tool.confirm") {
      return { consumed: true };
    }
    return { consumed: false };
  }
}

export class MergeTool implements EditorTool {
  readonly id: ToolId = brand("merge");
  readonly label = "Merge Vertices";
  readonly session = new ModalToolSession();
  epsilon = 1e-6;

  activate(_context?: ToolContext): void {
    this.epsilon = 1e-6;
    this.session.begin();
  }

  deactivate(_context?: ToolContext): void {
    this.abort();
  }

  abort(): void {
    this.epsilon = 1e-6;
    this.session.cancel();
  }

  dispose(): void {
    this.abort();
  }

  takeParams(): { epsilon: number } | null {
    if (!this.session.commit()) {
      return null;
    }
    return { epsilon: this.epsilon };
  }

  action(action: ActionContext): ActionResult {
    if (action.action === "tool.cancel") {
      this.abort();
      this.session.begin();
      return { consumed: true };
    }
    if (action.action === "tool.confirm") {
      return { consumed: true };
    }
    return { consumed: false };
  }
}

export class BevelTool implements EditorTool {
  readonly id: ToolId = brand("bevel");
  readonly label = "Bevel";
  readonly session = new ModalToolSession();
  offset = 0.1;
  segments = 1;
  private baselineOffset = 0.1;

  activate(_context?: ToolContext): void {
    this.offset = 0.1;
    this.segments = 1;
    this.baselineOffset = 0.1;
    this.session.begin();
  }

  deactivate(_context?: ToolContext): void {
    this.abort();
  }

  abort(): void {
    this.offset = this.baselineOffset;
    this.session.cancel();
  }

  dispose(): void {
    this.abort();
  }

  slide(delta: number): void {
    this.session.markActive();
    this.offset = Math.max(0.05, this.baselineOffset + delta);
  }

  takeParams(): { offset: number; segments: number } | null {
    if (!this.session.commit()) {
      return null;
    }
    this.baselineOffset = this.offset;
    return { offset: this.offset, segments: this.segments };
  }

  action(action: ActionContext): ActionResult {
    if (action.action === "tool.cancel") {
      this.offset = 0.1;
      this.segments = 1;
      this.baselineOffset = 0.1;
      this.session.cancel();
      this.session.begin();
      return { consumed: true };
    }
    if (action.action === "tool.confirm") {
      return { consumed: true };
    }
    return { consumed: false };
  }
}
