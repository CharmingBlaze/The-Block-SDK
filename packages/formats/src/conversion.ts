/**
 * Interchange is always a derived dump of ModelDocument / HalfEdgeMesh.
 * Reports record data loss so hosts never treat glTF/OBJ/STL as a second kernel.
 */
export type InterchangeFormat = "gltf" | "glb" | "obj" | "stl" | "ppm";

export interface ConversionReport {
  readonly format: InterchangeFormat;
  readonly warnings: readonly string[];
  readonly dataLoss: readonly string[];
}

export function createConversionReport(
  format: InterchangeFormat,
  warnings: readonly string[] = [],
  dataLoss: readonly string[] = [],
): ConversionReport {
  return {
    format,
    warnings: [...warnings],
    dataLoss: [...dataLoss],
  };
}

export function triangulatedInterchangeLoss(ngonCount: number): readonly string[] {
  const loss = [
    "Native half-edge topology, history, selection, and branded IDs are not preserved",
  ];
  if (ngonCount > 0) {
    loss.push(`${ngonCount} n-gon faces were triangulated for the interchange mesh`);
  }
  return loss;
}

export function countNgons(faceVertexCounts: Iterable<number>): number {
  let n = 0;
  for (const count of faceVertexCounts) {
    if (count > 3) {
      n += 1;
    }
  }
  return n;
}
