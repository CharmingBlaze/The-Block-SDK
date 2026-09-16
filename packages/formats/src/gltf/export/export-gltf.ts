import { Format, type JSONDocument } from "@gltf-transform/core";
import { bytesToBase64, type ModelDocument } from "@modeling-kit/document";
import type { HalfEdgeMesh } from "@modeling-kit/mesh";
import type { ConversionReport } from "../../conversion";
import { exportReportFromSink } from "../diagnostics/export-report";
import type { GltfDiagnostic } from "../diagnostics/gltf-diagnostic";
import { createGltfTransformIO } from "../io/memory-platform-io";
import { toDataUri } from "../resources/data-uri";
import { buildGltfDocument } from "./export-document";
import type { GltfExportOptions } from "./export-context";

export type { GltfExportOptions } from "./export-context";

export interface GltfExportResult {
  readonly gltf: Record<string, unknown>;
  readonly report: ConversionReport;
  readonly resources: ReadonlyMap<string, Uint8Array>;
  readonly warnings: readonly GltfDiagnostic[];
  readonly losses: readonly GltfDiagnostic[];
}

export interface GlbExportResult {
  readonly glb: Uint8Array;
  readonly report: ConversionReport;
  readonly warnings: readonly GltfDiagnostic[];
  readonly losses: readonly GltfDiagnostic[];
}

export async function exportGltfWithReport(
  document: ModelDocument,
  meshes: ReadonlyMap<string, HalfEdgeMesh>,
  options: GltfExportOptions = {},
): Promise<GltfExportResult> {
  const context = buildGltfDocument(document, meshes, { ...options, format: "gltf" });
  const io = createGltfTransformIO();
  const written = await io.writeJSON(context.target, { format: Format.GLTF });
  const resourceMode = context.options.resourceMode;
  const resources = new Map(Object.entries(written.resources));
  const json = resourceMode === "embedded" ? embedResources(written) : (written.json as unknown as Record<string, unknown>);
  const report = exportReportFromSink(context.sink, "gltf");
  (context.target as { dispose?: () => void }).dispose?.();
  return {
    gltf: json,
    report,
    resources,
    warnings: context.sink.warnings,
    losses: context.sink.losses,
  };
}

export async function exportGltf(
  document: ModelDocument,
  meshes: ReadonlyMap<string, HalfEdgeMesh>,
  options: GltfExportOptions = {},
): Promise<Record<string, unknown>> {
  return (await exportGltfWithReport(document, meshes, options)).gltf;
}

export async function exportGlbWithReport(
  document: ModelDocument,
  meshes: ReadonlyMap<string, HalfEdgeMesh>,
  options: GltfExportOptions = {},
): Promise<GlbExportResult> {
  const context = buildGltfDocument(document, meshes, { ...options, format: "glb" });
  const io = createGltfTransformIO();
  const glb = await io.writeBinary(context.target);
  const report = exportReportFromSink(context.sink, "glb");
  (context.target as { dispose?: () => void }).dispose?.();
  return { glb, report, warnings: context.sink.warnings, losses: context.sink.losses };
}

export async function exportGlb(
  document: ModelDocument,
  meshes: ReadonlyMap<string, HalfEdgeMesh>,
  options: GltfExportOptions = {},
): Promise<Uint8Array> {
  return (await exportGlbWithReport(document, meshes, options)).glb;
}

function embedResources(written: JSONDocument): Record<string, unknown> {
  const json = structuredClone(written.json) as unknown as Record<string, unknown>;
  const buffers = Array.isArray(json.buffers) ? json.buffers : [];
  for (const buffer of buffers) {
    if (!buffer || typeof buffer !== "object") {
      continue;
    }
    const record = buffer as { uri?: string; byteLength?: number };
    if (record.uri && written.resources[record.uri]) {
      record.uri = toDataUri(written.resources[record.uri]!, "application/octet-stream");
    } else if (!record.uri) {
      const first = Object.values(written.resources)[0];
      if (first) {
        record.uri = `data:application/octet-stream;base64,${bytesToBase64(first)}`;
      }
    }
  }
  const images = Array.isArray(json.images) ? json.images : [];
  for (const image of images) {
    if (!image || typeof image !== "object") {
      continue;
    }
    const record = image as { uri?: string; mimeType?: string };
    if (record.uri && written.resources[record.uri]) {
      record.uri = toDataUri(written.resources[record.uri]!, record.mimeType ?? "image/png");
    }
  }
  return json;
}
