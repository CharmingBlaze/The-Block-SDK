import {
  Color,
  GridHelper,
  PerspectiveCamera,
  Scene,
} from "three";
import type { CreateThreeViewportOptions } from "./viewport-types";

export function createViewportScene(options: CreateThreeViewportOptions): {
  scene: Scene;
  camera: PerspectiveCamera;
  grid: GridHelper | undefined;
} {
  const scene = new Scene();
  scene.background = new Color(options.background ?? 0x13131c);

  const grid = options.grid === false ? undefined : new GridHelper(16, 16, 0x3d3d54, 0x222230);
  if (grid) {
    grid.name = "modeling-kit-viewport-grid";
    grid.userData.isViewportPresentation = true;
    scene.add(grid);
  }

  const cam = options.camera ?? {};
  const camera = new PerspectiveCamera(cam.fov ?? 45, 1, cam.near ?? 0.1, cam.far ?? 200);
  const pos = cam.position ?? ([5, 5, 7] as const);
  camera.position.set(pos[0], pos[1], pos[2]);
  camera.lookAt(0, 0, 0);
  return { scene, camera, grid };
}
