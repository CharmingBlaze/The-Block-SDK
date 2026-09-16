import { createConversionReport, type ConversionReport } from "../../conversion";
import type { GltfDiagnostic } from "./gltf-diagnostic";
import type { DiagnosticSink } from "./loss-report";

export interface GltfImportReport extends ConversionReport {
  readonly diagnostics: readonly GltfDiagnostic[];
  readonly repairs: readonly GltfDiagnostic[];
}

export function importReportFromSink(sink: DiagnosticSink, format: "gltf" | "glb" = "gltf"): GltfImportReport {
  const warnings = sink.warningMessages();
  const dataLoss = sink.lossMessages();
  return {
    ...createConversionReport(format, warnings, dataLoss),
    diagnostics: [...sink.warnings, ...sink.losses],
    repairs: [...sink.repairs],
  };
}
