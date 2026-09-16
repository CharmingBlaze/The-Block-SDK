import {
  Color,
  ColorManagement,
  LinearSRGBColorSpace,
  NearestFilter,
  NoToneMapping,
  UnsignedByteType,
  Vector4,
  WebGLRenderTarget,
  type Camera,
  type Scene,
  type WebGLRenderer,
} from "three";
import { applyPickViewOffset, restoreViewOffset } from "./camera-view-offset";
import { decodePickId } from "./encode";
import type { GpuPickRequest } from "./types";

const pixel = new Uint8Array(4);
const viewportBox = new Vector4();
const scissorBox = new Vector4();
const clearColor = new Color();

export class WebGLPickReadback {
  private target: WebGLRenderTarget | undefined;
  contextLost = false;
  lastReadError: string | undefined;

  constructor(private readonly renderer: WebGLRenderer) {
    this.renderer.domElement.addEventListener("webglcontextlost", this.onContextLost);
  }

  read(camera: Camera, scene: Scene, request: GpuPickRequest): number | undefined {
    this.ensureTarget();
    const target = this.target;
    if (!target || this.contextLost) {
      return undefined;
    }

    const renderer = this.renderer;
    const previousTarget = renderer.getRenderTarget();
    const previousOutput = renderer.outputColorSpace;
    const previousTone = renderer.toneMapping;
    const previousAutoClear = renderer.autoClear;
    const previousClearAlpha = renderer.getClearAlpha();
    const previousColorManagement = ColorManagement.enabled;
    renderer.getClearColor(clearColor);
    renderer.getViewport(viewportBox);
    renderer.getScissor(scissorBox);
    const previousScissorTest = renderer.getScissorTest();
    let previousView: ReturnType<typeof applyPickViewOffset> | undefined;

    try {
      ColorManagement.enabled = false;
      previousView = applyPickViewOffset(
        camera,
        request.viewportWidth,
        request.viewportHeight,
        request.pixelX,
        request.pixelY,
      );
      renderer.setRenderTarget(target);
      renderer.outputColorSpace = LinearSRGBColorSpace;
      renderer.toneMapping = NoToneMapping;
      renderer.autoClear = true;
      renderer.setClearColor(0x000000, 0);
      renderer.setViewport(0, 0, 1, 1);
      renderer.setScissorTest(false);
      renderer.clear();
      renderer.render(scene, camera);
      renderer.readRenderTargetPixels(target, 0, 0, 1, 1, pixel);
      this.lastReadError = undefined;
      return decodePickId(pixel[0] ?? 0, pixel[1] ?? 0, pixel[2] ?? 0);
    } catch (error) {
      this.lastReadError = error instanceof Error ? error.message : String(error);
      return undefined;
    } finally {
      ColorManagement.enabled = previousColorManagement;
      if (previousView !== undefined) {
        restoreViewOffset(camera, previousView);
      }
      renderer.setRenderTarget(previousTarget);
      renderer.outputColorSpace = previousOutput;
      renderer.toneMapping = previousTone;
      renderer.autoClear = previousAutoClear;
      renderer.setClearColor(clearColor, previousClearAlpha);
      renderer.setViewport(viewportBox);
      renderer.setScissor(scissorBox);
      renderer.setScissorTest(previousScissorTest);
    }
  }

  dispose(): void {
    this.renderer.domElement.removeEventListener("webglcontextlost", this.onContextLost);
    this.target?.dispose();
    this.target = undefined;
  }

  private markLost(): void {
    this.contextLost = true;
    this.target?.dispose();
    this.target = undefined;
  }

  private onContextLost = (event: Event): void => {
    event.preventDefault();
    this.markLost();
  };

  private ensureTarget(): void {
    if (this.target) {
      return;
    }
    this.target = new WebGLRenderTarget(1, 1, {
      minFilter: NearestFilter,
      magFilter: NearestFilter,
      generateMipmaps: false,
      depthBuffer: true,
      stencilBuffer: false,
      type: UnsignedByteType,
      colorSpace: LinearSRGBColorSpace,
    });
  }
}
