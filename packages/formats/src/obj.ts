import type { FaceId, IdFactory, VertexId } from "@modeling-kit/core";
import { MeshBuilder, faceNormal, type HalfEdgeMesh } from "@modeling-kit/mesh";
import { throwIfAborted } from "./cancel";
import { createConversionReport, type ConversionReport } from "./conversion";

export interface ObjIoResult<T> {
  readonly value: T;
  readonly report: ConversionReport;
}

const OBJ_LOSS = [
  "OBJ interchange is geometry-only: no materials, PBR, history, or branded IDs",
] as const;

export interface ObjExportOptions {
  readonly objectName?: string | undefined;
  readonly signal?: AbortSignal;
}

export interface ObjImportOptions {
  readonly signal?: AbortSignal;
}

/**
 * Exports a HalfEdgeMesh into Wavefront OBJ format text.
 */
export function exportObj(mesh: HalfEdgeMesh, options: ObjExportOptions = {}): string {
  return exportObjWithReport(mesh, options).value;
}

export function exportObjWithReport(
  mesh: HalfEdgeMesh,
  options: ObjExportOptions = {},
): ObjIoResult<string> {
  throwIfAborted(options.signal, "OBJ export");
  const lines: string[] = [];
  lines.push(`# Exported by @modeling-kit/formats`);
  if (options.objectName) {
    lines.push(`o ${options.objectName}`);
  }

  // Map VertexId to 1-based index in OBJ
  const vMap = new Map<VertexId, number>();
  let vIndex = 1;
  for (const [vId, v] of mesh.vertices) {
    vMap.set(vId, vIndex++);
    lines.push(`v ${v.position[0]} ${v.position[1]} ${v.position[2]}`);
  }

  // Export vertex normals
  let vnIndex = 1;
  const fNormalMap = new Map<FaceId, number>();
  for (const [fId] of mesh.faces) {
    try {
      const norm = faceNormal(mesh, fId);
      lines.push(`vn ${norm.x} ${norm.y} ${norm.z}`);
      fNormalMap.set(fId, vnIndex++);
    } catch {
      // Degenerate face
    }
  }

  // Export faces
  for (const [fId] of mesh.faces) {
    const vIds = mesh.getFaceVertices(fId);
    if (vIds.length < 3) continue;

    const vn = fNormalMap.get(fId);
    const tokens = vIds.map((vId) => {
      const idx = vMap.get(vId)!;
      return vn !== undefined ? `${idx}//${vn}` : `${idx}`;
    });

    lines.push(`f ${tokens.join(" ")}`);
  }

  return {
    value: lines.join("\n"),
    report: createConversionReport("obj", [], OBJ_LOSS),
  };
}

/**
 * Parses Wavefront OBJ format text into a HalfEdgeMesh.
 */
export function importObj(
  objText: string,
  ids: IdFactory,
  options: ObjImportOptions = {},
): HalfEdgeMesh {
  return importObjWithReport(objText, ids, options).value;
}

export function importObjWithReport(
  objText: string,
  ids: IdFactory,
  options: ObjImportOptions = {},
): ObjIoResult<HalfEdgeMesh> {
  throwIfAborted(options.signal, "OBJ import");
  const builder = new MeshBuilder(ids.mesh());
  const vertices: VertexId[] = [];

  const lines = objText.split(/\r?\n/);
  for (const line of lines) {
    throwIfAborted(options.signal, "OBJ import");
    const trimmed = line.trim();
    if (trimmed.startsWith("#") || trimmed.length === 0) continue;

    const parts = trimmed.split(/\s+/);
    const tag = parts[0];

    if (tag === "v") {
      const x = parseFloat(parts[1]!);
      const y = parseFloat(parts[2]!);
      const z = parseFloat(parts[3]!);
      const vId = ids.vertex();
      builder.addVertex(x, y, z, vId);
      vertices.push(vId);
    } else if (tag === "f") {
      const faceVertexIds: VertexId[] = [];
      for (let i = 1; i < parts.length; i++) {
        const token = parts[i]!;
        // Token can be v, v/vt, v/vt/vn, or v//vn
        const vIndexStr = token.split("/")[0]!;
        let vIdx = parseInt(vIndexStr, 10);
        if (vIdx < 0) {
          // Negative relative index
          vIdx = vertices.length + vIdx;
        } else {
          vIdx = vIdx - 1; // 1-based to 0-based
        }
        const vId = vertices[vIdx];
        if (vId) faceVertexIds.push(vId);
      }
      if (faceVertexIds.length >= 3) {
        builder.addFace(faceVertexIds, { id: ids.face() });
      }
    }
  }

  return {
    value: builder.getMesh(),
    report: createConversionReport("obj", [], OBJ_LOSS),
  };
}
