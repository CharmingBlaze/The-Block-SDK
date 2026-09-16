import { SchemaError } from "@modeling-kit/core";
import type { MeshBuilder } from "@modeling-kit/mesh";
import type { CellSpec } from "./convert-types";
import { reverseCell } from "./orient";

export function addConvertedFaces(
  builder: MeshBuilder,
  faces: readonly CellSpec[],
  smooth: boolean,
  type: string,
): void {
  for (const face of faces) {
    const first = tryAddFace(builder, face, smooth);
    if (first === "ok") {
      continue;
    }
    if (first === "degenerate") {
      continue;
    }
    const reversed = tryAddFace(builder, reverseCell(face), smooth);
    if (reversed === "ok") {
      continue;
    }
    if (reversed === "degenerate") {
      continue;
    }
    throw new SchemaError(`${type}: a converted face could not be added after reversing winding`);
  }
}

function tryAddFace(builder: MeshBuilder, face: CellSpec, smooth: boolean): "ok" | "degenerate" | "winding" {
  try {
    builder.addFace(face.vertices, {
      uvs: face.uvs,
      ...(face.normals ? { normals: face.normals } : {}),
      isSmooth: smooth,
    });
    return "ok";
  } catch (error) {
    if (!(error instanceof RangeError)) {
      throw error;
    }
    const message = error.message;
    if (
      message.includes("zero area") ||
      message.includes("consecutive duplicate") ||
      message.includes("at least 3 unique") ||
      message.includes("first and last")
    ) {
      return "degenerate";
    }
    if (message.includes("already occupied") || message.includes("Directed edge")) {
      return "winding";
    }
    throw error;
  }
}
