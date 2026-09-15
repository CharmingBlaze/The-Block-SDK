import type { Disposable } from "./lifecycle";

type UrlApi = {
  createObjectURL(obj: Blob): string;
  revokeObjectURL(url: string): void;
};

function urlApi(): UrlApi | undefined {
  const candidate = (globalThis as { URL?: UrlApi }).URL;
  if (candidate && typeof candidate.createObjectURL === "function" && typeof candidate.revokeObjectURL === "function") {
    return candidate;
  }
  return undefined;
}

/**
 * Tracks object URLs so dispose/remount can revoke them (LIFE-002).
 * Hosts that wrap `URL.createObjectURL` should register the result here.
 */
export class ObjectUrlRegistry implements Disposable {
  private readonly urls = new Set<string>();
  private closed = false;

  get disposed(): boolean {
    return this.closed;
  }

  get size(): number {
    return this.urls.size;
  }

  track(url: string): string {
    if (this.closed) {
      throw new Error("ObjectUrlRegistry is disposed");
    }
    this.urls.add(url);
    return url;
  }

  create(blob: Blob): string {
    const api = urlApi();
    if (!api) {
      throw new Error("URL.createObjectURL is not available in this runtime");
    }
    return this.track(api.createObjectURL(blob));
  }

  revoke(url: string): void {
    if (!this.urls.delete(url)) {
      return;
    }
    urlApi()?.revokeObjectURL(url);
  }

  dispose(): void {
    if (this.closed) {
      return;
    }
    this.closed = true;
    const api = urlApi();
    for (const url of this.urls) {
      api?.revokeObjectURL(url);
    }
    this.urls.clear();
  }
}
