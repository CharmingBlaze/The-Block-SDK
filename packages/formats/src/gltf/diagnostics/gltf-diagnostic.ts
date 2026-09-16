export type GltfDiagnosticSeverity = "info" | "warning" | "error" | "loss";

export type GltfDataLossCode =
  | "unsupported-primitive-mode"
  | "unsupported-extension"
  | "unsupported-material-property"
  | "unsupported-animation-channel"
  | "unsupported-interpolation"
  | "skin-influence-truncated"
  | "texture-format-unsupported"
  | "matrix-shear-lost"
  | "metadata-dropped"
  | "external-resource-skipped"
  | "visibility-track-omitted"
  | "markers-omitted"
  | "ibm-identity-default"
  | "sampler-conflict"
  | "instancing-unsupported"
  | "morph-targets-omitted"
  | "resource-limit-exceeded";

export interface GltfDiagnostic {
  readonly code: string;
  readonly severity: GltfDiagnosticSeverity;
  readonly message: string;
  readonly sourcePath?: string;
  readonly affectedObject?: string;
  readonly suggestedCorrection?: string;
}

export function diagnostic(
  code: string,
  severity: GltfDiagnosticSeverity,
  message: string,
  extra: Omit<GltfDiagnostic, "code" | "severity" | "message"> = {},
): GltfDiagnostic {
  return { code, severity, message, ...extra };
}
