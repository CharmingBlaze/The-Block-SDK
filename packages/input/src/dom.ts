import {
  pointerButtonFromEventButton,
  type InputEngine,
  type InputModifiers,
  type PointerKind,
} from "./index";

export interface BindDomOptions {
  readonly engine: InputEngine;
  readonly canvas: HTMLElement;
  readonly keyboardTarget?: EventTarget;
  readonly isTextFocus?: () => boolean;
}

export function bindDom(options: BindDomOptions): () => void {
  const { engine, canvas } = options;
  const keyboardTarget = options.keyboardTarget ?? canvas.ownerDocument.defaultView ?? canvas;
  const isTextFocus = options.isTextFocus ?? defaultIsTextFocus;

  const captureIfRequested = (event: PointerEvent, capturePointer: boolean | undefined): void => {
    if (!capturePointer) {
      return;
    }
    try {
      canvas.setPointerCapture(event.pointerId);
    } catch {
      // Capture is optional in environments without PointerEvent capture.
    }
  };
  const releaseIfCaptured = (pointerId: number): void => {
    try {
      if (canvas.hasPointerCapture(pointerId)) {
        canvas.releasePointerCapture(pointerId);
      }
    } catch {
      // Ignore missing capture APIs / already-released pointers.
    }
  };
  const onPointerDown = (event: PointerEvent): void => {
    const result = engine.dispatch(fromPointer(event, canvas, "pointerdown"));
    captureIfRequested(event, result.capturePointer);
    if (result.preventDefault ?? result.consumed) {
      event.preventDefault();
    }
  };
  const onPointerMove = (event: PointerEvent): void => {
    const result = engine.dispatch(fromPointer(event, canvas, "pointermove"));
    captureIfRequested(event, result.capturePointer);
    if (result.consumed) {
      event.preventDefault();
    }
  };
  const onPointerUp = (event: PointerEvent): void => {
    const result = engine.dispatch(fromPointer(event, canvas, "pointerup"));
    releaseIfCaptured(event.pointerId);
    if (result.consumed) {
      event.preventDefault();
    }
  };
  const onPointerCancel = (event: PointerEvent): void => {
    engine.dispatch(fromPointer(event, canvas, "pointercancel"));
    releaseIfCaptured(event.pointerId);
  };
  const onLostCapture = (event: PointerEvent): void => {
    if (engine.isGesturing) {
      engine.dispatch(fromPointer(event, canvas, "pointercancel"));
    }
  };
  const onWheel = (event: WheelEvent): void => {
    const pos = canvasPoint(event, canvas);
    engine.dispatch({
      kind: "wheel",
      time: event.timeStamp,
      canvas: pos.canvas,
      ndc: pos.ndc,
      deltaX: event.deltaX,
      deltaY: event.deltaY,
      deltaZ: event.deltaZ,
      modifiers: modifiersFromEvent(event),
    });
  };
  const onKeyDown = (event: KeyboardEvent): void => {
    if (isTextFocus()) {
      if (!engine.contexts.includes("focus.text")) {
        engine.pushContext("focus.text");
      }
      return;
    }
    if (engine.contexts.includes("focus.text")) {
      engine.popContext("focus.text");
    }
    const result = engine.dispatch({
      kind: "keydown",
      time: event.timeStamp,
      code: event.code,
      key: event.key,
      repeat: event.repeat,
      modifiers: modifiersFromEvent(event),
    });
    if (result.consumed) {
      event.preventDefault();
    }
  };
  const onKeyUp = (event: KeyboardEvent): void => {
    if (isTextFocus()) {
      return;
    }
    engine.dispatch({
      kind: "keyup",
      time: event.timeStamp,
      code: event.code,
      key: event.key,
      repeat: event.repeat,
      modifiers: modifiersFromEvent(event),
    });
  };
  const onFocusIn = (): void => {
    if (isTextFocus() && !engine.contexts.includes("focus.text")) {
      engine.pushContext("focus.text");
    }
  };
  const onFocusOut = (): void => {
    if (!isTextFocus() && engine.contexts.includes("focus.text")) {
      engine.popContext("focus.text");
    }
  };

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerCancel);
  canvas.addEventListener("lostpointercapture", onLostCapture);
  canvas.addEventListener("wheel", onWheel, { passive: true });
  keyboardTarget.addEventListener("keydown", onKeyDown as EventListener);
  keyboardTarget.addEventListener("keyup", onKeyUp as EventListener);
  canvas.ownerDocument.addEventListener("focusin", onFocusIn);
  canvas.ownerDocument.addEventListener("focusout", onFocusOut);

  return () => {
    canvas.removeEventListener("pointerdown", onPointerDown);
    canvas.removeEventListener("pointermove", onPointerMove);
    canvas.removeEventListener("pointerup", onPointerUp);
    canvas.removeEventListener("pointercancel", onPointerCancel);
    canvas.removeEventListener("lostpointercapture", onLostCapture);
    canvas.removeEventListener("wheel", onWheel);
    keyboardTarget.removeEventListener("keydown", onKeyDown as EventListener);
    keyboardTarget.removeEventListener("keyup", onKeyUp as EventListener);
    canvas.ownerDocument.removeEventListener("focusin", onFocusIn);
    canvas.ownerDocument.removeEventListener("focusout", onFocusOut);
  };
}

function fromPointer(
  event: PointerEvent,
  canvas: HTMLElement,
  kind: "pointerdown" | "pointermove" | "pointerup" | "pointercancel",
) {
  const pos = canvasPoint(event, canvas);
  return {
    kind,
    time: event.timeStamp,
    pointerId: event.pointerId,
    pointerKind: pointerKindFromType(event.pointerType),
    isPrimary: event.isPrimary,
    button: pointerButtonFromEventButton(event.button),
    buttons: event.buttons,
    canvas: pos.canvas,
    ndc: pos.ndc,
    pressure: event.pressure,
    tilt: { x: event.tiltX, y: event.tiltY },
    twist: "twist" in event && typeof event.twist === "number" ? event.twist : 0,
    modifiers: modifiersFromEvent(event),
  };
}

function canvasPoint(event: MouseEvent, canvas: HTMLElement): {
  canvas: { x: number; y: number };
  ndc: { x: number; y: number };
} {
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const width = Math.max(rect.width, 1);
  const height = Math.max(rect.height, 1);
  return {
    canvas: { x, y },
    ndc: { x: (x / width) * 2 - 1, y: -((y / height) * 2 - 1) },
  };
}

function modifiersFromEvent(event: KeyboardEvent | MouseEvent): InputModifiers {
  return {
    alt: event.altKey,
    ctrl: event.ctrlKey,
    meta: event.metaKey,
    shift: event.shiftKey,
  };
}

function pointerKindFromType(type: string): PointerKind {
  if (type === "pen") {
    return "pen";
  }
  if (type === "touch") {
    return "touch";
  }
  return "mouse";
}

function defaultIsTextFocus(): boolean {
  const node = globalThis.document?.activeElement;
  if (!node || !(node instanceof HTMLElement)) {
    return false;
  }
  if (node.isContentEditable) {
    return true;
  }
  const tag = node.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}
