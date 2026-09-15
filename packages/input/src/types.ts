export type ActionId = string;

export type InputContext =
  | "app"
  | "viewport.model"
  | "viewport.uv"
  | "modal.transform"
  | "modal.knife"
  | "focus.text"
  | (string & {});

export type PointerKind = "mouse" | "touch" | "pen";

export type PointerButton = "primary" | "secondary" | "auxiliary" | "back" | "forward";

export interface InputModifiers {
  readonly alt: boolean;
  readonly ctrl: boolean;
  readonly meta: boolean;
  readonly shift: boolean;
}

export interface InputVec2 {
  readonly x: number;
  readonly y: number;
}

export interface PointerPacket {
  readonly kind: "pointerdown" | "pointermove" | "pointerup" | "pointercancel";
  readonly time: number;
  readonly pointerId: number;
  readonly pointerKind: PointerKind;
  readonly isPrimary: boolean;
  readonly button: PointerButton | null;
  readonly buttons: number;
  readonly canvas: InputVec2;
  readonly ndc: InputVec2;
  readonly pressure: number;
  readonly tilt: InputVec2;
  readonly twist: number;
  readonly modifiers: InputModifiers;
}

export interface WheelPacket {
  readonly kind: "wheel";
  readonly time: number;
  readonly canvas: InputVec2;
  readonly ndc: InputVec2;
  readonly deltaX: number;
  readonly deltaY: number;
  readonly deltaZ: number;
  readonly modifiers: InputModifiers;
}

export interface KeyPacket {
  readonly kind: "keydown" | "keyup";
  readonly time: number;
  readonly code: string;
  readonly key: string;
  readonly repeat: boolean;
  readonly modifiers: InputModifiers;
}

export type InputPacket = PointerPacket | WheelPacket | KeyPacket;

export interface ChordBinding {
  readonly keys: readonly string[];
  readonly repeat?: boolean;
}

export interface PointerBinding {
  readonly when: "tap" | "drag";
  readonly kind?: PointerKind | "any";
  readonly button?: PointerButton;
  readonly modifiers?: Partial<InputModifiers>;
}

export interface AxisKeyBinding {
  readonly axis: string;
  readonly positive?: string;
  readonly negative?: string;
}

export interface KeymapEntry {
  readonly action: ActionId;
  readonly contexts: readonly InputContext[];
  readonly chords?: readonly ChordBinding[];
  readonly pointers?: readonly PointerBinding[];
}

export interface GestureFrame {
  readonly action: ActionId;
  readonly pointerId: number;
  readonly pointerKind: PointerKind;
  readonly startCanvas: InputVec2;
  readonly startNdc: InputVec2;
  readonly canvas: InputVec2;
  readonly ndc: InputVec2;
  readonly deltaCanvas: InputVec2;
  readonly deltaNdc: InputVec2;
  readonly pressure: number;
  readonly modifiers: InputModifiers;
}

export interface ActionContext {
  readonly action: ActionId;
  readonly packet: InputPacket;
  readonly ndc?: InputVec2;
  readonly canvas?: InputVec2;
}

export interface GestureHandlers {
  readonly begin: (frame: GestureFrame) => void;
  readonly update: (frame: GestureFrame) => void;
  readonly commit: (frame: GestureFrame) => void;
  readonly cancel: (frame: GestureFrame) => void;
}

export interface DispatchResult {
  readonly consumed: boolean;
  readonly capturePointer?: boolean;
  readonly preventDefault?: boolean;
  readonly action?: ActionId;
}

export interface ButtonState {
  readonly down: boolean;
  readonly pressedThisFrame: boolean;
  readonly releasedThisFrame: boolean;
}

export interface InputAxes {
  readonly moveX: number;
  readonly moveY: number;
  readonly moveZ: number;
  readonly orbitX: number;
  readonly orbitY: number;
  readonly panX: number;
  readonly panY: number;
  readonly zoom: number;
  readonly pressure: number;
}

export function emptyButtonState(): ButtonState {
  return { down: false, pressedThisFrame: false, releasedThisFrame: false };
}

export function emptyAxes(): InputAxes {
  return {
    moveX: 0,
    moveY: 0,
    moveZ: 0,
    orbitX: 0,
    orbitY: 0,
    panX: 0,
    panY: 0,
    zoom: 0,
    pressure: 0,
  };
}

export const EXCLUSIVE_CONTEXTS: readonly InputContext[] = [
  "focus.text",
  "modal.transform",
  "modal.knife",
];

export function emptyModifiers(): InputModifiers {
  return { alt: false, ctrl: false, meta: false, shift: false };
}

export function pointerButtonFromEventButton(button: number): PointerButton | null {
  switch (button) {
    case 0:
      return "primary";
    case 1:
      return "auxiliary";
    case 2:
      return "secondary";
    case 3:
      return "back";
    case 4:
      return "forward";
    default:
      return null;
  }
}
