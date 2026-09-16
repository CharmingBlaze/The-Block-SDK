import { SchemaError } from "@modeling-kit/core";

const COMPONENT_BYTES: Record<number, number> = {
  5120: 1,
  5121: 1,
  5122: 2,
  5123: 2,
  5125: 4,
  5126: 4,
};

const TYPE_ELEMENTS: Record<string, number> = {
  SCALAR: 1,
  VEC2: 2,
  VEC3: 3,
  VEC4: 4,
  MAT2: 4,
  MAT3: 9,
  MAT4: 16,
};

export function assertJsonAccessorBounds(json: Record<string, unknown>): void {
  const accessors = Array.isArray(json.accessors) ? json.accessors : [];
  const views = Array.isArray(json.bufferViews) ? json.bufferViews : [];
  for (const accessor of accessors) {
    if (!accessor || typeof accessor !== "object") {
      continue;
    }
    const record = accessor as {
      bufferView?: number;
      byteOffset?: number;
      componentType?: number;
      count?: number;
      type?: string;
    };
    const view = views[record.bufferView ?? -1];
    if (!view || typeof view !== "object") {
      throw new SchemaError("glTF accessor is missing a valid buffer view");
    }
    const viewRecord = view as { byteLength?: number };
    const componentBytes = COMPONENT_BYTES[record.componentType ?? 0] ?? 0;
    const elements = TYPE_ELEMENTS[record.type ?? ""] ?? 0;
    const required = (record.byteOffset ?? 0) + componentBytes * elements * (record.count ?? 0);
    if (required > (viewRecord.byteLength ?? 0)) {
      throw new SchemaError("glTF accessor extends past the end of its buffer");
    }
  }
}
