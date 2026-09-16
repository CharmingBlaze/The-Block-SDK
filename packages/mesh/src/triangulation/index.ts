export type {
  PolygonTriangulation,
  PolygonTriangulationOptions,
  PolygonTriangulationStatus,
  TriangulationBackendId,
  TriangulationBackendUsed,
} from "./types";
export { triangulatePolygon, triangulatePolygonLoops } from "./loops";
export { polygonArea, polygonNormal } from "./project";
