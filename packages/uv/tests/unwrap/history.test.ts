import { MeshBuilder, deserializeMesh, serializeMesh } from "@modeling-kit/mesh";
import { describe, expect, it } from "vitest";
import { automaticUnwrap } from "../../src/unwrap";
import { getCornerUv } from "../../src/corners";
import { cubeMesh } from "./helpers";
import { projectBox } from "../../src/unwrap";

describe("automatic chart unwrap persistence", () => {
  it("round-trips unwrapped UVs through mesh serialization", async () => {
    const mesh = cubeMesh();
    await automaticUnwrap({ mesh, options: { resolution: 128 } });
    const uvs = [...mesh.corners.values()].map((corner) => getCornerUv(mesh, corner.id));
    const restored = deserializeMesh(serializeMesh(mesh));
    expect([...restored.corners.values()].map((corner) => getCornerUv(restored, corner.id))).toEqual(uvs);
    expect(restored.vertices.size).toBe(mesh.vertices.size);
    expect(restored.faces.size).toBe(mesh.faces.size);
  });

  it("keeps box projection available beside automatic unwrap", () => {
    const mesh = MeshBuilder.createCube(1, 1, 1);
    projectBox(mesh, {});
    for (const corner of mesh.corners.values()) {
      expect(getCornerUv(mesh, corner.id).every(Number.isFinite)).toBe(true);
    }
  });
});
