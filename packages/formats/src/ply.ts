import type { IdFactory, VertexId } from "@modeling-kit/core";
import { MeshBuilder, type HalfEdgeMesh } from "@modeling-kit/mesh";
import { throwIfAborted, type IoCancelOptions } from "./cancel";
import { createConversionReport, type ConversionReport } from "./conversion";

/**
 * ASCII PLY (Stanford Polygon Format).
 *
 * Faces are written as index lists, so unlike STL an n-gon survives the round
 * trip instead of being triangulated. Binary PLY is rejected by design, the same
 * way binary STL is: it would add a byte-order and word-size matrix to a codec
 * whose value is being human-readable interchange.
 */
export interface PlyExportOptions extends IoCancelOptions {
  /** Written as a `comment` line after the `format` line. */
  readonly comment?: string | undefined;
}

export type PlyImportOptions = IoCancelOptions;

export interface PlyImportResult {
  readonly mesh: HalfEdgeMesh;
  readonly report: ConversionReport;
}

const PLY_SCALAR_TYPES = new Set([
  "char",
  "uchar",
  "int8",
  "uint8",
  "short",
  "ushort",
  "int16",
  "uint16",
  "int",
  "uint",
  "int32",
  "uint32",
  "float",
  "double",
  "float32",
  "float64",
]);

const PLY_IMPORT_LOSS = [
  "PLY interchange is geometry-only: no UVs, materials, groups, history, or branded IDs",
  "Binary PLY is rejected by design; convert to `format ascii 1.0` first",
] as const;

/**
 * Exports a HalfEdgeMesh into ASCII PLY text, preserving n-gon faces.
 */
export function exportPly(mesh: HalfEdgeMesh, options: PlyExportOptions = {}): string {
  return exportPlyWithReport(mesh, options).value;
}

export function exportPlyWithReport(
  mesh: HalfEdgeMesh,
  options: PlyExportOptions = {},
): { readonly value: string; readonly report: ConversionReport } {
  throwIfAborted(options.signal, "PLY export");

  // PLY indices are zero-based and reference the vertex rows in header order.
  const vMap = new Map<VertexId, number>();
  const vertexLines: string[] = [];
  for (const [vertexId, vertex] of mesh.vertices) {
    vMap.set(vertexId, vertexLines.length);
    vertexLines.push(`${vertex.position[0]} ${vertex.position[1]} ${vertex.position[2]}`);
  }

  const faceLines: string[] = [];
  let droppedFaces = 0;
  for (const face of mesh.faces.values()) {
    const indices = mesh.getFaceVertices(face.id).map((vertexId) => vMap.get(vertexId));
    if (indices.length < 3 || indices.some((index) => index === undefined)) {
      droppedFaces += 1;
      continue;
    }
    faceLines.push(`${indices.length} ${indices.join(" ")}`);
  }

  const warnings: string[] = [];
  if (droppedFaces > 0) {
    warnings.push(`${droppedFaces} degenerate or dangling faces were not written`);
  }

  const lines: string[] = [
    "ply",
    "format ascii 1.0",
    "comment Created by @modeling-kit/formats",
  ];
  if (options.comment) {
    lines.push(`comment ${options.comment.replace(/\r?\n/g, " ")}`);
  }
  lines.push(
    `element vertex ${vertexLines.length}`,
    "property float x",
    "property float y",
    "property float z",
    `element face ${faceLines.length}`,
    "property list uchar int vertex_indices",
    "end_header",
    ...vertexLines,
    ...faceLines,
  );

  return {
    value: `${lines.join("\n")}\n`,
    report: createConversionReport("ply", warnings, [
      "Native half-edge topology, history, selection, and branded IDs are not preserved",
      ...PLY_IMPORT_LOSS.slice(0, 1),
    ]),
  };
}

/** Describes what an export of `mesh` would lose, without producing text. */
export function plyExportReport(mesh: HalfEdgeMesh): ConversionReport {
  let ngonCount = 0;
  for (const face of mesh.faces.values()) {
    if (mesh.getFaceVertices(face.id).length > 3) {
      ngonCount += 1;
    }
  }
  const warnings: string[] = [];
  if (ngonCount > 0) {
    warnings.push(`${ngonCount} n-gon faces are preserved as PLY vertex lists (no triangulation)`);
  }
  return createConversionReport("ply", warnings, [
    "Native half-edge topology, history, selection, and branded IDs are not preserved",
    ...PLY_IMPORT_LOSS,
  ]);
}

