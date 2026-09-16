/**
 * Bounded xatlas/watlas integration spike. Not a public API.
 * Proves WASM init, charting, packing, xref mapping, and disposal.
 */
import { Worker } from "node:worker_threads";
import { createRequire } from "node:module";
import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MeshBuilder, triangulatePolygon } from "@modeling-kit/mesh";
import { generateTorus } from "@modeling-kit/primitives";
import { describe, expect, it } from "vitest";
import * as watlas from "watlas";

const require = createRequire(import.meta.url);
const watlasRoot = path.dirname(require.resolve("watlas/package.json"));
const wasmPath = path.join(watlasRoot, "dist", "watlas.wasm");

function cubePositionsAndIndices(): { positions: Float32Array; indices: Uint32Array } {
  const mesh = MeshBuilder.createCube(1, 1, 1);
  const vertexIds = [...mesh.vertices.keys()];
  const indexOf = new Map(vertexIds.map((id, index) => [id, index]));
  const positions = new Float32Array(vertexIds.length * 3);
  vertexIds.forEach((id, index) => {
    const v = mesh.vertices.get(id)!;
    positions[index * 3] = v.position[0];
    positions[index * 3 + 1] = v.position[1];
    positions[index * 3 + 2] = v.position[2];
  });
  const indices: number[] = [];
  for (const faceId of mesh.faces.keys()) {
    const verts = mesh.getFaceVertices(faceId);
    const points = verts.map((id) => {
      const v = mesh.vertices.get(id)!;
      return [v.position[0], v.position[1], v.position[2]] as const;
    });
    const tri = triangulatePolygon(points, { rejectSelfIntersecting: true });
    expect(tri.status).toBe("ok");
    for (const [a, b, c] of tri.sourceVertexIndices) {
      indices.push(indexOf.get(verts[a]!)!, indexOf.get(verts[b]!)!, indexOf.get(verts[c]!)!);
    }
  }
  return { positions, indices: new Uint32Array(indices) };
}

function spherePositionsAndIndices(): { positions: Float32Array; indices: Uint32Array } {
  const mesh = MeshBuilder.createSphere(0.5, 8, 6);
  const vertexIds = [...mesh.vertices.keys()];
  const indexOf = new Map(vertexIds.map((id, index) => [id, index]));
  const positions = new Float32Array(vertexIds.length * 3);
  vertexIds.forEach((id, index) => {
    const v = mesh.vertices.get(id)!;
    positions[index * 3] = v.position[0];
    positions[index * 3 + 1] = v.position[1];
    positions[index * 3 + 2] = v.position[2];
  });
  const indices: number[] = [];
  for (const faceId of mesh.faces.keys()) {
    const verts = mesh.getFaceVertices(faceId);
    const points = verts.map((id) => {
      const v = mesh.vertices.get(id)!;
      return [v.position[0], v.position[1], v.position[2]] as const;
    });
    const tri = triangulatePolygon(points, { rejectSelfIntersecting: true });
    expect(tri.status).toBe("ok");
    for (const [a, b, c] of tri.sourceVertexIndices) {
      indices.push(indexOf.get(verts[a]!)!, indexOf.get(verts[b]!)!, indexOf.get(verts[c]!)!);
    }
  }
  return { positions, indices: new Uint32Array(indices) };
}

function torusPositionsAndIndices(): { positions: Float32Array; indices: Uint32Array } {
  const mesh = generateTorus({ radius: 0.5, tube: 0.15, radialSegments: 8, tubularSegments: 10 }).mesh;
  const vertexIds = [...mesh.vertices.keys()];
  const indexOf = new Map(vertexIds.map((id, index) => [id, index]));
  const positions = new Float32Array(vertexIds.length * 3);
  vertexIds.forEach((id, index) => {
    const v = mesh.vertices.get(id)!;
    positions[index * 3] = v.position[0];
    positions[index * 3 + 1] = v.position[1];
    positions[index * 3 + 2] = v.position[2];
  });
  const indices: number[] = [];
  for (const faceId of mesh.faces.keys()) {
    const verts = mesh.getFaceVertices(faceId);
    const points = verts.map((id) => {
      const v = mesh.vertices.get(id)!;
      return [v.position[0], v.position[1], v.position[2]] as const;
    });
    const tri = triangulatePolygon(points, { rejectSelfIntersecting: true });
    if (tri.status !== "ok") {
      continue;
    }
    for (const [a, b, c] of tri.sourceVertexIndices) {
      indices.push(indexOf.get(verts[a]!)!, indexOf.get(verts[b]!)!, indexOf.get(verts[c]!)!);
    }
  }
  return { positions, indices: new Uint32Array(indices) };
}

