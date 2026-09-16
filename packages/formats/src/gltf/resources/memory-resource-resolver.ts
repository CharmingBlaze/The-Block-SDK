import type { ExternalResourceResolver, ResourceResolveContext } from "./resource-resolver";
import { parseDataUri } from "./data-uri";
import { UnsafeUriError } from "./uri-policy";

export class MemoryResourceResolver implements ExternalResourceResolver {
  private readonly resources: Map<string, Uint8Array>;

  constructor(resources: ReadonlyMap<string, Uint8Array> | Record<string, Uint8Array> = {}) {
    this.resources = resources instanceof Map ? new Map(resources) : new Map(Object.entries(resources));
  }

  add(uri: string, bytes: Uint8Array): void {
    this.resources.set(uri, bytes);
  }

  async resolve(uri: string, _context: ResourceResolveContext): Promise<Uint8Array> {
    const data = parseDataUri(uri);
    if (data) {
      return data.bytes;
    }
    const bytes = this.resources.get(uri);
    if (!bytes) {
      throw new UnsafeUriError(`Memory resolver has no resource for '${uri}'`);
    }
    return bytes;
  }
}
