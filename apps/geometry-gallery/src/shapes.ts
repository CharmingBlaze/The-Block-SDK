import {
  LIBRARY_DISPLAY_NAMES,
  LIBRARY_GEOMETRY_IDS,
  primitiveDisplayNames,
  type LibraryGeometryId,
  type PrimitiveCreateParams,
  type PrimitiveType,
} from "@modeling-kit/sdk";

export type GalleryShape =
  | { readonly id: string; readonly source: "canonical"; readonly type: PrimitiveType }
  | { readonly id: string; readonly source: "library"; readonly type: LibraryGeometryId };

const CANONICAL_TYPES: readonly PrimitiveType[] = [
  "cube",
  "plane",
  "grid",
  "quadSphere",
  "uvSphere",
  "torus",
  "cylinder",
  "cone",
  "capsule",
  "roundedCube",
  "icosphere",
];

export const GALLERY_SHAPES: readonly GalleryShape[] = [
  ...CANONICAL_TYPES.map(
    (type): GalleryShape => ({ id: `canonical:${type}`, source: "canonical", type }),
  ),
  ...LIBRARY_GEOMETRY_IDS.map(
    (type): GalleryShape => ({ id: `library:${type}`, source: "library", type }),
  ),
];

export function galleryLabel(shape: GalleryShape): string {
  if (shape.source === "canonical") {
    return `${primitiveDisplayNames[shape.type]} (canonical)`;
  }
  return `${LIBRARY_DISPLAY_NAMES[shape.type]} (library)`;
}

export function paramsForShape(shape: GalleryShape): PrimitiveCreateParams {
  if (shape.source === "library") {
    return paramsForLibraryShape(shape.type);
  }
  return paramsForCanonicalShape(shape.type);
}

function paramsForCanonicalShape(type: PrimitiveType): PrimitiveCreateParams {
  switch (type) {
    case "cube":
    case "box":
      return { width: 1.2, height: 1.2, depth: 1.2, segmentsX: 2, segmentsY: 2, segmentsZ: 2 };
    case "plane":
      return { width: 1.6, depth: 1.2 };
    case "grid":
    case "rectangle":
      return { width: 1.6, depth: 1.2, segmentsX: 4, segmentsZ: 3 };
    case "quadSphere":
      return { radius: 0.75, segments: 4 };
    case "uvSphere":
      return { radius: 0.75, widthSegments: 24, heightSegments: 16 };
    case "torus":
      return { radius: 0.7, tube: 0.22, radialSegments: 12, tubularSegments: 32 };
    case "cylinder":
      return { radius: 0.45, height: 1.4, radialSegments: 24, heightSegments: 2 };
    case "cone":
      return { radius: 0.55, height: 1.4, radialSegments: 24, heightSegments: 2 };
    case "capsule":
      return { radius: 0.35, height: 0.8, radialSegments: 16, capSegments: 8 };
    case "roundedCube":
      return { width: 1.2, height: 1.2, depth: 1.2, radius: 0.22, roundSegments: 4, edgeSegments: 2 };
    case "icosphere":
      return { radius: 0.75, subdivisions: 2 };
    default:
      return {};
  }
}

function paramsForLibraryShape(kind: LibraryGeometryId): PrimitiveCreateParams {
  switch (kind) {
    case "quad":
      return { scale: 0.7 };
    case "rectangle":
      return { width: 1.6, depth: 1.2, segmentsX: 3, segmentsZ: 2 };
    case "roundedRectangle":
      return { width: 1.6, depth: 1, radius: 0.25, roundSegments: 6 };
    case "stadium":
      return { width: 1.6, depth: 0.7, roundSegments: 8 };
    case "ellipse":
      return { radius: 0.7, radiusX: 1, radiusZ: 0.55, segments: 32, innerSegments: 8 };
    case "disc":
      return { radius: 0.8, segments: 24 };
    case "annulus":
      return { radius: 0.8, innerRadius: 0.35, segments: 24, innerSegments: 4 };
    case "superellipse":
      return { radius: 0.7, m: 4, n: 4, segments: 32, innerSegments: 8 };
    case "squircle":
      return { radius: 0.7, squareness: 0.95, segments: 48, innerSegments: 8 };
    case "reuleux":
      return { radius: 0.7, sides: 3, segments: 36, innerSegments: 8 };
    case "cube":
      return { width: 1.2, height: 1.2, depth: 1.2 };
    case "roundedCube":
      return { width: 1.2, height: 1.2, depth: 1.2, radius: 0.22, roundSegments: 6 };
    case "sphere":
      return { radius: 0.75, widthSegments: 24, heightSegments: 16 };
    case "icosphere":
      return { radius: 0.75, subdivisions: 2 };
    case "ellipsoid":
      return { radius: 1, radiusX: 0.85, radiusY: 0.5, radiusZ: 0.5, widthSegments: 24, heightSegments: 16 };
    case "cylinder":
      return { radius: 0.45, height: 1.4, segments: 24 };
    case "cone":
      return { radius: 0.55, height: 1.4, segments: 24 };
    case "capsule":
      return { radius: 0.35, height: 0.8, segments: 16, capSegments: 8 };
    case "torus":
      return { radius: 0.7, tube: 0.22, radialSegments: 12, tubularSegments: 32 };
    case "tetrahedron":
    case "icosahedron":
      return { radius: 0.75 };
  }
}
