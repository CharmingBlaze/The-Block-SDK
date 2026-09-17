import type { MeshRecord, ModelDocument, MaterialData } from "@modeling-kit/document";
import type { HalfEdgeMesh } from "@modeling-kit/mesh";
import {
  Color,
  DoubleSide,
  FrontSide,
  MeshStandardMaterial,
  DataTexture,
  NearestFilter,
  RGBAFormat,
  LinearFilter,
  SRGBColorSpace,
  UnsignedByteType,
  type BufferGeometry,
  type Material,
} from "three";
import type { RenderMapping } from "./geometry";
import type { TexturePixelSource } from "./adapter-types";

function resolveBaseColorTexture(data: MaterialData, resolver?: (textureId: string) => TexturePixelSource | undefined): DataTexture | undefined {
  const textureId = data.baseColorTexture ?? data.textureBindings?.baseColor?.textureId;
  const source = textureId && resolver ? resolver(textureId) : undefined;
  if (!source) return undefined;
  const texture = new DataTexture(source.data, source.width, source.height, RGBAFormat, UnsignedByteType);
  texture.userData.modelingTextureId = textureId;
  texture.colorSpace = SRGBColorSpace;
  // TextureBuffer rows use image/canvas order (row 0 is the top). Three's UV
  // origin is bottom-left, so upload with a Y flip to keep painted texels under
  // the viewport cursor and aligned with the 2D editor.
  texture.flipY = true;
  texture.magFilter = data.pixelArt ? NearestFilter : LinearFilter;
  texture.minFilter = data.pixelArt ? NearestFilter : LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

export function createStandardMaterial(data: MaterialData, textureResolver?: (textureId: string) => TexturePixelSource | undefined): MeshStandardMaterial {
  const [r, g, b, a] = data.baseColor;
  const map = resolveBaseColorTexture(data, textureResolver);
  return new MeshStandardMaterial({
    color: new Color(r, g, b),
    metalness: data.metallic,
    roughness: data.roughness,
    emissive: new Color(data.emissive[0], data.emissive[1], data.emissive[2]),
    opacity: a,
    transparent: data.alphaMode === "blend" || a < 0.999,
    alphaTest: data.alphaMode === "mask" ? data.alphaCutoff : 0,
    side: data.doubleSided ? DoubleSide : FrontSide,
    ...(map ? { map } : {}),
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

export function materialsForRecord(document: ModelDocument, record: MeshRecord, textureResolver?: (textureId: string) => TexturePixelSource | undefined): Material[] {
  if (record.materialIds.length === 0) {
    return [defaultViewportMaterial()];
  }
  return record.materialIds.map((id) => {
    const data = document.materials.get(id);
    return data ? createStandardMaterial(data, textureResolver) : defaultViewportMaterial();
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
    const textured = item as Material & { map?: { dispose?: () => void } | null };
    textured.map?.dispose?.();
    item.dispose();
  }
}
