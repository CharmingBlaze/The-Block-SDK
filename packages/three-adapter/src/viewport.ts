import { MOUSE, Vector3, WebGLRenderer } from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { PointPickRequest, PointPickResult, SelectionIntent } from "@modeling-kit/selection";
import { ThreeViewportAdapter } from "./adapter";
import {
  createKnifeOverlay,
  updateKnifeOverlay,
  type KnifeOverlayState,
} from "./overlays/knife-overlay";
import type { PickResult } from "./picking";
import type { PointerPhase } from "./sub-element";
import { bindViewportPointer } from "./viewport-pointer";
import { createViewportScene } from "./viewport-studio";
import {
  applyViewportPointPick,
  resolvedPickingOptions,
  type CreateThreeViewportOptions,
  type ThreeViewportHandle,
} from "./viewport-types";

export type {
  CreateThreeViewportOptions,
  ThreeViewportCameraOptions,
  ThreeViewportController,
  ThreeViewportHandle,
  ThreeViewportOptions,
  ThreeViewportPickingOptions,
} from "./viewport-types";

/** Zero-config Three.js viewport bound to a headless ModelingSession. */
export function createThreeViewport(options: CreateThreeViewportOptions): ThreeViewportHandle {
  const { scene, camera } = createViewportScene(options);
  const picking = resolvedPickingOptions(options.picking);

  const renderer = new WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  const canvas = renderer.domElement;
  canvas.style.display = "block";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.touchAction = "none";
  options.container.appendChild(canvas);

  const adapter = new ThreeViewportAdapter({
    session: options.session,
    scene,
    camera,
    renderer,
    gpuPicking: picking.gpuPicking === false ? "off" : "webgl",
    ...(options.spatialAcceleration === false ? { spatialAcceleration: false } : {}),
    ...(options.subElement ? { subElement: options.subElement } : {}),
  });
  adapter.mount();

  const pickingEnabled = picking.enabled;
  const pickDomain = options.pickDomain ?? "face";

  let controls: OrbitControls | undefined;
  if (options.orbitControls !== false) {
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = options.damping !== false;
    if (pickingEnabled) {
      controls.mouseButtons = {
        LEFT: -1 as unknown as typeof MOUSE.ROTATE,
        MIDDLE: MOUSE.DOLLY,
        RIGHT: MOUSE.ROTATE,
      };
    }
  }

  const resize = (): void => {
    const width = Math.max(1, options.container.clientWidth || window.innerWidth);
    const height = Math.max(1, options.container.clientHeight || window.innerHeight);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    adapter.resize(width, height, window.devicePixelRatio);
  };
  resize();

  let frame = 0;
  const tick = (): void => {
    frame = requestAnimationFrame(tick);
    controls?.update();
    adapter.updateView();
    renderer.render(scene, camera);
  };
  tick();

  const onWindowResize = (): void => {
    resize();
  };
  let resizeObserver: ResizeObserver | undefined;
  if (options.autoResize !== false) {
    window.addEventListener("resize", onWindowResize);
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => {
        resize();
      });
      resizeObserver.observe(options.container);
    }
  }

  let disposed = false;
  const pointerBinding = bindViewportPointer({
    canvas,
    adapter,
    viewport: options,
    pickingEnabled,
    pickDomain,
    isDisposed: () => disposed,
  });

  const worldPointOf = (hit: PointPickResult | PickResult): { x: number; y: number; z: number } | undefined => {
    if ("kind" in hit) {
      if (hit.kind !== "surface") {
        return undefined;
      }
      return hit.worldPoint;
    }
    return hit.point;
  };

  const toMeshLocal = (hit: PointPickResult | PickResult): [number, number, number] | undefined => {
    const world = worldPointOf(hit);
    if (!world) {
      return undefined;
    }
    const object = adapter.object3D(hit.objectId);
    if (!object) {
      return [world.x, world.y, world.z];
    }
    const local = object.worldToLocal(new Vector3(world.x, world.y, world.z));
    return [local.x, local.y, local.z];
  };

  const knifeOverlay = createKnifeOverlay();
  adapter.root.add(knifeOverlay);

  const attachKnifeOverlay = (): void => {
    const objectId = options.session.selection.objectIds[0];
    const host = objectId ? adapter.object3D(objectId) : undefined;
    const parent = host ?? adapter.root;
    if (knifeOverlay.parent !== parent) {
      parent.add(knifeOverlay);
    }
  };

  return {
    scene,
    camera,
    renderer,
    adapter,
    controls,
    pickFromClient: pointerBinding.pickFromClient,
    resolvePointPick(request: PointPickRequest) {
      return adapter.pickPoint(request);
    },
    applyPointPick(result: PointPickResult | undefined, intent?: SelectionIntent) {
      applyViewportPointPick(options.session, result, intent);
    },
    toMeshLocal,
    setKnifePreview(state: KnifeOverlayState | null): void {
      attachKnifeOverlay();
      updateKnifeOverlay(knifeOverlay, state);
    },
    pointerPhase(): PointerPhase {
      return pointerBinding.pointer.phase;
    },
    dispose(): void {
      if (disposed) {
        return;
      }
      disposed = true;
      pointerBinding.invalidateClicks();
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", onWindowResize);
      resizeObserver?.disconnect();
      pointerBinding.dispose();
      controls?.dispose();
      pointerBinding.pointer.cancel("adapter-dispose");
      adapter.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      knifeOverlay.removeFromParent();
      pointerBinding.pointer.cancel("document-close");
    },
  };
}
