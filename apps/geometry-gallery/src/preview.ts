import {
  Color,
  DoubleSide,
  EdgesGeometry,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
  type CanvasTexture,
} from "three";
import type { ThreeViewportHandle } from "@modeling-kit/three-adapter";
import type { FluentEditor } from "@modeling-kit/sdk";

export interface PreviewMaterials {
  readonly shaded: MeshStandardMaterial;
  readonly wire: LineBasicMaterial;
  readonly texture: CanvasTexture;
}

export interface PreviewState {
  useChecker: boolean;
  flat: boolean;
  showWire: boolean;
}

export function createPreviewMaterials(texture: CanvasTexture): PreviewMaterials {
  return {
    texture,
    shaded: new MeshStandardMaterial({
      map: texture,
      roughness: 0.45,
      metalness: 0.05,
      side: DoubleSide,
      flatShading: false,
    }),
    wire: new LineBasicMaterial({ color: new Color(0x111827), transparent: true, opacity: 0.7 }),
  };
}

export function disposeWireOverlay(wire: LineSegments | null): null {
  if (!wire) {
    return null;
  }
  wire.removeFromParent();
  wire.geometry.dispose();
  return null;
}

export function applyPreview(
  editor: FluentEditor,
  viewport: ThreeViewportHandle,
  materials: PreviewMaterials,
  state: PreviewState,
  wire: LineSegments | null,
): LineSegments | null {
  const object = editor.activeObject();
  if (!object) {
    return disposeWireOverlay(wire);
  }
  const mesh3d = viewport.adapter.object3D(object.objectId);
  if (!(mesh3d instanceof Mesh)) {
    return disposeWireOverlay(wire);
  }
  materials.shaded.map = state.useChecker ? materials.texture : null;
  materials.shaded.color.set(state.useChecker ? 0xffffff : 0x7dd3fc);
  materials.shaded.flatShading = state.flat;
  materials.shaded.needsUpdate = true;
  mesh3d.material = materials.shaded;
  const cleared = disposeWireOverlay(wire);
  if (!state.showWire) {
    return cleared;
  }
  const overlay = new LineSegments(new EdgesGeometry(mesh3d.geometry), materials.wire);
  mesh3d.add(overlay);
  return overlay;
}

export function disposePreviewMaterials(materials: PreviewMaterials, wire: LineSegments | null): void {
  disposeWireOverlay(wire);
  materials.shaded.dispose();
  materials.wire.dispose();
  materials.texture.dispose();
}
