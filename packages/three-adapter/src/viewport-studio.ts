import {
  AmbientLight,
  Color,
  DirectionalLight,
  GridHelper,
  HemisphereLight,
  PerspectiveCamera,
  Scene,
} from "three";
import type { CreateThreeViewportOptions } from "./viewport-types";

export function createViewportScene(options: CreateThreeViewportOptions): {
  scene: Scene;
  camera: PerspectiveCamera;
} {
  const scene = new Scene();
  scene.background = new Color(options.background ?? 0x13131c);

  const lightsOn = options.lighting !== "none" && options.lights !== false;
  if (lightsOn) {
    scene.add(new HemisphereLight(0xddeeff, 0x2a2a38, 0.55));
    scene.add(new AmbientLight(0xffffff, 0.2));
    const key = new DirectionalLight(0xffffff, 0.9);
    key.position.set(5, 8, 6);
    const fill = new DirectionalLight(0xb8c8ff, 0.28);
    fill.position.set(-6, 3, 2);
    const rim = new DirectionalLight(0xffe6c8, 0.35);
    rim.position.set(0, 4, -7);
    scene.add(key, fill, rim);
  }

  if (options.grid !== false) {
    scene.add(new GridHelper(16, 16, 0x3d3d54, 0x222230));
  }

  const cam = options.camera ?? {};
  const camera = new PerspectiveCamera(cam.fov ?? 45, 1, cam.near ?? 0.1, cam.far ?? 200);
  const pos = cam.position ?? ([5, 5, 7] as const);
  camera.position.set(pos[0], pos[1], pos[2]);
  camera.lookAt(0, 0, 0);
  return { scene, camera };
}
