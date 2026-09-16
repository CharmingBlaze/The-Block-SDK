export interface HeapSample {
  readonly rss: number;
  readonly heapTotal: number;
  readonly heapUsed: number;
  readonly external: number;
  readonly gcExposed: boolean;
}

export function gcIfAvailable(): boolean {
  const gc = (globalThis as { gc?: () => void }).gc;
  if (typeof gc !== "function") {
    return false;
  }
  gc();
  gc();
  return true;
}

export function readHeap(): HeapSample {
  const usage = process.memoryUsage();
  return {
    rss: usage.rss,
    heapTotal: usage.heapTotal,
    heapUsed: usage.heapUsed,
    external: usage.external,
    gcExposed: typeof (globalThis as { gc?: () => void }).gc === "function",
  };
}

export function deltaHeapUsed(before: HeapSample, after: HeapSample): number {
  return after.heapUsed - before.heapUsed;
}
