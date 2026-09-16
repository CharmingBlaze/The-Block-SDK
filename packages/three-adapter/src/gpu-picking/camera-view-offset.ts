import type { Camera } from "three";

export interface ViewOffsetState {
  readonly fullWidth: number;
  readonly fullHeight: number;
  readonly offsetX: number;
  readonly offsetY: number;
  readonly width: number;
  readonly height: number;
}

export type CameraWithViewOffset = Camera & {
  setViewOffset: (
    fullWidth: number,
    fullHeight: number,
    x: number,
    y: number,
    width: number,
    height: number,
  ) => void;
  clearViewOffset: () => void;
  updateProjectionMatrix: () => void;
};

export function cameraViewOffset(camera: Camera): ViewOffsetState | null {
  const view = (camera as Camera & { view?: ViewOffsetState | null }).view;
  if (!view) {
    return null;
  }
  return {
    fullWidth: view.fullWidth,
    fullHeight: view.fullHeight,
    offsetX: view.offsetX,
    offsetY: view.offsetY,
    width: view.width,
    height: view.height,
  };
}

export function hasViewOffsetApi(camera: Camera): camera is CameraWithViewOffset {
  return (
    typeof (camera as { setViewOffset?: unknown }).setViewOffset === "function" &&
    typeof (camera as { clearViewOffset?: unknown }).clearViewOffset === "function" &&
    typeof (camera as { updateProjectionMatrix?: unknown }).updateProjectionMatrix === "function"
  );
}

export function applyPickViewOffset(
  camera: Camera,
  viewportWidth: number,
  viewportHeight: number,
  pixelX: number,
  pixelY: number,
): ViewOffsetState | null {
  const previous = cameraViewOffset(camera);
  if (!hasViewOffsetApi(camera)) {
    return previous;
  }
  const top = viewportHeight - 1 - pixelY;
  camera.setViewOffset(viewportWidth, viewportHeight, pixelX, top, 1, 1);
  camera.updateProjectionMatrix();
  return previous;
}

export function restoreViewOffset(camera: Camera, previous: ViewOffsetState | null): void {
  if (!hasViewOffsetApi(camera)) {
    return;
  }
  if (previous) {
    camera.setViewOffset(
      previous.fullWidth,
      previous.fullHeight,
      previous.offsetX,
      previous.offsetY,
      previous.width,
      previous.height,
    );
  } else {
    camera.clearViewOffset();
  }
  camera.updateProjectionMatrix();
}
