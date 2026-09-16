import { describe, expect, it } from "vitest";
import { withAtlas } from "../../src/unwrap/backend/xatlas/atlas";
import { XAtlasUnwrapBackend, buildUvTriangulation } from "../../src/unwrap";
import { cubeMesh } from "./helpers";

describe("xatlas atlas lifecycle", () => {
  it("deletes the atlas after success and after failure", () => {
    const deleted: boolean[] = [];
    class FakeAtlas {
      generate(): void {
        throw new Error("generate failed");
      }
      delete(): void {
        deleted.push(true);
      }
    }
    const watlas = { Atlas: FakeAtlas } as unknown as Parameters<typeof withAtlas>[0];
    expect(() =>
      withAtlas(watlas, (atlas) => {
        (atlas as unknown as FakeAtlas).generate();
      }),
    ).toThrow(/generate failed/);
    expect(deleted).toEqual([true]);
    deleted.length = 0;
    withAtlas(watlas, (atlas) => {
      expect(atlas).toBeInstanceOf(FakeAtlas);
      return 1;
    });
    expect(deleted).toEqual([true]);
  });

  it("shares initialize and repeats unwrap after a cancelled generate window", async () => {
    const backend = new XAtlasUnwrapBackend();
    await Promise.all([backend.initialize(), backend.initialize()]);
    const mesh = cubeMesh();
    const built = buildUvTriangulation(mesh, [...mesh.faces.keys()]);
    const first = await backend.unwrap(built.input, { resolution: 64 });
    const controller = new AbortController();
    controller.abort();
    await expect(backend.unwrap(built.input, { resolution: 64 }, controller.signal)).rejects.toMatchObject({
      code: "cancelled",
    });
    const second = await backend.unwrap(built.input, { resolution: 64 });
    expect(second.triangleCount).toBe(first.triangleCount);
    backend.dispose();
  });
});