function concaveNgonPositionsAndIndices(): { positions: Float32Array; indices: Uint32Array } {
  const builder = new MeshBuilder();
  const v0 = builder.addVertex(0, 0, 0);
  const v1 = builder.addVertex(2, 0, 0);
  const v2 = builder.addVertex(2, 1, 0);
  const v3 = builder.addVertex(1, 1, 0);
  const v4 = builder.addVertex(1, 2, 0);
  const v5 = builder.addVertex(0, 2, 0);
  builder.addFace([v0, v1, v2, v3, v4, v5]);
  const mesh = builder.getMesh();
  const vertexIds = [...mesh.vertices.keys()];
  const indexOf = new Map(vertexIds.map((id, index) => [id, index]));
  const positions = new Float32Array(vertexIds.length * 3);
  vertexIds.forEach((id, index) => {
    const v = mesh.vertices.get(id)!;
    positions[index * 3] = v.position[0];
    positions[index * 3 + 1] = v.position[1];
    positions[index * 3 + 2] = v.position[2];
  });
  const verts = mesh.getFaceVertices([...mesh.faces.keys()][0]!);
  const points = verts.map((id) => {
    const v = mesh.vertices.get(id)!;
    return [v.position[0], v.position[1], v.position[2]] as const;
  });
  const tri = triangulatePolygon(points, { rejectSelfIntersecting: true });
  expect(tri.status).toBe("ok");
  const indices = new Uint32Array(tri.sourceVertexIndices.length * 3);
  tri.sourceVertexIndices.forEach(([a, b, c], i) => {
    indices[i * 3] = indexOf.get(verts[a]!)!;
    indices[i * 3 + 1] = indexOf.get(verts[b]!)!;
    indices[i * 3 + 2] = indexOf.get(verts[c]!)!;
  });
  return { positions, indices };
}

function unwrap(
  positions: Float32Array,
  indices: Uint32Array,
  pack: { padding?: number; resolution?: number; rotateCharts?: boolean } = {},
): {
  width: number;
  height: number;
  chartCount: number;
  triangleCount: number;
  vertexCount: number;
  xref: number[];
  uvs: Array<[number, number]>;
  indices: Uint32Array;
} {
  const atlas = new watlas.Atlas();
  try {
    atlas.addMesh({
      vertexPositionData: positions,
      vertexCount: positions.length / 3,
      vertexPositionStride: 12,
      indexData: indices,
      indexCount: indices.length,
    });
    atlas.computeCharts({});
    atlas.packCharts({
      padding: pack.padding ?? 1,
      resolution: pack.resolution ?? 256,
      rotateCharts: pack.rotateCharts ?? true,
      bilinear: true,
    });
    expect(atlas.width).toBeGreaterThan(0);
    expect(atlas.height).toBeGreaterThan(0);
    expect(atlas.meshCount).toBe(1);
    const mesh = atlas.getMesh(0);
    expect(mesh.indexCount).toBe(indices.length);
    const outIndices = new Uint32Array(mesh.indexCount);
    mesh.getIndexArray(outIndices);
    const xref: number[] = [];
    const uvs: Array<[number, number]> = [];
    for (let i = 0; i < mesh.vertexCount; i += 1) {
      const vertex = mesh.getVertex(i);
      expect(Number.isFinite(vertex.uv[0])).toBe(true);
      expect(Number.isFinite(vertex.uv[1])).toBe(true);
      expect(vertex.xref).toBeGreaterThanOrEqual(0);
      expect(vertex.xref).toBeLessThan(positions.length / 3);
      xref.push(vertex.xref);
      uvs.push([vertex.uv[0] / atlas.width, vertex.uv[1] / atlas.height]);
    }
    for (const [u, v] of uvs) {
      expect(Number.isFinite(u)).toBe(true);
      expect(Number.isFinite(v)).toBe(true);
    }
    return {
      width: atlas.width,
      height: atlas.height,
      chartCount: atlas.chartCount,
      triangleCount: mesh.indexCount / 3,
      vertexCount: mesh.vertexCount,
      xref,
      uvs,
      indices: outIndices,
    };
  } finally {
    atlas.delete();
  }
}

