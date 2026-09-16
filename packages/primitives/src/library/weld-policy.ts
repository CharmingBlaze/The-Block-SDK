import type { UvGridWeld } from "./weld-grid";

export type WeldPolicy =
  | { readonly kind: "connected-coincident" }
  | { readonly kind: "solid" }
  | UvGridWeld;

export function resolveWeldPolicy(
  type: string,
  geometry: { readonly positions: ArrayLike<number>; readonly uvs?: ArrayLike<number> | undefined },
  explicit?: WeldPolicy,
): WeldPolicy {
  if (explicit) {
    return explicit;
  }
  switch (type) {
    case "cube":
    case "box":
    case "roundedCube":
    case "tetrahedron":
    case "icosahedron":
    case "icosphere":
    case "cylinder":
    case "cone":
    case "capsule":
      return { kind: "solid" };
    case "sphere":
    case "ellipsoid":
    case "torus":
      return inferUvGrid(geometry, type) ?? { kind: "solid" };
    default:
      return { kind: "connected-coincident" };
  }
}

function inferUvGrid(
  geometry: { readonly positions: ArrayLike<number>; readonly uvs?: ArrayLike<number> | undefined },
  type: string,
): UvGridWeld | undefined {
  const uvs = geometry.uvs;
  if (!uvs || uvs.length === 0) {
    return undefined;
  }
  const count = geometry.positions.length / 3;
  const us = new Set<number>();
  const vs = new Set<number>();
  for (let i = 0; i < count; i++) {
    us.add(Math.round((uvs[i * 2] ?? 0) * 1e6));
    vs.add(Math.round((uvs[i * 2 + 1] ?? 0) * 1e6));
  }
  const columns = us.size;
  const rows = vs.size;
  if (columns < 3 || rows < 2 || columns * rows !== count) {
    return undefined;
  }
  return {
    kind: "uv-grid",
    columns,
    rows,
    wrapU: true,
    wrapV: type === "torus",
    collapsePoles: type !== "torus",
  };
}
