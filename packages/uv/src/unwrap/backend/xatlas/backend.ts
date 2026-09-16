import { throwIfAborted, UvUnwrapError } from "../../errors";
import type { UvUnwrapBackend, UvUnwrapBackendInput, UvUnwrapBackendOptions, UvUnwrapBackendResult } from "../../types";
import { withAtlas } from "./atlas";
import { rethrowXAtlasError } from "./errors";
import { addPositionMesh, addUvMesh, assertXAtlasInput } from "./input";
import { loadWatlas, type WatlasModule } from "./load";
import { toChartOptions, toPackOptions } from "./options";
import { readAtlasResult } from "./result";

export class XAtlasUnwrapBackend implements UvUnwrapBackend {
  private watlas: WatlasModule | null = null;
  private init: Promise<void> | null = null;
  private disposed = false;

  async initialize(): Promise<void> {
    if (this.disposed) {
      throw new UvUnwrapError("disposed", "XAtlasUnwrapBackend has been disposed");
    }
    if (this.watlas) {
      return;
    }
    if (!this.init) {
      this.init = this.load();
    }
    try {
      await this.init;
    } catch (error) {
      this.init = null;
      if (error instanceof UvUnwrapError) {
        throw error;
      }
      throw new UvUnwrapError(
        "backend-init-failed",
        error instanceof Error ? error.message : "watlas failed to initialize",
      );
    }
  }

  async unwrap(
    input: UvUnwrapBackendInput,
    options: UvUnwrapBackendOptions,
    signal?: AbortSignal,
  ): Promise<UvUnwrapBackendResult> {
    await this.initialize();
    throwIfAborted(signal);
    assertXAtlasInput(input);
    const watlas = this.requireWatlas();
    try {
      return withAtlas(watlas, (atlas) => {
        throwIfAborted(signal);
        addPositionMesh(atlas, input, options);
        throwIfAborted(signal);
        atlas.generate(toChartOptions(options), toPackOptions(options));
        throwIfAborted(signal);
        return readAtlasResult(atlas, input.indices.length);
      });
    } catch (error) {
      rethrowXAtlasError(error);
    }
  }

  async packUvMesh(
    input: UvUnwrapBackendInput,
    options: UvUnwrapBackendOptions,
    signal?: AbortSignal,
  ): Promise<UvUnwrapBackendResult> {
    await this.initialize();
    throwIfAborted(signal);
    const watlas = this.requireWatlas();
    try {
      return withAtlas(watlas, (atlas) => {
        addUvMesh(atlas, input);
        throwIfAborted(signal);
        atlas.packCharts(toPackOptions(options));
        throwIfAborted(signal);
        return readAtlasResult(atlas, input.indices.length);
      });
    } catch (error) {
      rethrowXAtlasError(error);
    }
  }

  dispose(): void {
    this.disposed = true;
    this.watlas = null;
    this.init = null;
  }

  private async load(): Promise<void> {
    const watlas = await loadWatlas();
    if (this.disposed) {
      throw new UvUnwrapError("disposed", "XAtlasUnwrapBackend was disposed during initialization");
    }
    this.watlas = watlas;
  }

  private requireWatlas(): WatlasModule {
    if (this.disposed) {
      throw new UvUnwrapError("disposed", "XAtlasUnwrapBackend has been disposed");
    }
    if (!this.watlas) {
      throw new UvUnwrapError("backend-init-failed", "watlas is not initialized");
    }
    return this.watlas;
  }
}
