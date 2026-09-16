import { UvUnwrapError } from "../../errors";
import type { UvUnwrapBackendResult } from "../../types";
import type { WatlasAtlas } from "./load";

export function readAtlasResult(atlas: WatlasAtlas, expectedIndexCount: number): UvUnwrapBackendResult {
  if (!(atlas.width > 0) || !(atlas.height > 0)) {
    throw new UvUnwrapError("invalid-atlas", "xatlas returned a zero-sized atlas");
  }
  if (atlas.meshCount < 1) {
    throw new UvUnwrapError("invalid-atlas", "xatlas returned no output meshes");
  }
  const mesh = atlas.getMesh(0);
  if (mesh.indexCount !== expectedIndexCount) {
    throw new UvUnwrapError(
      "invalid-atlas",
      `xatlas changed triangle count from ${expectedIndexCount / 3} to ${mesh.indexCount / 3}`,
    );
  }
  const indices = new Uint32Array(mesh.indexCount);
  mesh.getIndexArray(indices);
  const uvs = new Float32Array(mesh.vertexCount * 2);
  const xref = new Uint32Array(mesh.vertexCount);
  for (let i = 0; i < mesh.vertexCount; i += 1) {
    const vertex = mesh.getVertex(i);
    const u = vertex.uv[0] / atlas.width;
    const v = vertex.uv[1] / atlas.height;
    if (!Number.isFinite(u) || !Number.isFinite(v)) {
      throw new UvUnwrapError("invalid-atlas", "xatlas returned a non-finite UV");
    }
    uvs[i * 2] = u;
    uvs[i * 2 + 1] = v;
    xref[i] = vertex.xref;
  }
  return {
    atlasWidth: atlas.width,
    atlasHeight: atlas.height,
    chartCount: atlas.chartCount,
    triangleCount: mesh.indexCount / 3,
    vertexCount: mesh.vertexCount,
    indices,
    uvs,
    xref,
  };
}
