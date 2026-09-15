import type { InputModifiers, KeyPacket, PointerKind, PointerPacket, WheelPacket } from "./types";
import { emptyModifiers } from "./types";

export interface PointerPacketInit {
  readonly kind?: PointerPacket["kind"];
  readonly time?: number;
  readonly pointerId?: number;
  readonly pointerKind?: PointerKind;
  readonly isPrimary?: boolean;
  readonly button?: PointerPacket["button"];
  readonly buttons?: number;
  readonly canvas?: { x: number; y: number };
  readonly ndc?: { x: number; y: number };
  readonly pressure?: number;
  readonly tilt?: { x: number; y: number };
  readonly twist?: number;
  readonly modifiers?: Partial<InputModifiers>;
}

export function pointerPacket(init: PointerPacketInit = {}): PointerPacket {
  const kind = init.kind ?? "pointermove";
  const canvas = init.canvas ?? { x: 0, y: 0 };
  return {
    kind,
    time: init.time ?? 0,
    pointerId: init.pointerId ?? 1,
    pointerKind: init.pointerKind ?? "mouse",
    isPrimary: init.isPrimary ?? true,
    button: init.button ?? (kind === "pointermove" ? null : "primary"),
    buttons: init.buttons ?? (kind === "pointerup" || kind === "pointercancel" ? 0 : 1),
    canvas,
    ndc: init.ndc ?? { x: 0, y: 0 },
    pressure: init.pressure ?? 1,
    tilt: init.tilt ?? { x: 0, y: 0 },
    twist: init.twist ?? 0,
    modifiers: { ...emptyModifiers(), ...init.modifiers },
  };
}

export function keyPacket(init: {
  readonly kind: KeyPacket["kind"];
  readonly code: string;
  readonly time?: number;
  readonly key?: string;
  readonly repeat?: boolean;
  readonly modifiers?: Partial<InputModifiers>;
}): KeyPacket {
  return {
    kind: init.kind,
    time: init.time ?? 0,
    code: init.code,
    key: init.key ?? init.code,
    repeat: init.repeat ?? false,
    modifiers: { ...emptyModifiers(), ...init.modifiers },
  };
}

export function wheelPacket(
  init: Partial<Omit<WheelPacket, "kind" | "modifiers">> & {
    readonly modifiers?: Partial<InputModifiers>;
  } = {},
): WheelPacket {
  return {
    kind: "wheel",
    time: init.time ?? 0,
    canvas: init.canvas ?? { x: 0, y: 0 },
    ndc: init.ndc ?? { x: 0, y: 0 },
    deltaX: init.deltaX ?? 0,
    deltaY: init.deltaY ?? 0,
    deltaZ: init.deltaZ ?? 0,
    modifiers: { ...emptyModifiers(), ...init.modifiers },
  };
}
