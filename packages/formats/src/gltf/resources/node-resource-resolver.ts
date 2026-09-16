import { join, normalize, resolve, sep } from "node:path";
import { readFile } from "node:fs/promises";
import type { ExternalResourceResolver, ResourceResolveContext } from "./resource-resolver";
import { parseDataUri } from "./data-uri";
import { assertSafeRelativeUri, UnsafeUriError } from "./uri-policy";

export interface NodeResourceResolverOptions {
  readonly rootDir?: string;
  readonly allowAbsolute?: boolean;
}

/**
 * Resolves URIs relative to the source document and an optional configured root.
 * Absolute filesystem paths are rejected unless `allowAbsolute` is set.
 */
export class NodeResourceResolver implements ExternalResourceResolver {
  constructor(private readonly options: NodeResourceResolverOptions = {}) {}

  async resolve(uri: string, context: ResourceResolveContext): Promise<Uint8Array> {
    const data = parseDataUri(uri);
    if (data) {
      return data.bytes;
    }
    const safe = assertSafeRelativeUri(uri, { allowAbsolute: this.options.allowAbsolute === true });
    const base = context.baseUri ?? context.documentUri ?? "";
    const root = this.options.rootDir ?? context.rootDir;
    const baseDir = base.includes("/") || base.includes("\\") ? base.replace(/[\\/][^\\/]*$/, "") : ".";
    const candidate = join(baseDir, safe);
    const resolved = resolve(candidate);
    if (root) {
      const rootResolved = resolve(root);
      if (resolved !== rootResolved && !resolved.startsWith(rootResolved + sep)) {
        throw new UnsafeUriError(`Resolved path '${resolved}' escapes configured root '${rootResolved}'`);
      }
    }
    return new Uint8Array(await readFile(normalize(resolved)));
  }
}
