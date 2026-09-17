import { createSequenceIdFactory } from "@modeling-kit/core";
import { MeshBuilder } from "@modeling-kit/mesh";
import { describe, expect, it } from "vitest";
import { exportPly, exportPlyWithReport, importPly, importPlyWithReport, plyExportReport } from "../src/index";

/** Minimal ASCII PLY text for tests that need to control the header exactly. */
function plyFile(body: readonly string[]): string {
  return ["ply", "format ascii 1.0", ...body].join("\n");
}

describe("PLY codec", () => {
  it("round-trips a cube with vertex and face counts intact", () => {
    const ids = createSequenceIdFactory("ply");
    const cube = MeshBuilder.createCube(2, 2, 2, ids.mesh());

    const text = exportPly(cube);
    const reimported = importPly(text, ids);

    expect(reimported.vertices.size).toBe(cube.vertices.size);
    expect(reimported.faces.size).toBe(cube.faces.size);
  });

  it("writes an ASCII header with zero-based face lists and a trailing newline", () => {
    const ids = createSequenceIdFactory("ply");
    const cube = MeshBuilder.createCube(2, 2, 2, ids.mesh());
    const text = exportPly(cube);
    const lines = text.split("\n");

    expect(lines[0]).toBe("ply");
    expect(lines[1]).toBe("format ascii 1.0");
    expect(text).toContain("element vertex 8");
    expect(text).toContain("element face 6");
    expect(text).toContain("property list uchar int vertex_indices");
    expect(text.indexOf("end_header")).toBeGreaterThan(-1);
    expect(text.endsWith("\n")).toBe(true);
    // createCube yields quads, so the first face row is a 4-length list that
    // starts at row 0: this proves indices are zero-based *and* that n-gons are
    // written as lists instead of being triangulated.
    expect(text).toMatch(/^4 0 1 2 3$/m);
    expect(text).toMatch(/^element face 6$/m);
  });

  it("honours a caller comment and flattens newlines inside it", () => {
    const ids = createSequenceIdFactory("ply");
    const cube = MeshBuilder.createCube(1, 1, 1, ids.mesh());
    const text = exportPly(cube, { comment: "made by\nsomeone" });
    expect(text).toContain("comment made by someone");
  });

  it("preserves an n-gon face instead of triangulating it", () => {
    const ids = createSequenceIdFactory("ply");
    const builder = new MeshBuilder(ids.mesh());
    const ring = [
      builder.addVertex(0, 0, 0, ids.vertex()),
      builder.addVertex(1, 0, 0, ids.vertex()),
      builder.addVertex(2, 0.5, 0, ids.vertex()),
      builder.addVertex(1, 1, 0, ids.vertex()),
      builder.addVertex(0, 1, 0, ids.vertex()),
    ];
    builder.addFace(ring, { id: ids.face() });
    const pentagon = builder.getMesh();

    const text = exportPly(pentagon);
    expect(text).toContain("5 0 1 2 3 4");
    expect(text).toContain("element face 1");

    const back = importPly(text, ids);
    expect(back.faces.size).toBe(1);
    const face = [...back.faces.values()][0]!;
    expect(back.getFaceVertices(face.id)).toHaveLength(5);
  });

  it("keeps shared topology rather than exploding into a triangle soup", () => {
    const ids = createSequenceIdFactory("ply");
    const builder = new MeshBuilder(ids.mesh());
    const a = builder.addVertex(0, 0, 0, ids.vertex());
    const b = builder.addVertex(1, 0, 0, ids.vertex());
    const c = builder.addVertex(1, 1, 0, ids.vertex());
    const d = builder.addVertex(0, 1, 0, ids.vertex());
    builder.addFace([a, b, c], { id: ids.face() });
    builder.addFace([a, c, d], { id: ids.face() });

    const back = importPly(exportPly(builder.getMesh()), ids);
    expect(back.vertices.size).toBe(4);
    expect(back.faces.size).toBe(2);
  });

  it("reports the ply format and its data loss", () => {
    const ids = createSequenceIdFactory("ply");
    const cube = MeshBuilder.createCube(1, 1, 1, ids.mesh());
    const { report } = exportPlyWithReport(cube);
    expect(report.format).toBe("ply");
    expect(report.dataLoss.length).toBeGreaterThan(0);

    const preview = plyExportReport(cube);
    expect(preview.format).toBe("ply");
    expect(preview.dataLoss.join(" ")).toContain("geometry-only");
  });

  it("drops per-vertex extras but warns about it", () => {
    const ids = createSequenceIdFactory("ply");
    const text = plyFile([
      "element vertex 3",
      "property float x",
      "property float y",
      "property float z",
      "property float nx",
      "property uchar red",
      "element face 1",
      "property list uchar int vertex_indices",
      "end_header",
      "0 0 0 1 255",
      "1 0 0 1 0",
      "1 1 0 1 0",
      "3 0 1 2",
    ]);

    const { mesh, report } = importPlyWithReport(text, ids);
    expect(mesh.vertices.size).toBe(3);
    expect(mesh.faces.size).toBe(1);
    const warnings = report.warnings.join(" ");
    expect(warnings).toContain("nx");
    expect(warnings).toContain("red");
  });

  it("reads faces declared before vertices without renumbering", () => {
    const ids = createSequenceIdFactory("ply");
    const text = plyFile([
      "element face 1",
      "property list uchar int vertex_indices",
      "element vertex 3",
      "property float x",
      "property float y",
      "property float z",
      "end_header",
      "3 0 1 2",
      "0 0 0",
      "2 0 0",
      "0 2 0",
    ]);

    const mesh = importPly(text, ids);
    expect(mesh.vertices.size).toBe(3);
    expect(mesh.faces.size).toBe(1);
    const face = [...mesh.faces.values()][0]!;
    const xs = mesh.getFaceVertices(face.id).map((id) => mesh.vertices.get(id)!.position[0]);
    expect(xs).toEqual([0, 2, 0]);
  });

  it("consumes unsupported elements without desynchronising the body", () => {
    const ids = createSequenceIdFactory("ply");
    const text = plyFile([
      "element vertex 3",
      "property float x",
      "property float y",
      "property float z",
      "element edge 2",
      "property int vertex1",
      "property int vertex2",
      "element face 1",
      "property list uchar int vertex_indices",
      "end_header",
      "0 0 0",
      "1 0 0",
      "1 1 0",
      "0 1",
      "1 2",
      "3 0 1 2",
    ]);

    const { mesh, report } = importPlyWithReport(text, ids);
    expect(mesh.vertices.size).toBe(3);
    expect(mesh.faces.size).toBe(1);
    expect(report.warnings.join(" ")).toContain("edge");
  });

  it("skips degenerate and out-of-range faces, and warns once", () => {
    const ids = createSequenceIdFactory("ply");
    const text = plyFile([
      "element vertex 3",
      "property float x",
      "property float y",
      "property float z",
      "element face 3",
      "property list uchar int vertex_indices",
      "end_header",
      "0 0 0",
      "1 0 0",
      "1 1 0",
      "3 0 1 2",
      "2 0 1",
      "3 0 1 99",
    ]);

    const { mesh, report } = importPlyWithReport(text, ids);
    expect(mesh.faces.size).toBe(1);
    const warnings = report.warnings.join(" ");
    expect(warnings).toContain("2 degenerate or out-of-range faces");
  });

  it("tolerates CRLF line endings and blank lines in the body", () => {
    const ids = createSequenceIdFactory("ply");
    const text = plyFile([
      "element vertex 3",
      "property float x",
      "property float y",
      "property float z",
      "element face 1",
      "property list uchar int vertex_indices",
      "end_header",
      "",
      "0 0 0",
      "1 0 0",
      "",
      "1 1 0",
      "3 0 1 2",
    ]).replace(/\n/g, "\r\n");

    expect(importPly(text, ids).faces.size).toBe(1);
  });

  it("rejects binary PLY, a missing header terminator, and a bad magic word", () => {
    const ids = createSequenceIdFactory("ply");
    expect(() => importPly("ply\nformat binary_little_endian 1.0\nend_header\n", ids)).toThrow(
      /ascii 1\.0/,
    );
    expect(() => importPly("ply\nformat ascii 1.0\nelement vertex 0\n", ids)).toThrow(/end_header/);
    expect(() => importPly("OFF\n1 0 0\n", ids)).toThrow(/magic word/);
  });

  it("rejects headers that cannot produce a mesh", () => {
    const ids = createSequenceIdFactory("ply");
    expect(() =>
      importPly(
        plyFile([
          "element vertex 1",
          "property float px",
          "property float py",
          "property float pz",
          "end_header",
          "0 0 0",
        ]),
        ids,
      ),
    ).toThrow(/x, y, and z/);

    expect(() =>
      importPly(
        plyFile([
          "element vertex 3",
          "property float x",
          "property float y",
          "property float z",
          "element face 1",
          "property list uchar int a",
          "property list uchar int b",
          "end_header",
          "0 0 0",
          "1 0 0",
          "1 1 0",
          "3 0 1 2",
          "3 0 1 2",
        ]),
        ids,
      ),
    ).toThrow(/exactly one list property/);
  });

  it("fails loudly on non-finite vertex coordinates", () => {
    const ids = createSequenceIdFactory("ply");
    const text = plyFile([
      "element vertex 2",
      "property float x",
      "property float y",
      "property float z",
      "end_header",
      "0 0 0",
      "nan 1 0",
    ]);
    // Dropping a vertex silently renumbers every later face index.
    expect(() => importPly(text, ids)).toThrow(/non-finite/);
  });

  it("respects an abort signal", () => {
    const ids = createSequenceIdFactory("ply");
    const controller = new AbortController();
    controller.abort();
    const cube = MeshBuilder.createCube(1, 1, 1, ids.mesh());
    expect(() => exportPly(cube, { signal: controller.signal })).toThrow();
    expect(() => importPly("ply\nformat ascii 1.0\nend_header\n", ids, { signal: controller.signal })).toThrow();
  });
});