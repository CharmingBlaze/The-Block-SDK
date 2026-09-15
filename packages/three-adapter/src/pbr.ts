import type { MeshRecord, ModelDocument, MaterialData } from "@modeling-kit/document";
import type { HalfEdgeMesh } from "@modeling-kit/mesh";
import {
  Color,
  DoubleSide,
  FrontSide,
  MeshStandardMaterial,
  type BufferGeometry,
  type Material,
} from "three";
import type { RenderMapping } from "./geometry";

export function createStandardMaterial(data: MaterialData): MeshStandardMaterial {
  const [r, g, b, a] = data.baseColor;
  return new MeshStandardMaterial({
    color: new Color(r, g, b),
    metalness: data.metallic,
    roughness: data.roughness,
    emissive: new Color(data.emissive[0], data.emissive[1], data.emissive[2]),
    opacity: a,
    transparent: data.alphaMode === "blend" || a < 0.999,
    alphaTest: data.alphaMode === "mask" ? data.alphaCutoff : 0,
    side: data.doubleSided ? DoubleSide : FrontSide,
  });
}

export function defaultViewportMaterial(): MeshStandardMaterial {
  return new MeshStandardMaterial({
    color: new Color(0x8aa4c8),
    metalness: 0.05,
    roughness: 0.7,
    side: DoubleSide,
  });
}

export function materialsForRecord(document: ModelDocument, record: MeshRecord): Material[] {
  if (record.materialIds.length === 0) {
    return [defaultViewportMaterial()];
  }
  return record.materialIds.map((id) => {
    const data = document.materials.get(id);
    return data ? createStandardMaterial(data) : defaultViewportMaterial();
  });
}

export function applyFaceMaterialGroups(
  geometry: BufferGeometry,
  mesh: HalfEdgeMesh,
  mapping: RenderMapping,
): void {
  geometry.clearGroups();
  const triangleCount = mapping.triangleToFace.length;
  if (triangleCount === 0) {
    return;
  }
  let runSlot = mesh.faces.get(mapping.triangleToFace[0]!)?.materialSlot ?? 0;
  let runStart = 0;
  for (let t = 1; t <= triangleCount; t++) {
    const slot =
      t === triangleCount ? null : (mesh.faces.get(mapping.triangleToFace[t]!)?.materialSlot ?? 0);
    if (slot !== runSlot) {
      geometry.addGroup(runStart * 3, (t - runStart) * 3, runSlot);
      runStart = t;
      runSlot = slot ?? 0;
    }
  }
}

export function disposeMaterials(material: Material | Material[] | undefined): void {
  if (!material) {
    return;
  }
  const list = Array.isArray(material) ? material : [material];
  for (const item of list) {
    item.dispose();
  }
}
