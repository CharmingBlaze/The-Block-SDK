import { SchemaError } from "@modeling-kit/core";

/** Little-endian `glTF` */
export const GLB_MAGIC = 0x46546c67;
export const GLB_VERSION = 2;
/** Little-endian `JSON` */
export const GLB_CHUNK_JSON = 0x4e4f534a;
/** Little-endian `BIN\0` */
export const GLB_CHUNK_BIN = 0x004e4942;

export interface ParsedGlb {
  readonly json: Record<string, unknown>;
  readonly bin?: Uint8Array;
}

export function isGlb(bytes: Uint8Array): boolean {
  if (bytes.byteLength < 12) {
    return false;
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return view.getUint32(0, true) === GLB_MAGIC;
}

/**
 * Encodes glTF JSON plus an optional BIN payload per the Khronos GLB 2.0 layout.
 * JSON chunk padding is 0x20; BIN chunk padding is 0x00.
 */
export function encodeGlb(json: Record<string, unknown>, binary: Uint8Array): Uint8Array {
  const jsonBytes = new TextEncoder().encode(JSON.stringify(json));
  const jsonPadding = padding4(jsonBytes.byteLength);
  const jsonChunkLength = jsonBytes.byteLength + jsonPadding;
  const includeBin = binary.byteLength > 0;
  const binPadding = includeBin ? padding4(binary.byteLength) : 0;
  const binChunkLength = includeBin ? binary.byteLength + binPadding : 0;
  const totalLength = 12 + 8 + jsonChunkLength + (includeBin ? 8 + binChunkLength : 0);
  const out = new Uint8Array(totalLength);
  const view = new DataView(out.buffer);
  view.setUint32(0, GLB_MAGIC, true);
  view.setUint32(4, GLB_VERSION, true);
  view.setUint32(8, totalLength, true);
  view.setUint32(12, jsonChunkLength, true);
  view.setUint32(16, GLB_CHUNK_JSON, true);
  out.set(jsonBytes, 20);
  out.fill(0x20, 20 + jsonBytes.byteLength, 20 + jsonChunkLength);
  if (includeBin) {
    const binHeader = 20 + jsonChunkLength;
    view.setUint32(binHeader, binChunkLength, true);
    view.setUint32(binHeader + 4, GLB_CHUNK_BIN, true);
    out.set(binary, binHeader + 8);
  }
  return out;
}

export function parseGlb(bytes: Uint8Array): ParsedGlb {
  if (bytes.byteLength < 12) {
    throw new SchemaError("GLB file is truncated");
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0, true) !== GLB_MAGIC) {
    throw new SchemaError("GLB magic must be glTF");
  }
  const version = view.getUint32(4, true);
  if (version !== GLB_VERSION) {
    throw new SchemaError(`GLB version must be 2, got ${version}`);
  }
  const declaredLength = view.getUint32(8, true);
  if (declaredLength > bytes.byteLength) {
    throw new SchemaError("GLB declared length exceeds the buffer");
  }
  let offset = 12;
  let json: Record<string, unknown> | undefined;
  let bin: Uint8Array | undefined;
  while (offset + 8 <= declaredLength) {
    const chunkLength = view.getUint32(offset, true);
    const chunkType = view.getUint32(offset + 4, true);
    const dataStart = offset + 8;
    const dataEnd = dataStart + chunkLength;
    if (dataEnd > declaredLength) {
      throw new SchemaError("GLB chunk overruns the declared file length");
    }
    const data = bytes.subarray(dataStart, dataEnd);
    if (chunkType === GLB_CHUNK_JSON) {
      json = parseJsonObject(new TextDecoder().decode(data));
    } else if (chunkType === GLB_CHUNK_BIN) {
      bin = data;
    }
    offset = dataEnd;
  }
  if (!json) {
    throw new SchemaError("GLB is missing a JSON chunk");
  }
  return bin ? { json, bin } : { json };
}

function padding4(byteLength: number): number {
  return (4 - (byteLength % 4)) % 4;
}

function parseJsonObject(text: string): Record<string, unknown> {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    throw new SchemaError(`GLB JSON chunk is malformed: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new SchemaError("GLB JSON chunk must be an object");
  }
  return raw as Record<string, unknown>;
}
