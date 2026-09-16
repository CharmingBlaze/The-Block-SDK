import { describe, expect, it } from "vitest";
import { createEditor, createModelingSession } from "../src/index";

describe("FluentEditor", () => {
  it("chains spawn, tagged select, extrude, and inset", () => {
    const editor = createEditor();
    const stool = editor.spawn
      .cylinder({ radius: 1.2, height: 0.2, name: "Stool" })
      .select("bottom")
      .extrude(0.1)
      .inset(0.15);

    expect(stool.mesh?.faces.size).toBeGreaterThan(18);
    const inspection = editor.inspect();
    const object = inspection.objects[0];
    expect(object?.name).toBe("Stool");
    expect(object?.faces).toBe(stool.mesh?.faces.size);
    expect(object?.selected?.domain).toBe("face");
    expect(object?.selected?.count).toBeGreaterThan(0);
    expect(inspection.canUndo).toBe(true);
    expect(inspection.summary).toContain("Objects: 1");
    expect(inspection.summary).toContain("Undo: true");
  });

  it("moves the object through editor.selection and restores with undo/redo", () => {
    const editor = createEditor();
    const cube = editor.spawn.cube({ size: 1 });
    cube.selectObject();
    editor.selection.move({ y: 0.5 });
    const node = editor.session.document.scene.nodes.get(cube.objectId);
    expect(node?.localTransform.position.y).toBeCloseTo(0.5);

    editor.undo();
    expect(editor.session.document.scene.nodes.get(cube.objectId)?.localTransform.position.y).toBeCloseTo(0);
    editor.redo();
    expect(editor.session.document.scene.nodes.get(cube.objectId)?.localTransform.position.y).toBeCloseTo(0.5);
  });

  it("maps sphere() to uvSphere and torus tube params", () => {
    const editor = createEditor();
    const sphere = editor.spawn.sphere({ radius: 1, segments: 8, rings: 6 });
    expect(editor.session.document.meshes.get(sphere.meshId)?.name).toBe("UV Sphere");
    const torus = editor.spawn.torus({ radius: 1, tubeRadius: 0.25 });
    expect(torus.mesh?.faces.size).toBeGreaterThan(0);
  });

  it("selects cube left and right faces", () => {
    const editor = createEditor();
    const cube = editor.spawn.cube({ size: 1 });
    cube.select("right");
    expect(editor.session.selection.elementIds).toHaveLength(1);
    cube.select("left");
    expect(editor.session.selection.elementIds).toHaveLength(1);
  });

  it("unions multiple face tags in one selection", () => {
    const editor = createEditor();
    const cube = editor.spawn.cube({ size: 1 });
    cube.select(["top", "bottom"]);
    expect(editor.session.selection.elementIds).toHaveLength(2);
    expect(cube.faceIdsForTags(["top", "bottom"])).toHaveLength(2);
  });

  it("cuts a cube face with a fluent knife stroke", () => {
    const editor = createEditor();
    const cube = editor.spawn.cube({ size: 2 });
    const mesh = cube.mesh!;
    const faceId = [...mesh.faces.keys()][0]!;
    const edges = mesh.getFaceEdges(faceId);
    const mid = (edgeId: (typeof edges)[number]): [number, number, number] => {
      const ends = mesh.getEdgeVertices(edgeId)!;
      const a = mesh.vertices.get(ends[0])!.position;
      const b = mesh.vertices.get(ends[1])!.position;
      return [(a[0] + b[0]) * 0.5, (a[1] + b[1]) * 0.5, (a[2] + b[2]) * 0.5];
    };
    cube.selectObject();
    cube.knife([mid(edges[0]!), mid(edges[2]!)]);
    expect(mesh.faces.size).toBe(7);
    editor.undo();
    expect(mesh.faces.size).toBe(6);
  });

  it("knives a cylinder and loop-cuts a sphere", () => {
    const editor = createEditor();
    const cylinder = editor.spawn.cylinder({ radius: 1, height: 2, segments: 8 });
    const cylMesh = cylinder.mesh!;
    const side = [...cylMesh.faces.keys()].find((id) => cylMesh.getFaceVertices(id).length === 4)!;
    const edges = cylMesh.getFaceEdges(side);
    const mid = (edgeId: (typeof edges)[number]): [number, number, number] => {
      const ends = cylMesh.getEdgeVertices(edgeId)!;
      const a = cylMesh.vertices.get(ends[0])!.position;
      const b = cylMesh.vertices.get(ends[1])!.position;
      return [(a[0] + b[0]) * 0.5, (a[1] + b[1]) * 0.5, (a[2] + b[2]) * 0.5];
    };
    const before = cylMesh.faces.size;
    cylinder.selectObject().knife([mid(edges[0]!), mid(edges[2]!)]);
    expect(cylMesh.faces.size).toBeGreaterThan(before);

    const sphere = editor.spawn.sphere({ radius: 1, segments: 8, rings: 6 });
    const sphereMesh = sphere.mesh!;
    const belt = [...sphereMesh.edges.keys()].find((id) => {
      const [f1, f2] = sphereMesh.getEdgeFaces(id);
      return Boolean(
        f1 &&
          f2 &&
          sphereMesh.getFaceVertices(f1).length === 4 &&
          sphereMesh.getFaceVertices(f2).length === 4,
      );
    })!;
    const sphereFaces = sphereMesh.faces.size;
    sphere.selectObject().loopCut(0.5, { startEdgeId: belt });
    expect(sphereMesh.faces.size).toBeGreaterThan(sphereFaces);
  });

  it("spawns cube, cone, cylinder, pyramid, torus, uvSphere, icosphere, and capsule", () => {
    const editor = createEditor();
    const spawned = [
      editor.spawn.cube({ size: 1 }),
      editor.spawn.cone({ radius: 0.5, height: 1, segments: 8 }),
      editor.spawn.cylinder({ radius: 0.5, height: 1, segments: 8 }),
      editor.spawn.pyramid({ width: 1, depth: 1, height: 1 }),
      editor.spawn.torus({ radius: 1, tube: 0.25, radialSegments: 6, tubularSegments: 8 }),
      editor.spawn.uvSphere({ radius: 0.5, widthSegments: 8, heightSegments: 6 }),
      editor.spawn.icosphere({ radius: 0.5, subdivisions: 1 }),
      editor.spawn.capsule({ radius: 0.4, height: 1, segments: 8, capSegments: 4 }),
    ];
    expect(spawned).toHaveLength(8);
    for (const object of spawned) {
      expect(object.mesh?.faces.size).toBeGreaterThan(0);
    }
    const inspection = editor.inspect();
    expect(inspection.objects).toHaveLength(8);
    expect(inspection.objects.every((object) => object.isClosedManifold)).toBe(true);
  });

  it("triangulates selected cube faces", () => {
    const editor = createEditor();
    const cube = editor.spawn.cube({ size: 2 }).select("all");
    cube.triangulate();
    expect(cube.mesh?.faces.size).toBe(12);
    editor.undo();
    expect(cube.mesh?.faces.size).toBe(6);
  });

  it("disposes an owned session and leaves a borrowed session to the host", () => {
    const editor = createEditor();
    editor.spawn.cube({ size: 1 });
    editor.dispose();
    editor.dispose();
    expect(() => editor.spawn.cube({ size: 1 })).toThrow(/disposed/);

    const session = createModelingSession();
    const borrowed = createEditor(session);
    borrowed.spawn.cube({ size: 1 });
    borrowed.dispose();
    expect(session.canUndo).toBe(true);
    session.undo();
    session.dispose();
    expect(() => session.undo()).toThrow(/disposed/);
  });
});
