import { brand } from "@modeling-kit/core";
import { MeshBuilder } from "@modeling-kit/mesh";
import { describe, expect, it } from "vitest";
import { SelectionManager } from "../src/index";

function grid2x2() {
  const builder = new MeshBuilder();
  const v: ReturnType<typeof builder.addVertex>[][] = [];
  for (let z = 0; z < 3; z++) {
    const row: ReturnType<typeof builder.addVertex>[] = [];
    for (let x = 0; x < 3; x++) {
      row.push(builder.addVertex(x, 0, z));
    }
    v.push(row);
  }
  const faces = [
    builder.addFace([v[0]![0]!, v[0]![1]!, v[1]![1]!, v[1]![0]!]),
    builder.addFace([v[0]![1]!, v[0]![2]!, v[1]![2]!, v[1]![1]!]),
    builder.addFace([v[1]![0]!, v[1]![1]!, v[2]![1]!, v[2]![0]!]),
    builder.addFace([v[1]![1]!, v[1]![2]!, v[2]![2]!, v[2]![1]!]),
  ];
  return { mesh: builder.getMesh(), faces };
}

describe("selection topology", () => {
  it("inverts cube faces and selects all vertices", () => {
    const mesh = MeshBuilder.createCube(1, 1, 1);
    const selection = new SelectionManager();
    const first = [...mesh.faces.keys()][0]!;
    selection.replace({ domain: "face", objectIds: [brand("o")], elementIds: [first] });
    selection.invert(mesh);
    expect(selection.elementIds).toHaveLength(5);
    expect(selection.elementIds).not.toContain(first);
    selection.replace({ domain: "vertex", objectIds: [brand("o")], elementIds: [] });
    selection.selectAll(mesh);
    expect(selection.elementIds).toHaveLength(8);
  });

  it("grows and shrinks a cube face selection", () => {
    const mesh = MeshBuilder.createCube(1, 1, 1);
    const selection = new SelectionManager();
    const first = [...mesh.faces.keys()][0]!;
    selection.replace({ domain: "face", objectIds: [brand("o")], elementIds: [first] });
    selection.grow(mesh);
    expect(selection.elementIds).toHaveLength(5);
    expect(selection.elementIds).toContain(first);
    selection.shrink(mesh);
    expect(selection.elementIds).toEqual([first]);
  });

  it("selects linked faces on a cube and not across disconnected islands", () => {
    const cube = MeshBuilder.createCube(1, 1, 1);
    const selection = new SelectionManager();
    selection.replace({
      domain: "face",
      objectIds: [brand("o")],
      elementIds: [[...cube.faces.keys()][0]!],
    });
    selection.selectLinked(cube);
    expect(selection.elementIds).toHaveLength(6);

    const builder = new MeshBuilder();
    const a = builder.addVertex(0, 0, 0);
    const b = builder.addVertex(1, 0, 0);
    const c = builder.addVertex(0, 1, 0);
    const d = builder.addVertex(10, 0, 0);
    const e = builder.addVertex(11, 0, 0);
    const f = builder.addVertex(10, 1, 0);
    const f0 = builder.addFace([a, b, c]);
    builder.addFace([d, e, f]);
    const islands = builder.getMesh();
    selection.replace({ domain: "face", objectIds: [brand("o")], elementIds: [f0] });
    selection.selectLinked(islands);
    expect(selection.elementIds).toEqual([f0]);
  });

  it("selects a closed quad edge loop on a 2x2 grid", () => {
    const { mesh } = grid2x2();
    const interior = [...mesh.edges.keys()].find((edgeId) => {
      const [f1, f2] = mesh.getEdgeFaces(edgeId);
      return Boolean(f1 && f2);
    })!;
    const selection = new SelectionManager();
    selection.replace({ domain: "edge", objectIds: [brand("o")], elementIds: [interior] });
    selection.selectEdgeLoop(mesh);
    expect(selection.elementIds.length).toBeGreaterThanOrEqual(2);
  });

  it("selects boundary edges of a plane quad", () => {
    const mesh = MeshBuilder.createQuad([0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]);
    const selection = new SelectionManager();
    selection.replace({ domain: "edge", objectIds: [brand("o")], elementIds: [] });
    selection.selectBoundary(mesh);
    expect(selection.elementIds).toHaveLength(4);
  });

  it("does not change object-domain snapshots on grow", () => {
    const mesh = MeshBuilder.createCube(1, 1, 1);
    const selection = new SelectionManager();
    selection.replace({ domain: "object", objectIds: [brand("obj")] });
    const snap = selection.snapshot();
    selection.grow(mesh);
    expect(selection.snapshot()).toEqual(snap);
  });

  it("selects vertices inside a screen box and lasso", () => {
    const mesh = MeshBuilder.createCube(2, 2, 2);
    const selection = new SelectionManager();
    selection.replace({ domain: "vertex", objectIds: [brand("o")], elementIds: [] });
    selection.selectBox(mesh, -1.1, -1.1, 1.1, 1.1, {
      project: (x, y) => [x, y],
    });
    expect(selection.elementIds.length).toBeGreaterThan(0);
    selection.selectLasso(mesh, [[-2, -2], [2, -2], [2, 2], [-2, 2]], {
      project: (x, y) => [x, y],
    });
    expect(selection.elementIds.length).toBeGreaterThan(0);
  });

  it("grows coplanar faces across a planar grid", () => {
    const { mesh, faces } = grid2x2();
    const selection = new SelectionManager();
    selection.replace({ domain: "face", objectIds: [brand("o")], elementIds: [faces[0]!] });
    selection.selectCoplanar(mesh);
    expect(selection.elementIds).toHaveLength(4);
  });

  it("selects faces that share a material slot", () => {
    const mesh = MeshBuilder.createCube(1, 1, 1);
    const faces = [...mesh.faces.keys()];
    mesh.faces.get(faces[0]!)!.materialSlot = 1;
    mesh.faces.get(faces[1]!)!.materialSlot = 1;
    const selection = new SelectionManager();
    selection.replace({ domain: "face", objectIds: [brand("o")], elementIds: [faces[0]!] });
    selection.selectSimilarMaterial(mesh);
    expect(selection.elementIds.sort()).toEqual([faces[0]!, faces[1]!].sort());
  });
});
