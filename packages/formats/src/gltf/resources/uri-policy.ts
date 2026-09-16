const ALLOWED_SCHEMES = new Set(["", "data", "file"]);

export interface UriPolicyOptions {
  readonly allowNetwork?: boolean;
  readonly allowAbsolute?: boolean;
  readonly allowFileScheme?: boolean;
}

export class UnsafeUriError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeUriError";
  }
}

export function inspectUri(uri: string): { scheme: string; path: string } {
  const match = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(uri);
  if (match) {
    return { scheme: match[1]!.toLowerCase(), path: uri.slice(match[0].length) };
  }
  return { scheme: "", path: uri };
}

export function assertSafeRelativeUri(uri: string, options: UriPolicyOptions = {}): string {
  const { scheme, path } = inspectUri(uri);
  if (scheme === "data") {
    return uri;
  }
  if (scheme === "http" || scheme === "https") {
    if (!options.allowNetwork) {
      throw new UnsafeUriError(`Network URI '${uri}' is not allowed without an explicit resolver`);
    }
    return uri;
  }
  if (scheme && !ALLOWED_SCHEMES.has(scheme) && scheme !== "http" && scheme !== "https") {
    throw new UnsafeUriError(`Unsupported URI scheme '${scheme}'`);
  }
  if (scheme === "file" && !options.allowFileScheme) {
    throw new UnsafeUriError("file: URIs are not allowed by default");
  }
  const normalized = path.replace(/\\/g, "/");
  if (normalized.includes("\0")) {
    throw new UnsafeUriError("URI contains a NUL byte");
  }
  if (!options.allowAbsolute && (normalized.startsWith("/") || /^[a-zA-Z]:/.test(normalized))) {
    throw new UnsafeUriError(`Absolute path '${uri}' is not allowed`);
  }
  const parts = normalized.split("/");
  let depth = 0;
  for (const part of parts) {
    if (part === "" || part === ".") {
      continue;
    }
    if (part === "..") {
      depth -= 1;
      if (depth < 0) {
        throw new UnsafeUriError(`Directory traversal rejected for '${uri}'`);
      }
      continue;
    }
    depth += 1;
  }
  return uri;
}
