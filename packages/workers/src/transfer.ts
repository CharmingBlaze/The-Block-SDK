/** Collects ArrayBuffers from worker results so they can be transferred, not copied, back to the host. */
export function collectTransferables(value: unknown): ArrayBuffer[] {
  const buffers: ArrayBuffer[] = [];
  const seenObjects = new Set<object>();
  const seenBuffers = new Set<ArrayBuffer>();

  const visit = (current: unknown): void => {
    if (!current || typeof current !== "object") {
      return;
    }
    if (seenObjects.has(current)) {
      return;
    }
    seenObjects.add(current);
    if (current instanceof ArrayBuffer) {
      addBuffer(current);
      return;
    }
    if (ArrayBuffer.isView(current)) {
      addBuffer(current.buffer);
      return;
    }
    if (Array.isArray(current)) {
      for (const item of current) {
        visit(item);
      }
      return;
    }
    for (const item of Object.values(current)) {
      visit(item);
    }
  };

  const addBuffer = (buffer: ArrayBufferLike): void => {
    if (!(buffer instanceof ArrayBuffer) || seenBuffers.has(buffer)) {
      return;
    }
    seenBuffers.add(buffer);
    buffers.push(buffer);
  };

  visit(value);
  return buffers;
}
