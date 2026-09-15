export class PickRequestGate {
  private current = 0;

  next(): number {
    this.current += 1;
    return this.current;
  }

  get currentId(): number {
    return this.current;
  }

  isCurrent(requestId: number): boolean {
    return requestId === this.current;
  }

  invalidate(): void {
    this.current += 1;
  }
}

export interface ViewportHoverState {
  readonly viewportId: string;
  readonly domain: "vertex" | "edge" | "face";
  readonly elementId: string | null;
  readonly requestId: number;
}

export class ViewportHoverStore {
  private readonly byViewport = new Map<string, ViewportHoverState>();

  set(state: ViewportHoverState): void {
    this.byViewport.set(state.viewportId, state);
  }

  get(viewportId: string): ViewportHoverState | undefined {
    return this.byViewport.get(viewportId);
  }

  applyIfCurrent(state: ViewportHoverState): boolean {
    if (state.requestId < (this.byViewport.get(state.viewportId)?.requestId ?? 0)) {
      return false;
    }
    this.set(state);
    return true;
  }

  clear(viewportId: string): void {
    this.byViewport.delete(viewportId);
  }

  dispose(): void {
    this.byViewport.clear();
  }
}
