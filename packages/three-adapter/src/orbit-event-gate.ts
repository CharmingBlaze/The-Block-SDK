/**
 * Event target given to OrbitControls instead of the canvas.
 * The gesture controller forwards only navigation-owned events here so
 * OrbitControls never records leftover pointers from selection/tool/gizmo.
 */
export interface OrbitEventGate {
  readonly style: CSSStyleDeclaration | { touchAction?: string };
  readonly ownerDocument: Document;
  readonly clientWidth: number;
  readonly clientHeight: number;
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ): void;
  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions,
  ): void;
  dispatchEvent(event: Event): boolean;
  invoke(event: Event): void;
  setPointerCapture(pointerId: number): void;
  releasePointerCapture(pointerId: number): void;
  hasPointerCapture(pointerId: number): boolean;
  getBoundingClientRect(): DOMRect;
  getRootNode(): Document | EventTarget;
}

export function createOrbitEventGate(canvas: HTMLCanvasElement): OrbitEventGate {
  const listeners = new Map<string, Set<EventListenerOrEventListenerObject>>();
  const documentRef = (): Document => canvas.ownerDocument;

  const invoke = (event: Event): void => {
    const set = listeners.get(event.type);
    if (!set) {
      return;
    }
    for (const listener of [...set]) {
      if (typeof listener === "function") {
        listener.call(gate, event);
      } else {
        listener.handleEvent(event);
      }
    }
  };

  const gate: OrbitEventGate = {
    get style() {
      return canvas.style;
    },
    get ownerDocument() {
      return documentRef();
    },
    get clientWidth() {
      return canvas.clientWidth;
    },
    get clientHeight() {
      return canvas.clientHeight;
    },
    addEventListener(type, listener) {
      const set = listeners.get(type) ?? new Set();
      set.add(listener);
      listeners.set(type, set);
    },
    removeEventListener(type, listener) {
      listeners.get(type)?.delete(listener);
    },
    dispatchEvent(event) {
      invoke(event);
      return true;
    },
    invoke,
    setPointerCapture(pointerId) {
      canvas.setPointerCapture(pointerId);
    },
    releasePointerCapture(pointerId) {
      try {
        if (typeof canvas.hasPointerCapture !== "function" || canvas.hasPointerCapture(pointerId)) {
          canvas.releasePointerCapture(pointerId);
        }
      } catch {
        // Capture APIs are optional in tests and some embeds.
      }
    },
    hasPointerCapture(pointerId) {
      return typeof canvas.hasPointerCapture === "function" ? canvas.hasPointerCapture(pointerId) : false;
    },
    getBoundingClientRect() {
      return canvas.getBoundingClientRect();
    },
    getRootNode() {
      return typeof canvas.getRootNode === "function" ? canvas.getRootNode() : documentRef();
    },
  };

  return gate;
}
