import geometryExtrude from "geometry-extrude";
import { resolveGeometryExtrude, type GeometryExtrudeApi } from "./library";

export function geometryExtrudeApi(): GeometryExtrudeApi {
  return resolveGeometryExtrude(geometryExtrude);
}
