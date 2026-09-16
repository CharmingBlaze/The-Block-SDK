import { describe, expect, it } from "vitest";
import { automaticUnwrap } from "../../src/unwrap";
import { getCornerUv } from "../../src/corners";
import { cubeMesh, topologyFingerprint } from "./helpers";

describe("automatic chart unwrap corner mapping", () => {
  it("keeps canonical vertex/face/edge counts and stores UVs per corner", async () => {
    const mesh = cubeMesh();
    const before = topologyFingerprint(mesh);
    const vertexCount = mesh.vertices.size;
    await automaticUnwrap({ mesh, options: { resolution: 256 } });
    expect(topologyFingerprint(mesh)).toEqual(before);
    expect(mesh.vertices.size).toBe(vertexCount);
    expect(mesh.corners.size).toBe(24);
    const vertexId = [...mesh.vertices.keys()][0]!;
    const unique = new Set(
      [...mesh.corners.values()]
        .filter((corner) => corner.vertexId === vertexId)
        .map((corner) => {
          const uv = getCornerUv(mesh, corner.id);
          return `${uv[0].toFixed(5)},${uv[1].toFixed(5)}`;
        }),
    );
    expect(unique.size).toBeGreaterThan(1);
  });
});
