import { DEFAULT_UNWRAP_PADDING_TEXELS, DEFAULT_UNWRAP_RESOLUTION } from "../../constants";
import type { UvUnwrapBackendOptions } from "../../types";

export function toChartOptions(options: UvUnwrapBackendOptions): import("watlas").ChartOptions {
  const chart: import("watlas").ChartOptions = { fixWinding: true };
  if (options.maxChartArea !== undefined) {
    chart.maxChartArea = options.maxChartArea;
  }
  if (options.maxBoundaryLength !== undefined) {
    chart.maxBoundaryLength = options.maxBoundaryLength;
  }
  if (options.useInputMeshUvs === true) {
    chart.useInputMeshUvs = true;
  }
  return chart;
}

export function toPackOptions(options: UvUnwrapBackendOptions): import("watlas").PackOptions {
  return {
    padding: options.padding ?? DEFAULT_UNWRAP_PADDING_TEXELS,
    resolution: options.resolution ?? DEFAULT_UNWRAP_RESOLUTION,
    rotateCharts: options.rotateCharts ?? true,
    blockAlign: options.blockAlign ?? false,
    bilinear: options.bilinearPadding ?? true,
  };
}