export function importPly(text: string, ids: IdFactory, options: PlyImportOptions = {}): HalfEdgeMesh {
  return importPlyWithReport(text, ids, options).mesh;
}

interface PlyProperty {
  readonly kind: "scalar" | "list";
  readonly name: string;
}

interface PlyElement {
  readonly name: string;
  readonly count: number;
  readonly properties: PlyProperty[];
}

interface PlyHeader {
  readonly elements: readonly PlyElement[];
  /** Index of the first body line, i.e. the line after `end_header`. */
  readonly bodyStart: number;
  readonly sawAscii: boolean;
  readonly warnings: string[];
}

/** Parses the ASCII PLY header. Binary flavours are rejected by design. */
function readPlyHeader(lines: readonly string[]): PlyHeader {
  if ((lines[0] ?? "").trim().toLowerCase() !== "ply") {
    throw new RangeError("PLY import expects a file whose first line is the 'ply' magic word");
  }

  const warnings: string[] = [];
  const elements: PlyElement[] = [];
  let cursor = 1;
  let sawAscii = false;
  let current: PlyElement | undefined;

  while (cursor < lines.length) {
    const line = (lines[cursor] ?? "").trim();
    cursor += 1;
    if (line.length === 0) {
      continue;
    }
    if (line === "end_header") {
      return { elements, bodyStart: cursor, sawAscii, warnings };
    }
    if (line.startsWith("comment") || line.startsWith("obj_info")) {
      continue;
    }
    const tokens = line.split(/\s+/);
    const keyword = (tokens[0] ?? "").toLowerCase();
    if (keyword === "format") {
      const flavor = (tokens[1] ?? "").toLowerCase();
      if (flavor !== "ascii") {
        throw new RangeError(
          `PLY import supports 'format ascii 1.0' only, found 'format ${tokens[1] ?? "?"}'`,
        );
      }
      sawAscii = true;
      if ((tokens[2] ?? "").split(".")[0] !== "1") {
        warnings.push(`Unsupported PLY format version '${tokens[2] ?? ""}'; parsed as 1.0`);
      }
    } else if (keyword === "element") {
      const name = tokens[1];
      const count = Number(tokens[2]);
      if (!name || !Number.isInteger(count) || count < 0) {
        throw new RangeError(`Malformed PLY element declaration: '${line}'`);
      }
      current = { name, count, properties: [] };
      elements.push(current);
    } else if (keyword === "property") {
      if (!current) {
        throw new RangeError(`PLY property declared before any element: '${line}'`);
      }
      if (tokens[1] === "list") {
        const name = tokens[4];
        if (!name) {
          throw new RangeError(`Malformed PLY list property: '${line}'`);
        }
        current.properties.push({ kind: "list", name });
      } else {
        const type = (tokens[1] ?? "").toLowerCase();
        const name = tokens[2];
        if (!name) {
          throw new RangeError(`Malformed PLY property: '${line}'`);
        }
        if (!PLY_SCALAR_TYPES.has(type)) {
          throw new RangeError(`Unsupported PLY scalar property type '${tokens[1]}'`);
        }
        current.properties.push({ kind: "scalar", name });
      }
    } else {
      throw new RangeError(`Unexpected PLY header line: '${line}'`);
    }
  }

  throw new RangeError("PLY import is missing the 'end_header' line");
}

/** Validates that a parsed header can produce a mesh. */
function assertPlyHeaderUsable(header: PlyHeader): void {
  const { elements, sawAscii } = header;
  if (!sawAscii) {
    throw new RangeError("PLY import requires a 'format ascii 1.0' header line");
  }
  const vertex = elements.find((element) => element.name.toLowerCase() === "vertex");
  if (vertex) {
    const names = vertex.properties
      .filter((property) => property.kind === "scalar")
      .map((property) => property.name);
    for (const axis of ["x", "y", "z"] as const) {
      if (!names.includes(axis)) {
        throw new RangeError("PLY 'vertex' element must declare scalar properties x, y, and z");
      }
    }
  }
  for (const element of elements) {
    if (element.name.toLowerCase() !== "face") {
      continue;
    }
    const lists = element.properties.filter((property) => property.kind === "list");
    if (lists.length !== 1) {
      throw new RangeError(`PLY 'face' element needs exactly one list property, found ${lists.length}`);
    }
  }
}

/**
 * Reads an ASCII PLY file into a half-edge mesh.
 *
 * Rows are collected first and the mesh built afterwards, so a file that declares
 * `element face` before `element vertex` cannot silently renumber references. Each
 * vertex row becomes exactly one kernel vertex, which is what lets PLY round-trip
 * shared topology instead of exploding into a triangle soup.
 */
