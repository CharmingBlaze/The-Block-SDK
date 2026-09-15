import { triangulateMesh, MeshBuilder, type HalfEdgeMesh } from "@modeling-kit/mesh";
import type { IdFactory } from "@modeling-kit/core";
import { throwIfAborted, type IoCancelOptions } from "./cancel";
import { createConversionReport, triangulatedInterchangeLoss, type ConversionReport } from "./conversion";

export interface StlExportOptions extends IoCancelOptions {
  readonly solidName?: string | undefined;
}

export type StlImportOptions = IoCancelOptions;

export interface StlImportResult {
  readonly mesh: HalfEdgeMesh;
  readonly report: ConversionReport;
}

const STL_IMPORT_LOSS = [
  "ASCII STL is a triangle soup: no UVs, materials, groups, or shared topology",
  "Binary STL is rejected by design in Release 1.0",
] as const;

/**
 * Exports a HalfEdgeMesh into ASCII STL format.
 */
export function exportStlAscii(mesh: HalfEdgeMesh, options: StlExportOptions = {}): string {
  throwIfAborted(options.signal, "STL export");
  const solidName = options.solidName ?? "Solid";
  const triangulated = triangulateMesh(mesh);
  throwIfAborted(options.signal, "STL export");
  const { positions, normals, indices } = triangulated;

  const lines: string[] = [];
  lines.push(`solid ${solidName}`);

  const numTriangles = indices.length / 3;
  for (let i = 0; i < numTriangles; i++) {
    const idx0 = indices[i * 3]!;
    const idx1 = indices[i * 3 + 1]!;
    const idx2 = indices[i * 3 + 2]!;

    // Facet normal from first vertex
    const nx = normals[idx0 * 3] ?? 0;
    const ny = normals[idx0 * 3 + 1] ?? 0;
    const nz = normals[idx0 * 3 + 2] ?? 0;

    lines.push(`  facet normal ${nx} ${ny} ${nz}`);
    lines.push(`    outer loop`);
    lines.push(
      `      vertex ${positions[idx0 * 3]} ${positions[idx0 * 3 + 1]} ${positions[idx0 * 3 + 2]}`,
    );
    lines.push(
      `      vertex ${positions[idx1 * 3]} ${positions[idx1 * 3 + 1]} ${positions[idx1 * 3 + 2]}`,
    );
    lines.push(
      `      vertex ${positions[idx2 * 3]} ${positions[idx2 * 3 + 1]} ${positions[idx2 * 3 + 2]}`,
    );
    lines.push(`    endloop`);
    lines.push(`  endfacet`);
  }

  lines.push(`endsolid ${solidName}`);
  return lines.join("\n");
}

/**
 * Imports ASCII STL triangles as a triangle mesh. Binary STL is rejected.
 */
export function importStlAscii(
  text: string,
  ids: IdFactory,
  options: StlImportOptions = {},
): HalfEdgeMesh {
  return importStlAsciiWithReport(text, ids, options).mesh;
}

export function importStlAsciiWithReport(
  text: string,
  ids: IdFactory,
  options: StlImportOptions = {},
): StlImportResult {
  throwIfAborted(options.signal, "STL import");
  if (!/^solid\b/i.test(text.trimStart()) || text.includes("\0")) {
    throw new RangeError("STL import supports ASCII solids only");
  }
  const builder = new MeshBuilder(ids.mesh());
  const warnings: string[] = [];
  const vertexRe = /vertex\s+([^\s]+)\s+([^\s]+)\s+([^\s]+)/g;
  const facets = text.split(/facet\s+normal/i).slice(1);
  for (const facet of facets) {
    throwIfAborted(options.signal, "STL import");
    const verts: Array<[number, number, number]> = [];
    const chunk = facet.match(vertexRe);
    if (!chunk) {
      continue;
    }
    for (const line of chunk) {
      const m = /vertex\s+([^\s]+)\s+([^\s]+)\s+([^\s]+)/.exec(line);
      if (!m) {
        continue;
      }
      const x = Number(m[1]);
      const y = Number(m[2]);
      const z = Number(m[3]);
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
        warnings.push("Skipped vertex with non-finite coordinates");
        continue;
      }
      verts.push([x, y, z]);
    }
    if (verts.length > 3) {
      warnings.push("Facet with more than three vertices; using the first three");
    }
    if (verts.length < 3) {
      continue;
    }
    const a = builder.addVertex(verts[0]![0], verts[0]![1], verts[0]![2], ids.vertex());
    const b = builder.addVertex(verts[1]![0], verts[1]![1], verts[1]![2], ids.vertex());
    const c = builder.addVertex(verts[2]![0], verts[2]![1], verts[2]![2], ids.vertex());
    builder.addFace([a, b, c], { id: ids.face() });
  }
  return {
    mesh: builder.getMesh(),
    report: createConversionReport("stl", warnings, [...STL_IMPORT_LOSS]),
  };
}

export function stlExportReport(mesh: HalfEdgeMesh): ConversionReport {
  let ngonCount = 0;
  for (const face of mesh.faces.values()) {
    if (mesh.getFaceVertices(face.id).length > 3) {
      ngonCount += 1;
    }
  }
  return createConversionReport("stl", [], [...triangulatedInterchangeLoss(ngonCount), ...STL_IMPORT_LOSS]);
}

