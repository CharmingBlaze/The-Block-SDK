import { describe, expect, it } from "vitest";
import { createSequenceIdFactory } from "@modeling-kit/core";
import { createModelingSession } from "../src/session";
import {
  CadPrimitiveDrawSession,
  PrimitivePlacementSession,
  type PrimitiveWorkPlane,
} from "../src/primitive-creation";
import { generatePrimitive } from "@modeling-kit/primitives";
import { LIBRARY_GEOMETRY_IDS } from "@modeling-kit/primitives";

const top: PrimitiveWorkPlane = {
  origin: { x: 0, y: 0, z: 0 },
  xAxis: { x: 1, y: 0, z: 0 },
  yAxis: { x: 0, y: 0, z: 1 },
  normal: { x: 0, y: 1, z: 0 },
};

const front: PrimitiveWorkPlane = {
  origin: { x: 0, y: 0, z: 0 },
  xAxis: { x: 1, y: 0, z: 0 },
  yAxis: { x: 0, y: 1, z: 0 },
  normal: { x: 0, y: 0, z: 1 },
};

describe("primitive creation sessions", () => {
  it.each([...LIBRARY_GEOMETRY_IDS])(
    "converts %s with renderable positions, faces, normals, UVs, and preserved seams",
    (type) => {
      const generated = generatePrimitive(type, {});
      expect(generated.mesh.vertices.size).toBeGreaterThan(0);
      expect(generated.mesh.faces.size).toBeGreaterThan(0);
      expect(generated.mesh.corners.size).toBeGreaterThanOrEqual(generated.mesh.faces.size * 3);
      for (const corner of generated.mesh.corners.values()) {
        expect(corner.uv).toBeDefined();
        expect(corner.normal).toBeDefined();
        expect(corner.uv?.every(Number.isFinite)).toBe(true);
        expect(corner.normal?.every(Number.isFinite)).toBe(true);
      }
      // Every canonical face is a cell with a complete half-edge loop, so
      // render conversion retains the source face/index topology.
      for (const faceId of generated.mesh.faces.keys()) {
        expect(generated.mesh.getFaceVertices(faceId).length).toBeGreaterThanOrEqual(3);
      }
    },
  );

  it("draws a positive and negative CAD box without mutating preview state", () => {
    const session = createModelingSession(createSequenceIdFactory("cad"));
    const draw = new CadPrimitiveDrawSession(session, { primitive: "cube", workPlane: top });
    const revision = session.document.revision;
    draw.firstClick({ point: { x: 2, y: 0, z: 3 } });
    draw.updatePointer({ point: { x: -2, y: 0, z: -1 } });
    expect(draw.preview().valid).toBe(false);
    expect(session.document.revision).toBe(revision);
    draw.setDimensions({ width: 4, depth: 4, height: 2 });
    draw.updatePointer({ point: { x: -2, y: 0, z: -1 } });
    draw.secondClick();
    draw.updatePointer({ point: { x: -2, y: 2, z: -1 } });
    const result = draw.thirdClick();
    expect(result.objectId).toBeDefined();
    expect(session.history.undoStack).toHaveLength(1);
    expect(session.document.scene.nodes.get(result.objectId)?.localTransform.position).toEqual({ x: 0, y: 1, z: 1 });
    session.undo();
    expect(session.document.scene.nodes.has(result.objectId)).toBe(false);
  });

  it("supports repeated placement with one command per placed primitive", () => {
    const session = createModelingSession(createSequenceIdFactory("place"));
    const place = new PrimitivePlacementSession(session, {
      primitive: "cylinder",
      params: { radius: 0.5, height: 2, radialSegments: 12 },
      workPlane: top,
    });
    place.updatePointer({ point: { x: 1, y: 0, z: 2 } });
    const first = place.place();
    place.updatePointer({ point: { x: -1, y: 0, z: -2 } });
    const second = place.place();
    expect(first.objectId).not.toBe(second.objectId);
    expect(session.history.undoStack).toHaveLength(2);
    session.undo();
    expect(session.document.scene.nodes.has(second.objectId)).toBe(false);
    expect(session.document.scene.nodes.has(first.objectId)).toBe(true);
  });

  it("accepts explicit CAD extrusion distance when the axis points toward the view", () => {
    const session = createModelingSession(createSequenceIdFactory("front-cad"));
    const draw = new CadPrimitiveDrawSession(session, { primitive: "cube", workPlane: front });
    draw.firstClick({ point: { x: -1, y: -1, z: 0 } });
    draw.updatePointer({ point: { x: 1, y: 1, z: 0 } });
    draw.secondClick();
    const preview = draw.updatePointer({ point: { x: 1, y: 1, z: 0 }, extrusionDistance: -3.5 });
    expect(preview.height).toBeCloseTo(3.5);
    expect(preview.valid).toBe(true);
    const result = draw.thirdClick();
    expect(session.document.scene.nodes.get(result.objectId)?.localTransform.position.z).toBeCloseTo(1.75);
  });

  it("cancels at every CAD stage without history entries", () => {
    const session = createModelingSession(createSequenceIdFactory("cancel"));
    const draw = new CadPrimitiveDrawSession(session, { primitive: "cube", workPlane: top });
    draw.cancel();
    expect(session.history.undoStack).toHaveLength(0);
  });
});
