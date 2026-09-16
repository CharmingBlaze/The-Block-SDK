import { UvUnwrapError } from "../errors";
import type { AutomaticUvUnwrapOptions, UvUnwrapBackendOptions, UvUnwrapWarning } from "../types";

export function toBackendOptions(options: AutomaticUvUnwrapOptions | undefined): UvUnwrapBackendOptions {
  return {
    ...(options?.maxChartArea !== undefined ? { maxChartArea: options.maxChartArea } : {}),
    ...(options?.maxBoundaryLength !== undefined ? { maxBoundaryLength: options.maxBoundaryLength } : {}),
    ...(options?.resolution !== undefined ? { resolution: options.resolution } : {}),
    ...(options?.padding !== undefined ? { padding: options.padding } : {}),
    ...(options?.rotateCharts !== undefined ? { rotateCharts: options.rotateCharts } : {}),
    ...(options?.blockAlign !== undefined ? { blockAlign: options.blockAlign } : {}),
    ...(options?.bilinearPadding !== undefined ? { bilinearPadding: options.bilinearPadding } : {}),
  };
}

export function assertSupportedUnwrapOptions(options: AutomaticUvUnwrapOptions | undefined): UvUnwrapWarning[] {
  const warnings: UvUnwrapWarning[] = [];
  if (options?.respectExistingSeams === true) {
    throw new UvUnwrapError(
      "unsupported-option",
      "respectExistingSeams is not supported by the xatlas/watlas backend; only false is allowed",
    );
  }
  if (options?.preserveExistingCharts === true) {
    throw new UvUnwrapError(
      "unsupported-option",
      "preserveExistingCharts is not supported by the xatlas/watlas backend",
    );
  }
  if (options?.respectExistingSeams === false) {
    warnings.push({
      code: "manual-seams-not-respected",
      message: "Automatic chart unwrap generates its own charts; user-authored seams are not passed to xatlas",
    });
  }
  return warnings;
}
