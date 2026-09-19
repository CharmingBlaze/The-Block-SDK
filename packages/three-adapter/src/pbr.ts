/**
 * @module pbr — Three.js PBR material creation from canonical MaterialData.
 *
 * Translates SDK MaterialData (PBR metallic-roughness) into
 * THREE.MeshStandardMaterial with full texture map support:
 *
 * - **Base color** → `map` (sRGB)
 * - **Normal** → `normalMap` (linear, `normalScale` applied)
 * - **Metallic-roughness** → `metalnessMap` + `roughnessMap` (linear)
 * - **Occlusion** → `aoMap` (linear, `aoMapIntensity` applied)
 * - **Emissive** → `emissiveMap` (sRGB, `emissiveIntensity` applied)
 *
 * Texture resolution is opt-in: pass a `textureResolver` callback that maps
 * SDK TextureIds to raw RGBA pixel buffers.
 */

import type { MeshRecord, ModelDocument, MaterialData } from "@modeling-kit/document";
import type { HalfEdgeMesh } from "@modeling-kit/mesh";
import {
  Color, DoubleSide, FrontSide, MeshStandardMaterial,
  DataTexture, NearestFilter, RGBAFormat, LinearFilter,
  SRGBColorSpace, LinearSRGBColorSpace, UnsignedByteType,
  Vector2,
  type BufferGeometry, type Material,
} from "three";
import type { RenderMapping } from "./geometry";
import type { TexturePixelSource } from "./adapter-types";

interface TexCh {
  bindingKey: string;
  legacyField?: string;
  colorSpace: typeof SRGBColorSpace | typeof LinearSRGBColorSpace;
}

function resolveTex(ch: TexCh, data: MaterialData, res: (id: string) => TexturePixelSource | undefined): { tex: DataTexture; id: string } | undefined {
  const binding = data.textureBindings?.[ch.bindingKey];
  const texId = binding?.textureId ?? (ch.legacyField ? (data as unknown as Record<string, unknown>)[ch.legacyField] as string | undefined : undefined);
  if (!texId) return undefined;
  const src = res(texId);
  if (!src) return undefined;
  const t = new DataTexture(src.data, src.width, src.height, RGBAFormat, UnsignedByteType);
  t.userData.modelingTextureId = texId;
  t.colorSpace = ch.colorSpace;
  t.flipY = true;
  t.magFilter = data.pixelArt ? NearestFilter : LinearFilter;
  t.minFilter = data.pixelArt ? NearestFilter : LinearFilter;
  t.needsUpdate = true;
  return { tex: t, id: texId };
}

export function createStandardMaterial(
  data: MaterialData,
  textureResolver?: (textureId: string) => TexturePixelSource | undefined,
): MeshStandardMaterial {
  const [r, g, b, a] = data.baseColor;
  const res = textureResolver
    ? (ch: TexCh) => resolveTex(ch, data, textureResolver)
    : () => undefined;

  const base = res({ bindingKey: "baseColor", legacyField: "baseColorTexture", colorSpace: SRGBColorSpace });
  const normal = res({ bindingKey: "normal", colorSpace: LinearSRGBColorSpace });
  const mr = res({ bindingKey: "metallicRoughness", legacyField: "metallicRoughnessTexture", colorSpace: LinearSRGBColorSpace });
  const occ = res({ bindingKey: "occlusion", legacyField: "occlusionTexture", colorSpace: LinearSRGBColorSpace });
  const emis = res({ bindingKey: "emissive", legacyField: "emissiveTexture", colorSpace: SRGBColorSpace });

  const mat = new MeshStandardMaterial({
    color: new Color(r, g, b),
    metalness: data.metallic,
    roughness: data.roughness,
    emissive: new Color(data.emissive[0], data.emissive[1], data.emissive[2]),
    emissiveIntensity: data.emissiveStrength ?? 1,
    opacity: a,
    transparent: data.alphaMode === "blend" || a < 0.999,
    alphaTest: data.alphaMode === "mask" ? data.alphaCutoff : 0,
    side: data.doubleSided ? DoubleSide : FrontSide,
    normalScale: new Vector2(data.normalScale ?? 1, data.normalScale ?? 1),
    aoMapIntensity: data.occlusionStrength ?? 1,
  });

  if (base) mat.map = base.tex;
  if (normal) mat.normalMap = normal.tex;
  if (mr) { mat.metalnessMap = mr.tex; mat.roughnessMap = mr.tex; }
  if (occ) mat.aoMap = occ.tex;
  if (emis) mat.emissiveMap = emis.tex;

  return mat;
}

/** Default viewport material — soft blue-gray, double-sided. */
export function defaultViewportMaterial(): MeshStandardMaterial {
  return new MeshStandardMaterial({
    color: new Color(0x8aa4c8), metalness: 0.05, roughness: 0.7, side: DoubleSide,
  });
}

/** Create a material array for a mesh record from its materialIds. */
export function materialsForRecord(
  document: ModelDocument, record: MeshRecord,
  textureResolver?: (textureId: string) => TexturePixelSource | undefined,
): Material[] {
  if (record.materialIds.length === 0) return [defaultViewportMaterial()];
  return record.materialIds.map((id) => {
    const data = document.materials.get(id);
    return data ? createStandardMaterial(data, textureResolver) : defaultViewportMaterial();
  });
}

/** Assign per-face material groups on a BufferGeometry for multi-material meshes. */
export function applyFaceMaterialGroups(
  geometry: BufferGeometry, mesh: HalfEdgeMesh, mapping: RenderMapping,
): void {
  geometry.clearGroups();
  const tc = mapping.triangleToFace.length;
  if (tc === 0) return;
  let runSlot = mesh.faces.get(mapping.triangleToFace[0]!)?.materialSlot ?? 0;
  let runStart = 0;
  for (let t = 1; t <= tc; t++) {
    const slot = t === tc ? null : (mesh.faces.get(mapping.triangleToFace[t]!)?.materialSlot ?? 0);
    if (slot !== runSlot) {
      geometry.addGroup(runStart * 3, (t - runStart) * 3, runSlot);
      runStart = t; runSlot = slot ?? 0;
    }
  }
}

/** Dispose Three.js materials including all texture maps. */
export function disposeMaterials(material: Material | Material[] | undefined): void {
  if (!material) return;
  const list = Array.isArray(material) ? material : [material];
  for (const item of list) {
    const keys = ["map", "normalMap", "metalnessMap", "roughnessMap", "aoMap", "emissiveMap"] as const;
    for (const k of keys) {
      ((item as unknown as Record<string, unknown>)[k] as { dispose?: () => void } | undefined)?.dispose?.();
    }
    item.dispose();
  }
}
