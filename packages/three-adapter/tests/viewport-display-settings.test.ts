import { createSequenceIdFactory } from "@modeling-kit/core";
import { CreatePrimitiveCommand, createModelingSession } from "@modeling-kit/commands";
import { describe, expect, it, vi } from "vitest";
import { Mesh, MeshStandardMaterial, PerspectiveCamera, Scene, BoxGeometry, type WebGLRenderer } from "three";
import { ThreeViewportAdapter } from "../src/adapter";
import { ViewportDisplayController } from "../src/viewport-display-controller";
import {
  DEFAULT_VIEWPORT_RENDER_SETTINGS,
  ViewportRenderState,
  modeSupportsShadows,
  shadowMapSizeForQuality,
} from "../src/viewport-display-settings";

function fakeRenderer() {
  const updates: boolean[] = [];
  const renderer = {
    outputColorSpace: "",
    toneMapping: 0,
    toneMappingExposure: 1,
    shadowMap: { enabled: false, type: 0, autoUpdate: true, needsUpdate: false },
    render: vi.fn(function (this: { shadowMap: { needsUpdate: boolean } }) {
      updates.push(this.shadowMap.needsUpdate);
    }),
  } as unknown as WebGLRenderer;
  return { renderer, updates };
}

describe("viewport render settings", () => {
  it("uses lightweight modeling defaults and the specified shadow resolutions", () => {
    expect(DEFAULT_VIEWPORT_RENDER_SETTINGS).toMatchObject({
      mode: "solid",
      shadows: "medium",
      showGround: true,
      showTriangulation: false,
      flatShading: true,
    });
    expect(shadowMapSizeForQuality("off")).toBe(0);
    expect(shadowMapSizeForQuality("low")).toBe(512);
    expect(shadowMapSizeForQuality("medium")).toBe(1024);
    expect(shadowMapSizeForQuality("high")).toBe(2048);
  });

  it("switches all modes without losing shared settings", () => {
    const state = new ViewportRenderState({ shadows: "high", textureFiltering: "linear" });
    for (const mode of ["solid", "material", "textured", "unlit", "wireframe", "shaded-wireframe", "normals", "uv-checker", "game-preview"] as const) {
      state.setRenderMode(mode);
      expect(state.settings.mode).toBe(mode);
      expect(state.settings.shadows).toBe("high");
    }
  });

  it("disables shadows in unlit, wireframe, normals, and uv-checker", () => {
    for (const mode of ["unlit", "wireframe", "normals", "uv-checker"] as const) {
      expect(modeSupportsShadows(mode)).toBe(false);
      expect(new ViewportRenderState({ mode, shadows: "high" }).shadowsEnabled()).toBe(false);
    }
    expect(new ViewportRenderState({ mode: "game-preview", shadows: "medium" }).shadowsEnabled()).toBe(true);
    expect(new ViewportRenderState({ mode: "solid", shadows: "off" }).shadowsEnabled()).toBe(false);
  });

  it("keeps multiple viewport states independent and resizable", () => {
    const left = new ViewportRenderState({ mode: "solid" });
    const right = new ViewportRenderState({ mode: "uv-checker" });
    left.resize(640, 480, 2);
    right.resize(320, 720, 1);
    expect(left.size).toEqual({ width: 640, height: 480, pixelRatio: 2 });
    expect(right.size).toEqual({ width: 320, height: 720, pixelRatio: 1 });
    expect(left.settings.mode).not.toBe(right.settings.mode);
  });

  it("reuses cached mode materials and invalidates a static shadow map only when dirty", () => {
    const { renderer, updates } = fakeRenderer();
    const scene = new Scene();
    const camera = new PerspectiveCamera();
    const root = new Mesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial({ color: 0xff0000 }));
    scene.add(root);
    const controller = new ViewportDisplayController({ renderer, scene, camera, presentationRoot: root });
    controller.render();
    const cacheCount = controller.cachedMaterialCount;
    controller.render();
    expect(controller.cachedMaterialCount).toBe(cacheCount);
    expect(updates).toEqual([true, false]);
    controller.invalidateShadows();
    controller.render();
    expect(updates.at(-1)).toBe(true);
    controller.setRenderMode("material");
    controller.render();
    expect(controller.cachedMaterialCount).toBeGreaterThan(cacheCount);
    controller.dispose();
    expect(() => controller.setRenderMode("solid")).toThrow(/disposed/);
  });

  it("builds canonical cube topology edges without triangle diagonals", () => {
    const session = createModelingSession(createSequenceIdFactory("topology"));
    session.execute(new CreatePrimitiveCommand("cube", { width: 2, height: 2, depth: 2 }));
    const camera = new PerspectiveCamera(50, 1, 0.1, 100);
    const adapter = new ThreeViewportAdapter({
      session,
      scene: new Scene(),
      camera,
      renderer: { setSize: () => undefined, setPixelRatio: () => undefined },
      subElement: { display: { editMode: true, showEdges: true } },
    });
    adapter.mount();
    const edgeOverlay = adapter.root.getObjectByProperty("name", "edge-overlay");
    expect(edgeOverlay?.userData.segmentCount).toBe(12);
    adapter.dispose();
  });

  it("disposes render state idempotently", () => {
    const state = new ViewportRenderState();
    state.dispose();
    state.dispose();
    expect(() => state.update({ mode: "material" })).toThrow(/disposed/);
  });
});