export function importPlyWithReport(
  text: string,
  ids: IdFactory,
  options: PlyImportOptions = {},
): PlyImportResult {
  throwIfAborted(options.signal, "PLY import");
  const lines = text.split(/\r?\n/);
  const header = readPlyHeader(lines);
  assertPlyHeaderUsable(header);
  const warnings = [...header.warnings];

  // A row is self-delimiting once the header is known, so the body is read as one
  // flat token stream: padding and line breaks cannot desynchronise it.
  const body: string[] = [];
  for (let index = header.bodyStart; index < lines.length; index += 1) {
    const line = (lines[index] ?? "").trim();
    if (line.length > 0) {
      body.push(...line.split(/\s+/));
    }
  }
  let at = 0;
  const next = (context: string): string => {
    const token = body[at];
    if (token === undefined) {
      throw new RangeError(`PLY body ended early while reading ${context}`);
    }
    at += 1;
    return token;
  };

  const positions: Array<[number, number, number]> = [];
  const faceLists: number[][] = [];
  let tookVertexElement = false;
  let tookFaceElement = false;

  for (const element of header.elements) {
    const kind = element.name.toLowerCase();
    const isVertex = kind === "vertex";
    const isFace = kind === "face";
    let collect = false;
    if (isVertex && !tookVertexElement) {
      tookVertexElement = true;
      collect = true;
    } else if (isFace && !tookFaceElement) {
      tookFaceElement = true;
      collect = true;
    } else if (!isVertex && !isFace) {
      warnings.push(`Skipped PLY element '${element.name}' (${element.count} rows): unsupported`);
    } else {
      warnings.push(`Only the first '${kind}' element is used; '${element.name}' rows were skipped`);
    }

    if (collect && isVertex) {
      const extras = element.properties
        .filter((property) => property.kind === "scalar" && !["x", "y", "z"].includes(property.name))
        .map((property) => property.name);
      if (extras.length > 0) {
        warnings.push(`Dropped per-vertex PLY properties: ${extras.join(", ")}`);
      }
    }

    for (let row = 0; row < element.count; row += 1) {
      const scalars = new Map<string, number>();
      let indices: number[] | undefined;
      for (const property of element.properties) {
        if (property.kind === "list") {
          const length = Number(next(`the list length of PLY element '${element.name}'`));
          if (!Number.isInteger(length) || length < 0) {
            throw new RangeError(`PLY element '${element.name}' has a malformed list length`);
          }
          const values: number[] = [];
          for (let entry = 0; entry < length; entry += 1) {
            values.push(Number(next(`a '${property.name}' entry of PLY element '${element.name}'`)));
          }
          indices = values;
        } else {
          scalars.set(property.name, Number(next(`'${property.name}' of PLY element '${element.name}'`)));
        }
      }
      if (!collect) {
        continue;
      }
      if (isVertex) {
        const x = scalars.get("x") ?? Number.NaN;
        const y = scalars.get("y") ?? Number.NaN;
        const z = scalars.get("z") ?? Number.NaN;
        if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
          // Dropping a vertex would shift every later index, so fail loudly.
          throw new RangeError(`PLY vertex row ${row} has non-finite or missing coordinates`);
        }
        positions.push([x, y, z]);
      } else if (isFace) {
        faceLists.push(indices ?? []);
      }
    }
  }

  const builder = new MeshBuilder(ids.mesh());
  const created: VertexId[] = [];
  for (const [x, y, z] of positions) {
    created.push(builder.addVertex(x, y, z, ids.vertex()));
  }

  let skipped = 0;
  for (const indices of faceLists) {
    throwIfAborted(options.signal, "PLY import");
    const unique = new Set<number>();
    let valid = indices.length >= 3;
    for (const index of indices) {
      if (!Number.isInteger(index) || index < 0 || index >= created.length) {
        valid = false;
        break;
      }
      unique.add(index);
    }
    if (unique.size < 3) {
      valid = false;
    }
    if (!valid) {
      skipped += 1;
      continue;
    }
    builder.addFace(
      indices.map((index) => created[index]!),
      { id: ids.face() },
    );
  }
  if (skipped > 0) {
    warnings.push(`${skipped} degenerate or out-of-range faces were not imported`);
  }
  if (positions.length === 0) {
    warnings.push("PLY file declared no vertices");
  }

  return {
    mesh: builder.getMesh(),
    report: createConversionReport("ply", warnings, [...PLY_IMPORT_LOSS]),
  };
}