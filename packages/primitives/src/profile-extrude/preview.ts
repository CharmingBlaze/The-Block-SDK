import type { HalfEdgeMesh } from "@modeling-kit/mesh";
import type { PrimitiveResult } from "../types";
import { generateProfileExtrude } from "./generate";
import type { ProfileExtrudeParameters } from "./types";

/**
 * Replaces the last generated preview mesh. Callers must dispose any derived
 * Three.js BufferGeometry when `generation` changes. Cancel/dispose drops the
 * kernel reference so it can be collected; no Three.js ownership here.
 */
export class ProfileExtrudePreview {
  private current: PrimitiveResult | null = null;
  private generation = 0;

  get result(): PrimitiveResult | null {
    return this.current;
  }

  get mesh(): HalfEdgeMesh | null {
    return this.current?.mesh ?? null;
  }

  get revision(): number {
    return this.generation;
  }

  update(parameters: ProfileExtrudeParameters): PrimitiveResult {
    const next = generateProfileExtrude(parameters);
    this.current = next;
    this.generation += 1;
    return next;
  }

  clear(): void {
    if (this.current === null) {
      return;
    }
    this.current = null;
    this.generation += 1;
  }

  dispose(): void {
    this.clear();
  }
}
