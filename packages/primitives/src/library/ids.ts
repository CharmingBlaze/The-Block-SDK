export const LIBRARY_GEOMETRY_IDS = [
  "quad",
  "rectangle",
  "roundedRectangle",
  "stadium",
  "ellipse",
  "disc",
  "annulus",
  "superellipse",
  "squircle",
  "reuleux",
  "cube",
  "roundedCube",
  "sphere",
  "icosphere",
  "ellipsoid",
  "cylinder",
  "cone",
  "capsule",
  "torus",
  "tetrahedron",
  "icosahedron",
] as const;

export type LibraryGeometryId = (typeof LIBRARY_GEOMETRY_IDS)[number];

export const PLANAR_GEOMETRY_IDS = [
  "quad",
  "rectangle",
  "roundedRectangle",
  "stadium",
  "ellipse",
  "disc",
  "annulus",
  "superellipse",
  "squircle",
  "reuleux",
] as const;

export type PlanarGeometryId = (typeof PLANAR_GEOMETRY_IDS)[number];

export const SOLID_GEOMETRY_IDS = [
  "cube",
  "roundedCube",
  "sphere",
  "icosphere",
  "ellipsoid",
  "cylinder",
  "cone",
  "capsule",
  "torus",
  "tetrahedron",
  "icosahedron",
] as const;

export type SolidGeometryId = (typeof SOLID_GEOMETRY_IDS)[number];

export const LIBRARY_CLOSED: ReadonlySet<LibraryGeometryId> = new Set(SOLID_GEOMETRY_IDS);

export const LIBRARY_DISPLAY_NAMES: Record<LibraryGeometryId, string> = {
  quad: "Quad",
  rectangle: "Rectangle",
  roundedRectangle: "Rounded Rectangle",
  stadium: "Stadium",
  ellipse: "Ellipse",
  disc: "Disc (library)",
  annulus: "Annulus",
  superellipse: "Superellipse",
  squircle: "Squircle",
  reuleux: "Reuleaux",
  cube: "Cube (library)",
  roundedCube: "Rounded Cube",
  sphere: "Sphere (library)",
  icosphere: "Icosphere (library)",
  ellipsoid: "Ellipsoid",
  cylinder: "Cylinder (library)",
  cone: "Cone (library)",
  capsule: "Capsule (library)",
  torus: "Torus (library)",
  tetrahedron: "Tetrahedron",
  icosahedron: "Icosahedron",
};

export function isLibraryGeometryId(value: string): value is LibraryGeometryId {
  return (LIBRARY_GEOMETRY_IDS as readonly string[]).includes(value);
}

export function isPlanarGeometry(kind: LibraryGeometryId): kind is PlanarGeometryId {
  return (PLANAR_GEOMETRY_IDS as readonly string[]).includes(kind);
}
