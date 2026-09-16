/**
 * Polygon triangulation facade.
 *
 * Simple convex loops keep the in-house ear clipper. Concave polygons, holes,
 * and multi-loop caps use Earcut behind the same contract. Callers still receive
 * original-vertex triangle indices and the existing winding flags.
 */
export {
  polygonArea,
  polygonNormal,
  triangulatePolygon,
  triangulatePolygonLoops,
  type PolygonTriangulation,
  type PolygonTriangulationOptions,
  type PolygonTriangulationStatus,
  type TriangulationBackendId,
  type TriangulationBackendUsed,
} from "./triangulation";
