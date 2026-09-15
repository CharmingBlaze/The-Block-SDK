import { createSequenceIdFactory } from "@modeling-kit/core";
import { brand } from "@modeling-kit/core";
import { MeshBuilder } from "@modeling-kit/mesh";
import { describe, expect, it } from "vitest";
import { insetFaces } from "../src/inset";
import { subdivideFaces } from "../src/subdivide";
import { weldVertices } from "../src/weld";
import { bridgeLoops } from "../src/bridge";
import { bevelEdges } from "../src/bevel";
import { dissolveEdges } from "../src/dissolve";
import { loopCut } from "../src/loop-cut";
import { ToolManager } from "../src/tool-manager";
import { KnifeTool } from "../src/knife-tool";
import { MergeTool, LoopCutTool, ExtrudeTool, BevelTool } from "../src/modal-tools";
import { keyPacket } from "@modeling-kit/input";

describe("@modeling-kit/tools", () => {
  it("insets a face on a cube creating an inner cap and ring quads", () => {
    const ids = createSequenceIdFactory("tool");
    const cube = MeshBuilder.createCube(2, 2, 2, ids.mesh());
    const topFace = [...cube.faces.keys()][2]!;

    const initialFaceCount = cube.faces.size; // 6
    const result = insetFaces(cube, [topFace], 0.2, ids);

    // Initial 6 faces - 1 face + 1 inner cap + 4 ring quads = 10 faces
    expect(cube.faces.size).toBe(initialFaceCount + 4);
    expect(result.innerFaceIds).toHaveLength(1);
    expect(result.ringFaceIds).toHaveLength(4);

    // Mesh should remain manifold without boundary edges
    expect(cube.findBoundaryEdges()).toHaveLength(0);
  });

  it("subdivides a quad face into 4 quads", () => {
    const ids = createSequenceIdFactory("sub");
    const quad = MeshBuilder.createQuad([-1, 0, -1], [1, 0, -1], [1, 0, 1], [-1, 0, 1], ids.mesh());
    expect(quad.faces.size).toBe(1);

    const targetFace = [...quad.faces.keys()][0]!;
    const result = subdivideFaces(quad, [targetFace], ids);

    expect(result.newFaceIds).toHaveLength(4);
    expect(quad.faces.size).toBe(4);
  });

  it("welds coincident vertices within distance epsilon", () => {
    const ids = createSequenceIdFactory("weld");
    const quad1 = MeshBuilder.createQuad([0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1], ids.mesh());

    // Add another quad sharing the edge [1, 0, 0] to [1, 0, 1] with duplicate vertices
    const builder = MeshBuilder.fromMesh(quad1);
    const v4 = builder.addVertex(1.0001, 0, 0, ids.vertex());
    const v5 = builder.addVertex(2, 0, 0, ids.vertex());
    const v6 = builder.addVertex(2, 0, 1, ids.vertex());
    const v7 = builder.addVertex(1.0001, 0, 1, ids.vertex());
    builder.addFace([v4, v5, v6, v7], { id: ids.face() });

    expect(quad1.vertices.size).toBe(8);

    const weldResult = weldVertices(quad1, 0.01, ids);
    expect(weldResult.weldedCount).toBe(2);
    expect(quad1.vertices.size).toBe(6);
  });

  it("bridges two boundary loops into quad faces", () => {
    const ids = createSequenceIdFactory("bridge");
    const builder = new MeshBuilder(ids.mesh());

    // Loop A (square at y = 0)
    const a0 = builder.addVertex(-1, 0, -1, ids.vertex());
    const a1 = builder.addVertex(1, 0, -1, ids.vertex());
    const a2 = builder.addVertex(1, 0, 1, ids.vertex());
    const a3 = builder.addVertex(-1, 0, 1, ids.vertex());

    // Loop B (square at y = 2)
    const b0 = builder.addVertex(-1, 2, -1, ids.vertex());
    const b1 = builder.addVertex(1, 2, -1, ids.vertex());
    const b2 = builder.addVertex(1, 2, 1, ids.vertex());
    const b3 = builder.addVertex(-1, 2, 1, ids.vertex());

    const mesh = builder.getMesh();
    const result = bridgeLoops(mesh, [a0, a1, a2, a3], [b0, b1, b2, b3], ids);

    expect(result.bridgeFaceIds).toHaveLength(4);
    expect(mesh.faces.size).toBe(4);
  });

  it("loop-cuts a cube belt into ten faces", () => {
    const ids = createSequenceIdFactory("cut");
    const cube = MeshBuilder.createCube(2, 2, 2, ids.mesh());
    const startEdge = [...cube.edges.keys()][0]!;
    const result = loopCut(cube, startEdge, 0.5, ids);
    expect(result.loopEdgeIds).toHaveLength(4);
    expect(result.newFaceIds).toHaveLength(8);
    expect(cube.faces.size).toBe(10);
    expect(cube.findBoundaryEdges()).toHaveLength(0);
  });

  it("previews a Blender-style loop cut and slides the factor", () => {
    const ids = createSequenceIdFactory("loop-tool");
    const cube = MeshBuilder.createCube(2, 2, 2, ids.mesh());
    const startEdge = [...cube.edges.keys()][0]!;
    const tool = new LoopCutTool();
    tool.activate();
    tool.setHoverEdge(startEdge);
    tool.addCut();
    expect(tool.cuts).toBe(2);
    const preview = tool.preview(cube);
    expect(preview?.factors).toHaveLength(2);
    expect(cube.faces.size).toBe(6);
    tool.removeCut();
    expect(tool.beginSlide()).toBe(true);
    expect(tool.phase).toBe("slide");
    const ends = cube.getEdgeVertices(startEdge)!;
    const a = cube.vertices.get(ends[0])!.position;
    const b = cube.vertices.get(ends[1])!.position;
    tool.slideTo(cube, [
      a[0] + (b[0] - a[0]) * 0.25,
      a[1] + (b[1] - a[1]) * 0.25,
      a[2] + (b[2] - a[2]) * 0.25,
    ]);
    expect(tool.factor).toBeCloseTo(0.25);
    expect(tool.commitParams()?.startEdgeId).toBe(startEdge);
    const fingerprint = cube.faces.size;
    expect(tool.preview(cube)?.segments.length).toBeGreaterThan(0);
    expect(cube.faces.size).toBe(fingerprint);
    const params = tool.takeParams();
    expect(params?.startEdgeId).toBe(startEdge);
    expect(tool.commitParams()).toBeNull();
  });

  it("bevels a cube edge into a chamfer", () => {
    const ids = createSequenceIdFactory("bevel");
    const cube = MeshBuilder.createCube(2, 2, 2, ids.mesh());
    const edgeId = [...cube.edges.keys()][0]!;
    const result = bevelEdges(cube, [edgeId], 0.2, ids);
    expect(result.chamferFaceIds).toHaveLength(1);
    expect(result.remainingFaceIds).toHaveLength(2);
    expect(cube.faces.size).toBe(7);
    expect(cube.findBoundaryEdges()).toHaveLength(0);
  });

  it("dissolves a cube edge into a hexagon", () => {
    const ids = createSequenceIdFactory("diss");
    const cube = MeshBuilder.createCube(2, 2, 2, ids.mesh());
    const edgeId = [...cube.edges.keys()][0]!;
    const result = dissolveEdges(cube, [edgeId], ids);
    expect(result.faceIds).toHaveLength(1);
    expect(cube.faces.size).toBe(5);
    expect(cube.getFaceVertices(result.faceIds[0]!).length).toBe(6);
    expect(cube.findBoundaryEdges()).toHaveLength(0);
  });

  it("lets one tool claim a pointer through the coordinator", () => {
    const manager = new ToolManager();
    const claims: string[] = [];
    manager.register({
      id: brand("select"),
      label: "Select",
      activate() {},
      deactivate() {},
      gestureBegin(gesture) {
        claims.push(gesture.action);
        return {
          owner: "select",
          pointerIds: [gesture.pointerId],
          priority: 1,
          capturePointer: true,
          preventDefault: true,
        };
      },
    });
    manager.activate(brand("select"));
    const claim = manager.beginGesture({
      action: "transform.slide",
      pointerId: 1,
      pointerKind: "mouse",
      startCanvas: { x: 0, y: 0 },
      startNdc: { x: 0, y: 0 },
      canvas: { x: 1, y: 0 },
      ndc: { x: 0, y: 0 },
      deltaCanvas: { x: 1, y: 0 },
      deltaNdc: { x: 0, y: 0 },
      pressure: 1,
      modifiers: { alt: false, ctrl: false, meta: false, shift: true },
    });
    expect(claim?.capturePointer).toBe(true);
    expect(manager.coordinator.activeOwner).toBe("select");
    expect(claims).toEqual(["transform.slide"]);
  });

  it("collects knife hits and consumes confirm only with two points", () => {
    const tool = new KnifeTool();
    const ctx = { toolId: tool.id };
    tool.activate(ctx);
    expect(tool.points).toHaveLength(0);
    tool.addHit([0, 0, 0]);
    tool.addHit([0, 0, 0]);
    expect(tool.points).toHaveLength(1);
    tool.addHit([1, 0, 0]);
    expect(tool.points).toHaveLength(2);
    const confirm = tool.action(
      { action: "tool.confirm", packet: keyPacket({ kind: "keydown", code: "Enter" }) },
      ctx,
    );
    expect(confirm.consumed).toBe(true);
    const cancel = tool.action(
      { action: "tool.cancel", packet: keyPacket({ kind: "keydown", code: "Escape" }) },
      ctx,
    );
    expect(cancel.consumed).toBe(true);
    expect(tool.points).toHaveLength(0);
  });

  it("snaps knife hits to nearby vertices and builds guide segments", () => {
    const ids = createSequenceIdFactory("knife-snap");
    const cube = MeshBuilder.createCube(2, 2, 2, ids.mesh());
    const corner = [...cube.vertices.values()][0]!.position;
    const tool = new KnifeTool();
    tool.activate({ toolId: tool.id });
    tool.addHit([corner[0], corner[1], corner[2]], { mesh: cube, snapRadius: 0.2 });
    expect(tool.points[0]?.[0]).toBeCloseTo(corner[0]);
    expect(tool.points[0]?.[1]).toBeCloseTo(corner[1]);
    expect(tool.points[0]?.[2]).toBeCloseTo(corner[2]);
    const other = [...cube.vertices.values()][1]!.position;
    tool.addHit([other[0], other[1], other[2]], { mesh: cube });
    expect(tool.guideSegments()).toHaveLength(1);
    const hover = tool.overlayState([0, 1, 0]);
    expect(hover.vertices).toHaveLength(2);
    expect(hover.segments).toHaveLength(2);
    expect(hover.cursor?.[1]).toBe(1);
    const preview = tool.previewPoint([corner[0], corner[1], corner[2]], { mesh: cube });
    expect(preview[0]).toBeCloseTo(corner[0]);
    const stroke = tool.takeStroke();
    expect(stroke).toHaveLength(2);
    expect(tool.points).toHaveLength(0);
    expect(tool.session.state).toBe("idle");
  });

  it("lets MergeTool confirm and cancel", () => {
    const tool = new MergeTool();
    tool.activate();
    expect(tool.epsilon).toBe(1e-6);
    expect(
      tool.action({ action: "tool.confirm", packet: keyPacket({ kind: "keydown", code: "Enter" }) })
        .consumed,
    ).toBe(true);
    tool.epsilon = 0.5;
    expect(
      tool.action({ action: "tool.cancel", packet: keyPacket({ kind: "keydown", code: "Escape" }) })
        .consumed,
    ).toBe(true);
    expect(tool.epsilon).toBe(1e-6);
  });

  it("aborts the active tool and drops pointer claims on dispose", () => {
    const manager = new ToolManager();
    const knife = new KnifeTool();
    manager.register(knife);
    manager.activate(knife.id);
    knife.addHit([0, 0, 0]);
    knife.addHit([1, 0, 0]);
    expect(knife.points).toHaveLength(2);
    manager.dispose();
    expect(knife.points).toHaveLength(0);
    expect(manager.coordinator.activeOwner).toBeNull();
    expect(() => manager.activate(knife.id)).toThrow(/disposed/);
  });

  it("slides extrude and bevel previews without mutating a mesh", () => {
    const ids = createSequenceIdFactory("modal-preview");
    const cube = MeshBuilder.createCube(2, 2, 2, ids.mesh());
    const faces = cube.faces.size;
    const extrude = new ExtrudeTool();
    extrude.activate();
    extrude.slide(1.5);
    expect(extrude.distance).toBeCloseTo(2);
    expect(cube.faces.size).toBe(faces);
    expect(extrude.takeParams()?.distance).toBeCloseTo(2);
    extrude.action({ action: "tool.cancel", packet: keyPacket({ kind: "keydown", code: "Escape" }) });
    expect(extrude.distance).toBe(0.5);

    const bevel = new BevelTool();
    bevel.activate();
    bevel.slide(0.2);
    expect(bevel.offset).toBeGreaterThan(0.1);
    expect(cube.faces.size).toBe(faces);
    expect(bevel.takeParams()?.offset).toBeGreaterThan(0.1);
  });
});
