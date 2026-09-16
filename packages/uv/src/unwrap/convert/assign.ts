import type { CornerId } from "@modeling-kit/core";
import { UvUnwrapError } from "../errors";
import type { UvTriangulationMapping, UvUnwrapBackendResult } from "../types";
import { assignOrRejectCornerUv } from "./conflict";

export function assignCornerUvs(
  mapping: UvTriangulationMapping,
  backend: UvUnwrapBackendResult,
  inputVertexCount: number,
): Map<CornerId, readonly [number, number]> {
  if (mapping.triangleCornerIds.length !== backend.triangleCount) {
    throw new UvUnwrapError(
      "missing-corner-mapping",
      `Triangle mapping count ${mapping.triangleCornerIds.length} does not match xatlas output ${backend.triangleCount}`,
    );
  }
  const assigned = new Map<CornerId, readonly [number, number]>();
  for (let t = 0; t < backend.triangleCount; t += 1) {
    const corners = mapping.triangleCornerIds[t];
    const expected = mapping.triangleVertexIndices[t];
    if (!corners || !expected) {
      throw new UvUnwrapError("missing-corner-mapping", `Missing triangulation mapping for triangle ${t}`);
    }
    for (let k = 0; k < 3; k += 1) {
      const outIndex = backend.indices[t * 3 + k];
      const cornerId = corners[k];
      if (outIndex === undefined || !cornerId) {
        throw new UvUnwrapError("missing-corner-mapping", `Missing output vertex for triangle ${t} corner ${k}`);
      }
      const xref = backend.xref[outIndex];
      if (xref === undefined || xref < 0 || xref >= inputVertexCount) {
        throw new UvUnwrapError("missing-corner-mapping", `xatlas xref ${String(xref)} is outside the input vertex range`);
      }
      if (xref !== expected[k]) {
        throw new UvUnwrapError(
          "missing-corner-mapping",
          `xatlas xref ${xref} does not match input vertex ${expected[k]} for triangle ${t}`,
          { cornerIds: [cornerId] },
        );
      }
      const u = backend.uvs[outIndex * 2];
      const v = backend.uvs[outIndex * 2 + 1];
      if (u === undefined || v === undefined || !Number.isFinite(u) || !Number.isFinite(v)) {
        throw new UvUnwrapError("invalid-atlas", "Assigned UV is not finite");
      }
      assignOrRejectCornerUv(assigned, cornerId, [u, v]);
    }
  }
  return assigned;
}
