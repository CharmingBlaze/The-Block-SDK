import { UVDirtyBatcher, UVPaintDirtyFlag } from "./dirty";
import { pickUv, type UVPickHit } from "./picking";
import type { UVSelectionMode, UVSelectionState } from "./selection";
import type { UVTopology } from "./topology";
import {
  IDENTITY_UV_VIEW,
  buildUvViewData,
  type UVViewData,
  type UVViewTransform,
} from "./view-data";
import { themeForPreset, type UVEditorPreset, type UVVisualTheme } from "./visual";

export type UVViewSchedule = (flush: () => void) => () => void;

export interface UVViewAdapterOptions {
  readonly theme?: UVVisualTheme;
  readonly preset?: UVEditorPreset;
  readonly schedule?: UVViewSchedule;
  /** Called once from `dispose()` so editors can drop the view from their set. */
  readonly onDispose?: () => void;
}

export class UVViewAdapter {
  hoveredId: string | null = null;
  view: UVViewTransform = { ...IDENTITY_UV_VIEW };
  theme: UVVisualTheme;
  readonly dirty = new UVDirtyBatcher();
  private cancelSchedule: (() => void) | null = null;
  private disposed = false;
  private cached: UVViewData | null = null;
  private lastHover: string | null = null;

  constructor(
    private readonly resolveTopology: () => UVTopology,
    private readonly resolveSelection: () => UVSelectionState,
    private readonly texture: { width: number; height: number },
    options: UVViewAdapterOptions = {},
  ) {
    this.theme = options.theme ?? themeForPreset(options.preset ?? "professional");
    this.schedule = options.schedule ?? undefined;
    this.onDispose = options.onDispose;
    this.dirty.mark(
      UVPaintDirtyFlag.UVTopology |
        UVPaintDirtyFlag.UVPositions |
        UVPaintDirtyFlag.UVSelection |
        UVPaintDirtyFlag.UVVisuals,
    );
  }

  private readonly schedule: UVViewSchedule | undefined;
  private readonly onDispose: (() => void) | undefined;

  get disposedState(): boolean {
    return this.disposed;
  }

  mark(flags: UVPaintDirtyFlag): void {
    if (this.disposed) {
      return;
    }
    this.dirty.mark(flags);
    this.queue();
  }

  setHover(hit: UVPickHit | null): string | null {
    if (this.disposed) {
      return null;
    }
    const next = hit?.id ?? null;
    if (next === this.hoveredId) {
      return this.hoveredId;
    }
    this.lastHover = this.hoveredId;
    this.hoveredId = next;
    this.mark(UVPaintDirtyFlag.UVVisuals | UVPaintDirtyFlag.Picking);
    return this.hoveredId;
  }

  pick(uv: readonly [number, number], mode: UVSelectionMode): UVPickHit | null {
    if (this.disposed) {
      return null;
    }
    return pickUv(this.resolveTopology(), uv, mode, this.theme, this.view);
  }

  setViewTransform(view: Partial<UVViewTransform>): void {
    if (this.disposed) {
      return;
    }
    this.view = { ...this.view, ...view };
    this.mark(UVPaintDirtyFlag.UVVisuals);
  }

  setTheme(theme: UVVisualTheme): void {
    if (this.disposed) {
      return;
    }
    this.theme = theme;
    this.mark(UVPaintDirtyFlag.UVVisuals);
  }

  getViewData(): UVViewData {
    if (this.disposed) {
      throw new Error("UVViewAdapter is disposed");
    }
    this.dirty.flush(() => {
      this.cached = buildUvViewData({
        topology: this.resolveTopology(),
        selection: this.resolveSelection(),
        hoveredId: this.hoveredId,
        theme: this.theme,
        view: this.view,
        textureWidth: this.texture.width,
        textureHeight: this.texture.height,
      });
    });
    if (!this.cached) {
      this.cached = buildUvViewData({
        topology: this.resolveTopology(),
        selection: this.resolveSelection(),
        hoveredId: this.hoveredId,
        theme: this.theme,
        view: this.view,
        textureWidth: this.texture.width,
        textureHeight: this.texture.height,
      });
    }
    return this.cached;
  }

  previousHoveredId(): string | null {
    return this.lastHover;
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.cancelSchedule?.();
    this.cancelSchedule = null;
    this.dirty.dispose();
    this.hoveredId = null;
    this.lastHover = null;
    this.cached = null;
    this.onDispose?.();
  }

  private queue(): void {
    if (this.disposed || this.dirty.scheduled) {
      return;
    }
    if (!this.schedule) {
      return;
    }
    this.dirty.scheduled = true;
    this.cancelSchedule = this.schedule(() => {
      this.cancelSchedule = null;
      if (this.disposed) {
        return;
      }
      this.getViewData();
    });
  }
}
