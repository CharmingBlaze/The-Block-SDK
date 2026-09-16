import type { UvUnwrapBackend, UvUnwrapBackendInput, UvUnwrapBackendResult } from "../../src/unwrap";

export class MockUnwrapBackend implements UvUnwrapBackend {
  constructor(
    private readonly impl: (
      input: UvUnwrapBackendInput,
    ) => UvUnwrapBackendResult | Promise<UvUnwrapBackendResult>,
  ) {}

  initialize(): Promise<void> {
    return Promise.resolve();
  }

  unwrap(input: UvUnwrapBackendInput): Promise<UvUnwrapBackendResult> {
    return Promise.resolve(this.impl(input));
  }

  dispose(): void {}
}

export function identityAtlas(input: UvUnwrapBackendInput, uvs?: Float32Array): UvUnwrapBackendResult {
  const vertexCount = input.positions.length / 3;
  const xref = new Uint32Array(vertexCount);
  for (let i = 0; i < vertexCount; i += 1) {
    xref[i] = i;
  }
  const packed = uvs ?? new Float32Array(vertexCount * 2);
  if (!uvs) {
    for (let i = 0; i < vertexCount; i += 1) {
      packed[i * 2] = 0.25;
      packed[i * 2 + 1] = 0.75;
    }
  }
  return {
    atlasWidth: 256,
    atlasHeight: 256,
    chartCount: 1,
    triangleCount: input.indices.length / 3,
    vertexCount,
    indices: new Uint32Array(input.indices),
    uvs: packed,
    xref,
  };
}
