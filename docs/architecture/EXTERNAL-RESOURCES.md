# External resources

The core glTF importer does not call `fetch`, Node `fs`, or browser file APIs. It only reads:

- GLB chunks already in memory
- Data URIs
- Bytes supplied by `ExternalResourceResolver`

## Resolver

```ts
interface ExternalResourceResolver {
  resolve(uri: string, context: ResourceResolveContext): Promise<Uint8Array>;
}
```

Adapters:

| Class | Package entry | Default policy |
| --- | --- | --- |
| `MemoryResourceResolver` | `@modeling-kit/formats` | Map / record lookup only |
| `NodeResourceResolver` | `@modeling-kit/formats/node` | Paths relative to the document and optional `rootDir`; absolute paths off unless `allowAbsolute` |
| `BrowserResourceResolver` | `@modeling-kit/formats/browser` | No network unless `allowNetwork: true` |

## URI policy

Rejected by default: directory traversal (`..` escape), absolute filesystem paths, `file:` URIs, `http(s)` without an explicit network-capable resolver, unknown schemes, NUL bytes.

## Limits

`GltfResourceLimits` caps buffer bytes, image bytes, total bytes, node count, primitive count, and animation keys. Oversized assets throw a structured `SchemaError`.
