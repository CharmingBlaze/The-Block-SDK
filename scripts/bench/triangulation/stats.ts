export interface SampleStats {
  readonly label: string;
  readonly samplesMs: readonly number[];
  readonly coldMs: number;
  readonly medianMs: number;
  readonly meanMs: number;
  readonly minMs: number;
  readonly maxMs: number;
}

export interface WarmOptions {
  readonly warmup?: number;
  readonly samples?: number;
}

export function median(values: readonly number[]): number {
  if (values.length === 0) {
    throw new RangeError("median requires at least one sample");
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const upper = sorted[mid]!;
  if (sorted.length % 2 === 1) {
    return upper;
  }
  return (sorted[mid - 1]! + upper) / 2;
}

export function mean(values: readonly number[]): number {
  if (values.length === 0) {
    throw new RangeError("mean requires at least one sample");
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function formatMs(ms: number): string {
  if (ms < 10) {
    return `${ms.toFixed(2)} ms`;
  }
  if (ms < 1000) {
    return `${ms.toFixed(1)} ms`;
  }
  return `${(ms / 1000).toFixed(2)} s`;
}

export function formatBytes(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MiB`;
}

/**
 * One discarded warmup, then `samples` timed runs. Returns cold (first timed
 * run after warmup) plus warmed median. `fn` must be side-effect free enough
 * to repeat, or the caller must reset state inside `fn`.
 */
export function warmedMeasure(label: string, fn: () => void, options: WarmOptions = {}): SampleStats {
  const warmup = options.warmup ?? 1;
  const sampleCount = options.samples ?? 5;
  if (sampleCount < 1) {
    throw new RangeError("samples must be >= 1");
  }
  for (let i = 0; i < warmup; i += 1) {
    fn();
  }
  const samplesMs: number[] = [];
  for (let i = 0; i < sampleCount; i += 1) {
    const t0 = performance.now();
    fn();
    samplesMs.push(performance.now() - t0);
  }
  return {
    label,
    samplesMs,
    coldMs: samplesMs[0]!,
    medianMs: median(samplesMs),
    meanMs: mean(samplesMs),
    minMs: Math.min(...samplesMs),
    maxMs: Math.max(...samplesMs),
  };
}
