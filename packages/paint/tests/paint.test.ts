import { createSequenceIdFactory } from "@modeling-kit/core";
import { MeshBuilder } from "@modeling-kit/mesh";
import { projectUvs } from "@modeling-kit/uv";
import { describe, expect, it } from "vitest";
import {
  TextureBuffer,
  drawBrushDab,
  drawBrushLine,
  uvToPixel,
  PaintEngine,
  paintSurfaceHitOnStroke,
  resolveHitMaterialSlot,
  dilateSeamTexels,
  applyTextureTilePatches,
} from "../src/index";

describe("@modeling-kit/paint", () => {
  it("initializes texture buffer and reads/writes pixels", () => {
    const buf = TextureBuffer.create(16, 16, [255, 0, 0, 255]);
    expect(buf.getPixel(0, 0)).toEqual([255, 0, 0, 255]);

    buf.setPixel(5, 5, [0, 255, 0, 255]);
    expect(buf.getPixel(5, 5)).toEqual([0, 255, 0, 255]);
  });

  it("stamps brush dab with falloff", () => {
    const buf = TextureBuffer.create(32, 32);
    drawBrushDab(buf, 16, 16, {
      size: 4,
      color: [0, 0, 255, 255],
      hardness: 1.0,
    });

    // Center pixel should have color
    const center = buf.getPixel(16, 16);
    expect(center[2]).toBe(255);
    expect(center[3]).toBe(255);

    // Far away pixel outside radius should remain empty
    const outside = buf.getPixel(0, 0);
    expect(outside[3]).toBe(0);
  });

  it("rasterizes a line between two points", () => {
    const buf = TextureBuffer.create(32, 32);
    drawBrushLine(buf, 0, 16, 31, 16, {
      size: 1,
      color: [255, 255, 0, 255],
    });

    // Midpoint on line should be painted
    const mid = buf.getPixel(15, 16);
    expect(mid[0]).toBe(255);
    expect(mid[1]).toBe(255);
  });

  it("performs flood fill on matching color region", () => {
    const buf = TextureBuffer.create(8, 8, [100, 100, 100, 255]);
    buf.floodFill(0, 0, [255, 0, 0, 255]);

    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        expect(buf.getPixel(x, y)).toEqual([255, 0, 0, 255]);
      }
    }
  });

  it("maps UV coordinates to pixel coordinates", () => {
    const [px, py] = uvToPixel(0.5, 0.5, 100, 100);
    expect(px).toBe(50);
    expect(py).toBe(50);
  });

  it("commits one stroke as tile patches and restores bytes on cancel", () => {
    const buf = TextureBuffer.create(80, 80);
    const engine = new PaintEngine(buf);
    engine.begin();
    engine.dab(70, 70, { size: 4, color: [255, 0, 0, 255] });
    const { patches, unchanged } = engine.commit();
    expect(unchanged).toBe(false);
    expect(patches.length).toBeGreaterThan(0);
    expect(patches.length).toBeLessThan(4);
    expect(buf.getPixel(70, 70)[0]).toBe(255);

    const again = new PaintEngine(buf);
    again.begin();
    again.dab(2, 2, { size: 2, color: [0, 255, 0, 255] });
    again.cancel();
    expect(buf.getPixel(2, 2)[3]).toBe(0);
    expect(() => again.commit()).toThrow();
    again.dispose();
    again.dispose();
  });

  it("reuses one engine across strokes and only snapshots dirty tiles", () => {
    const buf = TextureBuffer.create(128, 128);
    const engine = new PaintEngine(buf);
    engine.begin();
    engine.dab(4, 4, { size: 2, color: [255, 0, 0, 255] });
    const first = engine.commit();
    expect(first.patches.length).toBe(1);
    expect(engine.state).toBe("idle");
    engine.begin();
    engine.dab(100, 100, { size: 2, color: [0, 255, 0, 255] });
    const second = engine.commit();
    expect(second.patches.length).toBe(1);
    expect(buf.getPixel(4, 4)[0]).toBe(255);
    expect(buf.getPixel(100, 100)[1]).toBe(255);
    engine.begin();
    engine.commit();
    expect(buf.getPixel(4, 4)[0]).toBe(255);
    engine.dispose();
    expect(() => engine.begin()).toThrow(/disposed/);
  });

  it("captures intermediate tiles on a long stroke so undo restores the whole line", () => {
    const buf = TextureBuffer.create(128, 128);
    const engine = new PaintEngine(buf);
    engine.begin();
    engine.strokeTo(2, 2, 100, 2, { size: 2, color: [255, 0, 0, 255] });
    expect(buf.getPixel(50, 2)[0]).toBe(255);
    const { patches } = engine.commit();
    expect(patches.length).toBeGreaterThan(1);
    applyTextureTilePatches(buf, patches, false);
    expect(buf.getPixel(2, 2)[3]).toBe(0);
    expect(buf.getPixel(50, 2)[3]).toBe(0);
    expect(buf.getPixel(100, 2)[3]).toBe(0);
    engine.dispose();
  });

  it("maps a 3D face hit into a paint stroke dab", () => {
    const ids = createSequenceIdFactory("paint3d");
    const mesh = MeshBuilder.createCube(1, 1, 1, ids.mesh());
    projectUvs(mesh, { projection: "box" });
    const buf = TextureBuffer.create(32, 32);
    const engine = new PaintEngine(buf);
    engine.begin();
    const faceId = [...mesh.faces.keys()][0]!;
    paintSurfaceHitOnStroke(mesh, { faceId, u: 0.25, v: 0.25 }, engine, {
      size: 2,
      color: [10, 20, 30, 255],
    });
    const { unchanged } = engine.commit();
    expect(unchanged).toBe(false);
    expect(resolveHitMaterialSlot(mesh, faceId).materialSlot).toBe(0);
    engine.dispose();
  });

  it("dilates opaque texels into UV gutter neighbors", () => {
    const buf = TextureBuffer.create(16, 16);
    buf.setPixel(8, 8, [12, 34, 56, 255]);
    dilateSeamTexels(buf, 1);
    expect(buf.getPixel(9, 8)).toEqual([12, 34, 56, 255]);
    expect(buf.getPixel(7, 8)).toEqual([12, 34, 56, 255]);
    expect(buf.getPixel(8, 9)).toEqual([12, 34, 56, 255]);
    expect(buf.getPixel(0, 0)[3]).toBe(0);
  });

  it("pads 3D surface hits so cancel restores dilated gutter pixels", () => {
    const ids = createSequenceIdFactory("dilate3d");
    const mesh = MeshBuilder.createCube(1, 1, 1, ids.mesh());
    projectUvs(mesh, { projection: "box" });
    const buf = TextureBuffer.create(32, 32);
    const engine = new PaintEngine(buf);
    engine.begin();
    const faceId = [...mesh.faces.keys()][0]!;
    paintSurfaceHitOnStroke(mesh, { faceId, u: 0, v: 0 }, engine, {
      size: 1,
      color: [40, 50, 60, 255],
      seamDilation: 2,
    });
    let painted = 0;
    for (let y = 0; y < 32; y += 1) {
      for (let x = 0; x < 32; x += 1) {
        if (buf.getPixel(x, y)[3] > 0) {
          painted += 1;
        }
      }
    }
    expect(painted).toBeGreaterThan(1);
    engine.cancel();
    expect(buf.getPixel(0, 0)[3]).toBe(0);
    for (let y = 0; y < 32; y += 1) {
      for (let x = 0; x < 32; x += 1) {
        expect(buf.getPixel(x, y)[3]).toBe(0);
      }
    }
    engine.dispose();
  });

  it("bounds flood fill so it cannot loop past the pixel budget", () => {
    const buf = TextureBuffer.create(8, 8, [10, 10, 10, 255]);
    const result = buf.floodFill(0, 0, [255, 0, 0, 255], 0, 4);
    expect(result.filled).toBe(4);
    expect(result.truncated).toBe(true);
  });
});
