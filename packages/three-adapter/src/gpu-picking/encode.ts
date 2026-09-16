/** Pick ID 0 is background / no hit. Canonical IDs never enter the GPU. */
export const GPU_PICK_BACKGROUND_ID = 0;

/** 24-bit RGB packing. One unique ID per live pick record in a completed pass. */
export const MAX_GPU_PICK_ID = 0xff_ffff;

export interface PickRgb {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

/** Encoding is swappable so a future R32UI path can replace 24-bit RGB. */
export interface PickIdCodec {
  readonly backgroundId: number;
  readonly maxId: number;
  encodeToRgb(pickId: number): PickRgb;
  decodeFromRgb(r: number, g: number, b: number): number;
}

export function encodePickId(pickId: number): PickRgb {
  if (!Number.isInteger(pickId) || pickId < 0 || pickId > MAX_GPU_PICK_ID) {
    throw new RangeError(`Pick ID ${pickId} is outside 0..${MAX_GPU_PICK_ID}`);
  }
  return {
    r: (pickId >> 16) & 0xff,
    g: (pickId >> 8) & 0xff,
    b: pickId & 0xff,
  };
}

export function decodePickId(r: number, g: number, b: number): number {
  const red = clampByte(r);
  const green = clampByte(g);
  const blue = clampByte(b);
  return (red << 16) | (green << 8) | blue;
}

export const rgb24PickIdCodec: PickIdCodec = {
  backgroundId: GPU_PICK_BACKGROUND_ID,
  maxId: MAX_GPU_PICK_ID,
  encodeToRgb: encodePickId,
  decodeFromRgb: decodePickId,
};

export function pickIdToUnitRgb(pickId: number): { readonly r: number; readonly g: number; readonly b: number } {
  const rgb = encodePickId(pickId);
  return {
    r: rgb.r / 255,
    g: rgb.g / 255,
    b: rgb.b / 255,
  };
}

function clampByte(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(255, Math.round(value)));
}
