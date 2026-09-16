import { brand, type ToolId } from "@modeling-kit/core";
import type { ActionContext } from "@modeling-kit/input";
import type { Vec3Tuple } from "@modeling-kit/mesh";
import { ModalToolSession } from "./modal-session";
import type { ActionResult, EditorTool, ToolContext } from "./tool";

export type ProfileDrawKind = "polygon" | "path";

export type ProfileDrawPoint = readonly [number, number];

export interface ProfileDrawParameters {
  readonly profile: {
    readonly kind: ProfileDrawKind;
    readonly outer: readonly ProfileDrawPoint[];
    readonly holes?: readonly (readonly ProfileDrawPoint[])[];
  };
  readonly depth: number;
  readonly bevelSize: number;
  readonly bevelSegments: number;
  readonly caps: boolean;
  readonly lineWidth: number;
  readonly name?: string;
}

/**
 * Idle → drawing → previewing → commit/cancel via {@link ModalToolSession}.
 * Does not mutate the document. Hosts generate preview meshes from
 * {@link previewParameters} and must drop them on abort.
 */
export class ProfileDrawTool implements EditorTool {
  readonly id: ToolId = brand("profile-draw");
  readonly label = "Profile Draw";
  readonly session = new ModalToolSession();
  kind: ProfileDrawKind = "polygon";
  depth = 1;
  lineWidth = 0.1;
  bevelSize = 0;
  bevelSegments = 2;
  caps = true;
  name: string | undefined;
  previewRevision = 0;
  private outer: ProfileDrawPoint[] = [];
  private holes: ProfileDrawPoint[][] = [];
  private holeDraft: ProfileDrawPoint[] = [];

  get points(): readonly ProfileDrawPoint[] {
    return this.outer;
  }

  get holeLoops(): readonly (readonly ProfileDrawPoint[])[] {
    return this.holes;
  }

  activate(_context?: ToolContext): void {
    this.resetStroke();
    this.session.begin();
  }

  deactivate(_context?: ToolContext): void {
    this.abort();
  }

  abort(): void {
    this.resetStroke();
    this.session.cancel();
  }

  dispose(): void {
    this.abort();
  }

  addPoint(x: number, z: number): void {
    this.ensureOpen();
    this.session.markActive();
    pushUnique(this.outer, [x, z]);
    this.previewRevision += 1;
  }

  addWorldPoint(point: Vec3Tuple): void {
    this.addPoint(point[0], point[2]);
  }

  addHolePoint(x: number, z: number): void {
    this.ensureOpen();
    this.session.markActive();
    pushUnique(this.holeDraft, [x, z]);
    this.previewRevision += 1;
  }

  closeHole(): boolean {
    if (this.holeDraft.length < 3) {
      this.holeDraft = [];
      return false;
    }
    this.holes.push(this.holeDraft);
    this.holeDraft = [];
    this.previewRevision += 1;
    return true;
  }

  setDepth(depth: number): void {
    this.ensureOpen();
    this.session.markActive();
    this.depth = depth;
    this.previewRevision += 1;
  }

  previewParameters(): ProfileDrawParameters | null {
    if (!this.canCommit()) {
      return null;
    }
    return this.snapshot();
  }

  takeParams(): ProfileDrawParameters | null {
    if (!this.canCommit() || !this.session.commit()) {
      return null;
    }
    const params = this.snapshot();
    this.resetStroke();
    return params;
  }

  action(action: ActionContext): ActionResult {
    if (action.action === "tool.cancel") {
      this.abort();
      this.session.begin();
      return { consumed: true };
    }
    if (action.action === "tool.confirm") {
      return { consumed: this.canCommit() };
    }
    return { consumed: false };
  }

  private canCommit(): boolean {
    if (!(this.depth > 0) || !Number.isFinite(this.depth)) {
      return false;
    }
    if (this.kind === "path") {
      return this.outer.length >= 2 && this.holes.length === 0;
    }
    return this.outer.length >= 3;
  }

  private snapshot(): ProfileDrawParameters {
    return {
      profile: {
        kind: this.kind,
        outer: this.outer.map((p) => [p[0], p[1]] as const),
        ...(this.kind === "polygon" && this.holes.length > 0
          ? { holes: this.holes.map((hole) => hole.map((p) => [p[0], p[1]] as const)) }
          : {}),
      },
      depth: this.depth,
      bevelSize: this.bevelSize,
      bevelSegments: this.bevelSegments,
      caps: this.caps,
      lineWidth: this.lineWidth,
      ...(this.name !== undefined ? { name: this.name } : {}),
    };
  }

  private ensureOpen(): void {
    if (!this.session.active) {
      this.session.begin();
    }
  }

  private resetStroke(): void {
    this.outer = [];
    this.holes = [];
    this.holeDraft = [];
    this.previewRevision += 1;
  }
}

function pushUnique(points: ProfileDrawPoint[], next: ProfileDrawPoint): void {
  const last = points[points.length - 1];
  if (last && last[0] === next[0] && last[1] === next[1]) {
    return;
  }
  points.push(next);
}
