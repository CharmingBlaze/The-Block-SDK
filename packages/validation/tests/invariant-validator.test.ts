import { describe, it, expect } from "vitest";
import { brand } from "@modeling-kit/core";
import { MeshBuilder } from "@modeling-kit/mesh";
import { validateMeshInvariants } from "../src/mesh-validator";

describe("validateMeshInvariants", () => {
  it("should validate a clean mesh as valid", () => {
    const cube = MeshBuilder.createCube(1, 1, 1);
    const result = validateMeshInvariants(cube);
    
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.statistics.vertexCount).toBe(8);
    expect(result.statistics.faceCount).toBe(6);
    expect(result.statistics.isClosed).toBe(true);
    expect(result.statistics.isManifold).toBe(true);
  });

  it("should detect missing twin links", () => {
    const quad = MeshBuilder.createQuad(
      [0, 0, 0],
      [1, 0, 0],
      [1, 1, 0],
      [0, 1, 0]
    );
    
    // Corrupt a twin link by setting it to a non-existent half-edge ID
    const halfEdgeId = [...quad.halfEdges.keys()][0]!;
    const halfEdge = quad.halfEdges.get(halfEdgeId)!;
    // Create an invalid twin ID (doesn't exist in the mesh)
    const invalidTwinId = brand<string, "HalfEdgeId">("invalid_he");
    quad.halfEdges.set(halfEdgeId, { ...halfEdge, twin: invalidTwinId });
    
    const result = validateMeshInvariants(quad);
    expect(result.valid).toBe(false);
    // Should detect the corrupted twin link
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("should detect non-finite attribute values", () => {
    const quad = MeshBuilder.createQuad(
      [0, 0, 0],
      [1, 0, 0],
      [1, 1, 0],
      [0, 1, 0]
    );
    
    // Add a corner with non-finite UV
    const cornerId = [...quad.corners.keys()][0]!;
    const corner = quad.corners.get(cornerId)!;
    quad.corners.set(cornerId, { ...corner, uv: [Number.NaN, 0] });
    
    const result = validateMeshInvariants(quad);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === "NON_FINITE_ATTRIBUTE_VALUE")).toBe(true);
  });

  it("should detect orphaned corners", () => {
    const quad = MeshBuilder.createQuad(
      [0, 0, 0],
      [1, 0, 0],
      [1, 1, 0],
      [0, 1, 0]
    );
    
    // Remove a corner that a face references
    const faceId = [...quad.faces.keys()][0]!;
    const corners = quad.getFaceCorners(faceId);
    if (corners.length > 0) {
      quad.corners.delete(corners[0]!);
    }
    
    const result = validateMeshInvariants(quad);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === "ORPHANED_CORNER")).toBe(true);
  });
});