export interface UvUnwrapBackendInput {
  readonly positions: Float32Array;
  readonly indices: Uint32Array;
  readonly inputUvs?: Float32Array;
}

export interface UvUnwrapBackendOptions {
  readonly maxChartArea?: number;
  readonly maxBoundaryLength?: number;
  readonly resolution?: number;
  readonly padding?: number;
  readonly rotateCharts?: boolean;
  readonly blockAlign?: boolean;
  readonly bilinearPadding?: boolean;
  readonly useInputMeshUvs?: boolean;
}

export interface UvUnwrapBackendResult {
  readonly atlasWidth: number;
  readonly atlasHeight: number;
  readonly chartCount: number;
  readonly triangleCount: number;
  readonly vertexCount: number;
  readonly indices: Uint32Array;
  readonly uvs: Float32Array;
  readonly xref: Uint32Array;
}

export interface UvUnwrapBackend {
  initialize(): Promise<void>;
  unwrap(
    input: UvUnwrapBackendInput,
    options: UvUnwrapBackendOptions,
    signal?: AbortSignal,
  ): Promise<UvUnwrapBackendResult>;
  packUvMesh?(
    input: UvUnwrapBackendInput,
    options: UvUnwrapBackendOptions,
    signal?: AbortSignal,
  ): Promise<UvUnwrapBackendResult>;
  dispose(): void;
}
