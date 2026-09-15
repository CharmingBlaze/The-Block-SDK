import type { BufferGeometry, Material, Texture } from "three";

export class GpuResourceTracker {
  private readonly geometries = new Set<BufferGeometry>();
  private readonly materials = new Set<Material>();
  private readonly textures = new Set<Texture>();
  generation = 0;

  get counts(): { geometries: number; materials: number; textures: number } {
    return {
      geometries: this.geometries.size,
      materials: this.materials.size,
      textures: this.textures.size,
    };
  }

  trackGeometry(geometry: BufferGeometry): BufferGeometry {
    this.geometries.add(geometry);
    return geometry;
  }

  trackMaterial(material: Material): Material {
    this.materials.add(material);
    return material;
  }

  trackTexture(texture: Texture): Texture {
    this.textures.add(texture);
    return texture;
  }

  bumpGeneration(): number {
    this.generation += 1;
    return this.generation;
  }

  dispose(): void {
    for (const geometry of this.geometries) {
      geometry.dispose();
    }
    for (const material of this.materials) {
      material.dispose();
    }
    for (const texture of this.textures) {
      texture.dispose();
    }
    this.geometries.clear();
    this.materials.clear();
    this.textures.clear();
    this.bumpGeneration();
  }
}
