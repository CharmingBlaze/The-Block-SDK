import { PlatformIO } from "@gltf-transform/core";
import {
  EXTTextureWebP,
  KHRLightsPunctual,
  KHRMaterialsEmissiveStrength,
  KHRMaterialsUnlit,
  KHRNodeVisibility,
  KHRTextureTransform,
} from "@gltf-transform/extensions";

/**
 * In-memory glTF Transform I/O. Does not call fetch or Node fs.
 * External URIs must already be present on the JSONDocument resource map.
 */
export class MemoryPlatformIO extends PlatformIO {
  protected async readURI(uri: string, type: "view"): Promise<Uint8Array<ArrayBuffer>>;
  protected async readURI(uri: string, type: "text"): Promise<string>;
  protected async readURI(uri: string, _type: "view" | "text"): Promise<Uint8Array<ArrayBuffer> | string> {
    throw new Error(`External glTF resource '${uri}' was not resolved before Transform I/O`);
  }

  protected resolve(base: string, path: string): string {
    if (!path || /:/.test(path) || path.startsWith("/")) {
      return path;
    }
    const dir = this.dirname(base);
    const joined = dir ? `${dir}/${path}` : path;
    return joined.replace(/\/{2,}/g, "/");
  }

  protected dirname(uri: string): string {
    const normalized = uri.replace(/\\/g, "/");
    const index = normalized.lastIndexOf("/");
    return index >= 0 ? normalized.slice(0, index) : "";
  }
}

export function createGltfTransformIO(): MemoryPlatformIO {
  const io = new MemoryPlatformIO();
  io.registerExtensions([
    KHRMaterialsUnlit,
    KHRMaterialsEmissiveStrength,
    KHRTextureTransform,
    KHRLightsPunctual,
    KHRNodeVisibility,
    EXTTextureWebP,
  ]);
  return io;
}
