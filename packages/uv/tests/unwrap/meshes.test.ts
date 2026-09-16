import { describe, expect, it } from "vitest";
import { automaticUnwrap } from "../../src/unwrap";
import { getCornerUv } from "../../src/corners";
import {
  capsuleMesh,
  concaveNgonMesh,
  cubeMesh,
  cylinderMesh,
  disconnectedMesh,
  quadMesh,
  quadSphereMesh,
  subdividedCubeMesh,
  topologyFingerprint,
  torusMesh,
  triangleMesh,
  uvSphereMesh,
} from "./helpers";

const meshes = {
  triangle: triangleMesh,
  quad: quadMesh,
  cube: cubeMesh,
  "subdivided cube": subdividedCubeMesh,
  "concave n-gon": concaveNgonMesh,
  cylinder: cylinderMesh,
  "uv sphere": uvSphereMesh,
  "quad sphere": quadSphereMesh,
  torus: torusMesh,
  capsule: capsuleMesh,
  "disconnected components": disconnectedMesh,
};

describe("automatic chart unwrap meshes", () => {
  for (const [name, create] of Object.entries(meshes)) {
    it(`unwraps a ${name} into finite corner UVs without changing topology`, async () => {
      const mesh = create();
      const before = topologyFingerprint(mesh);
      const result = await automaticUnwrap({ mesh, options: { resolution: 256, padding: 1 } });
      expect(topologyFingerprint(mesh)).toEqual(before);
      expect(result.statistics.atlasWidth).toBeGreaterThan(0);
      expect(result.statistics.atlasHeight).toBeGreaterThan(0);
      expect(result.statistics.triangleCount).toBeGreaterThan(0);
      expect(result.islands.length).toBeGreaterThan(0);
      for (const faceId of result.targetedFaceIds) {
        for (const cornerId of mesh.getFaceCorners(faceId)) {
          const uv = getCornerUv(mesh, cornerId);
          expect(Number.isFinite(uv[0])).toBe(true);
          expect(Number.isFinite(uv[1])).toBe(true);
        }
      }
    });
  }
});