describe("xatlas/watlas integration spike", () => {
  it("reports wrapper, wasm size, and MIT license", () => {
    const pkg = JSON.parse(readFileSync(path.join(watlasRoot, "package.json"), "utf8")) as {
      version: string;
      license: string;
    };
    expect(pkg.version).toBe("1.0.1");
    expect(pkg.license).toBe("MIT");
    expect(statSync(wasmPath).size).toBeGreaterThan(100_000);
  });

  it("initializes once in Node and unwraps a triangulated cube", async () => {
    await watlas.Initialize();
    await watlas.Initialize();
    const { positions, indices } = cubePositionsAndIndices();
    expect(indices.length / 3).toBe(12);
    const result = unwrap(positions, indices);
    expect(result.chartCount).toBeGreaterThan(0);
    expect(result.triangleCount).toBe(12);
    expect(result.xref.length).toBe(result.vertexCount);
    expect(result.vertexCount).toBeGreaterThanOrEqual(8);
    expect(new Set(result.xref).size).toBe(8);
  });

  it("handles a UV sphere, torus, and concave n-gon after canonical triangulation", async () => {
    await watlas.Initialize();
    const sphereMesh = spherePositionsAndIndices();
    const sphere = unwrap(sphereMesh.positions, sphereMesh.indices);
    expect(sphere.triangleCount).toBeGreaterThan(0);
    expect(sphere.uvs.every(([u, v]) => Number.isFinite(u) && Number.isFinite(v))).toBe(true);

    const torus = torusPositionsAndIndices();
    const torusResult = unwrap(torus.positions, torus.indices);
    expect(torusResult.triangleCount).toBe(torus.indices.length / 3);
    expect(torusResult.chartCount).toBeGreaterThan(0);

    const concave = concaveNgonPositionsAndIndices();
    const concaveResult = unwrap(concave.positions, concave.indices);
    expect(concaveResult.triangleCount).toBe(concave.indices.length / 3);
    expect(concaveResult.xref.every((id) => id >= 0 && id < 6)).toBe(true);
  });

  it("disposes atlas instances across repeated unwrap cycles", async () => {
    await watlas.Initialize();
    const cube = cubePositionsAndIndices();
    for (let i = 0; i < 4; i += 1) {
      unwrap(cube.positions, cube.indices);
    }
  });

  it("initializes inside a Node worker_threads worker", async () => {
    const workerPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "xatlas-spike.worker.mjs");
    const worker = new Worker(workerPath);
    try {
      const result = await new Promise<{
        width: number;
        height: number;
        chartCount: number;
        triangleCount: number;
        xref: number;
        uv: [number, number];
      }>((resolve, reject) => {
        worker.once("message", (message: { success: boolean; result?: unknown; error?: string }) => {
          if (message.success && message.result) {
            resolve(message.result as never);
            return;
          }
          reject(new Error(message.error ?? "worker unwrap failed"));
        });
        worker.once("error", reject);
        worker.postMessage({ id: "spike" });
      });
      expect(result.width).toBeGreaterThan(0);
      expect(result.height).toBeGreaterThan(0);
      expect(result.triangleCount).toBe(12);
      expect(Number.isFinite(result.uv[0])).toBe(true);
      expect(result.xref).toBeGreaterThanOrEqual(0);
    } finally {
      await worker.terminate();
    }
  });
});
