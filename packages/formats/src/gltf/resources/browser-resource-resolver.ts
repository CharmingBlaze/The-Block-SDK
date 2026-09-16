import type { ExternalResourceResolver, ResourceResolveContext } from "./resource-resolver";
import { parseDataUri } from "./data-uri";
import { assertSafeRelativeUri, UnsafeUriError } from "./uri-policy";

export interface BrowserResourceResolverOptions {
  /** When true, http(s) URIs are fetched. Default false. */
  readonly allowNetwork?: boolean;
}

/**
 * Browser resolver. Does not fetch unless the caller opts into network access.
 */
export class BrowserResourceResolver implements ExternalResourceResolver {
  constructor(private readonly options: BrowserResourceResolverOptions = {}) {}

  async resolve(uri: string, _context: ResourceResolveContext): Promise<Uint8Array> {
    const data = parseDataUri(uri);
    if (data) {
      return data.bytes;
    }
    const safe = assertSafeRelativeUri(uri, { allowNetwork: this.options.allowNetwork === true });
    if (!this.options.allowNetwork) {
      throw new UnsafeUriError("Browser imports do not fetch unless allowNetwork is enabled");
    }
    const response = await fetch(safe);
    if (!response.ok) {
      throw new Error(`Failed to fetch '${safe}': ${response.status}`);
    }
    return new Uint8Array(await response.arrayBuffer());
  }
}
