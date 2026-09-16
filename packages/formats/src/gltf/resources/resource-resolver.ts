export interface ResourceResolveContext {
  readonly documentUri?: string;
  readonly rootDir?: string;
  readonly baseUri?: string;
}

export interface ExternalResourceResolver {
  resolve(uri: string, context: ResourceResolveContext): Promise<Uint8Array>;
}

export interface GltfResourceLimits {
  readonly maxBufferBytes: number;
  readonly maxImageBytes: number;
  readonly maxTotalBytes: number;
  readonly maxNodeCount: number;
  readonly maxPrimitiveCount: number;
  readonly maxAnimationKeys: number;
}

export const DEFAULT_GLTF_RESOURCE_LIMITS: GltfResourceLimits = {
  maxBufferBytes: 256 * 1024 * 1024,
  maxImageBytes: 64 * 1024 * 1024,
  maxTotalBytes: 512 * 1024 * 1024,
  maxNodeCount: 100_000,
  maxPrimitiveCount: 100_000,
  maxAnimationKeys: 1_000_000,
};
