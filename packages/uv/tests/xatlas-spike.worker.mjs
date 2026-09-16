import { parentPort } from "node:worker_threads";
import * as watlas from "watlas";

const positions = new Float32Array([
  -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5, -0.5, 0.5, 0.5, -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, -0.5,
  -0.5, 0.5, -0.5,
]);
const indices = new Uint32Array([
  0, 1, 2, 0, 2, 3, 5, 4, 7, 5, 7, 6, 3, 2, 6, 3, 6, 7, 4, 5, 1, 4, 1, 0, 1, 5, 6, 1, 6, 2, 4, 0, 3, 4, 3, 7,
]);

parentPort?.on("message", async (message) => {
  try {
    await watlas.Initialize();
    const atlas = new watlas.Atlas();
    atlas.addMesh({
      vertexPositionData: positions,
      vertexCount: positions.length / 3,
      vertexPositionStride: 12,
      indexData: indices,
      indexCount: indices.length,
    });
    atlas.generate({}, { padding: 1, resolution: 256 });
    const mesh = atlas.getMesh(0);
    const first = mesh.getVertex(0);
    const result = {
      width: atlas.width,
      height: atlas.height,
      chartCount: atlas.chartCount,
      triangleCount: mesh.indexCount / 3,
      xref: first.xref,
      uv: [first.uv[0] / atlas.width, first.uv[1] / atlas.height],
    };
    atlas.delete();
    parentPort?.postMessage({ id: message.id, success: true, result });
  } catch (error) {
    parentPort?.postMessage({
      id: message.id,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});
