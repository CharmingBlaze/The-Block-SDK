import { FORMAT_CAPABILITY_MATRIX } from "./matrix";
import type { FormatAspect, FormatAspectCell, FormatCapabilityRow, FormatId } from "./types";

const BY_ID = new Map(FORMAT_CAPABILITY_MATRIX.map((row) => [row.id, row]));

export function formatCapability(id: FormatId): FormatCapabilityRow {
  const row = BY_ID.get(id);
  if (!row) {
    throw new RangeError(`Unknown interchange format '${id}'`);
  }
  return row;
}

export function formatAspectFidelity(id: FormatId, aspect: FormatAspect): FormatAspectCell {
  return formatCapability(id).aspects[aspect];
}
