import { nearlyEqual } from "@modeling-kit/math";
import type { ModelDocument } from "@modeling-kit/document";

export interface RoundtripComparison {
  readonly sceneNodes: number;
  readonly meshes: number;
  readonly materials: number;
  readonly textures: number;
  readonly skeletons: number;
  readonly animations: number;
}

export function compareDocuments(original: ModelDocument, roundtrip: ModelDocument): RoundtripComparison {
  return {
    sceneNodes: roundtrip.scene.nodes.size,
    meshes: roundtrip.meshes.size,
    materials: roundtrip.materials.size,
    textures: roundtrip.textures.size,
    skeletons: roundtrip.skeletons.size,
    animations: roundtrip.animations.size,
  };
}

export function close(a: number, b: number, epsilon = 1e-4): boolean {
  return nearlyEqual(a, b, epsilon);
}
