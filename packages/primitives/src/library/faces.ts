import { SchemaError, type FaceId } from "@modeling-kit/core";
import type { MeshBuilder } from "@modeling-kit/mesh";
import type { GeometryBuildWarning } from "../source/types";
import type { CellSpec } from "./convert-types";
import { reverseCell } from "./orient";

export function addConvertedFaces(
  builder: MeshBuilder,
  faces: readonly CellSpec[],
  smooth: boolean,
  type: string,
  skipDegenerateFaces: boolean,
): { sourceFaceToCanonicalFaceIds: readonly (readonly FaceId[])[]; warnings: GeometryBuildWarning[] } {
  const sourceFaceToCanonicalFaceIds: FaceId[][] = [];
  const warnings: GeometryBuildWarning[] = [];
  for (let i = 0; i < faces.length; i++) {
    const face = faces[i]!;
    const first = tryAddFace(builder, face, smooth);
    if (first.status === "ok") {
      sourceFaceToCanonicalFaceIds.push([first.faceId]);
      continue;
    }
    if (first.status === "degenerate") {
      if (!skipDegenerateFaces) {
        throw new SchemaError(`${type}: face ${i} is degenerate (${first.reason})`);
      }
      warnings.push({
        code: "degenerate-skipped",
        message: first.reason,
        sourceFaceIndex: i,
      });
      sourceFaceToCanonicalFaceIds.push([]);
      continue;
    }
    const reversed = tryAddFace(builder, reverseCell(face), smooth);
    if (reversed.status === "ok") {
      sourceFaceToCanonicalFaceIds.push([reversed.faceId]);
      warnings.push({
        code: "winding-reversed",
        message: "reversed winding to resolve an occupied directed edge",
        sourceFaceIndex: i,
      });
      continue;
    }
    if (reversed.status === "degenerate") {
      if (!skipDegenerateFaces) {
        throw new SchemaError(`${type}: face ${i} is degenerate after reversing winding`);
      }
      warnings.push({
        code: "degenerate-skipped",
        message: reversed.reason,
        sourceFaceIndex: i,
      });
      sourceFaceToCanonicalFaceIds.push([]);
      continue;
    }
    throw new SchemaError(`${type}: a converted face could not be added after reversing winding`);
  }
  return { sourceFaceToCanonicalFaceIds, warnings };
}

type TryAdd =
  | { status: "ok"; faceId: FaceId }
  | { status: "degenerate"; reason: string }
  | { status: "winding" };

function tryAddFace(builder: MeshBuilder, face: CellSpec, smooth: boolean): TryAdd {
  try {
    const faceId = builder.addFace(face.vertices, {
      uvs: face.uvs,
      ...(face.normals ? { normals: face.normals } : {}),
      isSmooth: smooth,
    });
    return { status: "ok", faceId };
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
      return { status: "degenerate", reason: message };
    }
    if (message.includes("already occupied") || message.includes("Directed edge")) {
      return { status: "winding" };
    }
    throw error;
  }
}
