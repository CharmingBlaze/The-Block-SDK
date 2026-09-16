import type { JSONDocument } from "@gltf-transform/core";
import { parseDataUri } from "./data-uri";
import type { ExternalResourceResolver, ResourceResolveContext } from "./resource-resolver";
import { assertSafeRelativeUri } from "./uri-policy";

export function collectExternalUris(json: Record<string, unknown>): string[] {
  const uris: string[] = [];
  const buffers = Array.isArray(json.buffers) ? json.buffers : [];
  const images = Array.isArray(json.images) ? json.images : [];
  for (const item of [...buffers, ...images]) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const uri = (item as { uri?: unknown }).uri;
    if (typeof uri === "string" && uri && !uri.startsWith("data:")) {
      uris.push(uri);
    }
  }
  return [...new Set(uris)];
}

export async function resolveJsonResources(
  json: Record<string, unknown>,
  resolver: ExternalResourceResolver | undefined,
  context: ResourceResolveContext,
  existing: Record<string, Uint8Array> = {},
): Promise<JSONDocument> {
  const resources: Record<string, Uint8Array> = { ...existing };
  for (const uri of collectExternalUris(json)) {
    if (resources[uri]) {
      continue;
    }
    const data = parseDataUri(uri);
    if (data) {
      resources[uri] = data.bytes;
      continue;
    }
    if (!resolver) {
      throw new Error(`External glTF resource '${uri}' requires a resourceResolver`);
    }
    assertSafeRelativeUri(uri);
    resources[uri] = await resolver.resolve(uri, context);
  }
  return {
    json: json as unknown as JSONDocument["json"],
    resources: resources as Record<string, Uint8Array<ArrayBuffer>>,
  };
}
