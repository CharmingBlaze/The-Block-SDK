import { createConversionReport, type ConversionReport } from "../../conversion";
import type { GltfDiagnostic } from "./gltf-diagnostic";
import type { DiagnosticSink } from "./loss-report";

export interface GltfExportReport extends ConversionReport {
  readonly diagnostics: readonly GltfDiagnostic[];
}

export function exportReportFromSink(sink: DiagnosticSink, format: "gltf" | "glb"): GltfExportReport {
  return {
    ...createConversionReport(format, sink.warningMessages(), sink.lossMessages()),
    diagnostics: [...sink.warnings, ...sink.losses],
  };
}
