import { UvUnwrapError } from "../../errors";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

export function rethrowXAtlasError(error: unknown): never {
  if (error instanceof UvUnwrapError) {
    throw error;
  }
  const record = asRecord(error);
  const message = error instanceof Error ? error.message : String(error);
  if (/alloc|memory|out of memory/i.test(message)) {
    throw new UvUnwrapError("wasm-allocation-failed", message);
  }
  if (record && "name" in record && record.name === "RangeError") {
    throw new UvUnwrapError("invalid-indices", message);
  }
  throw new UvUnwrapError("invalid-atlas", message);
}
