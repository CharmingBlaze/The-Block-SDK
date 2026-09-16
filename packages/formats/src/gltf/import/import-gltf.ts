import { SchemaError, type IdFactory, type MeshId } from "@modeling-kit/core";
import type { ModelDocument } from "@modeling-kit/document";
import type { HalfEdgeMesh } from "@modeling-kit/mesh";
import { throwIfAborted } from "../../cancel";
import { isGlb } from "../../gltf-glb";
import type { ConversionReport } from "../../conversion";
import type { GltfDiagnostic } from "../diagnostics/gltf-diagnostic";
import { importReportFromSink } from "../diagnostics/import-report";
import { createGltfTransformIO } from "../io/memory-platform-io";
import { assertJsonAccessorBounds } from "../validation/assert-accessor-bounds";
import { resolveJsonResources } from "../resources/collect-uris";
import type { GltfImportOptions } from "./import-context";
import { importGltfDocument } from "./import-document";

export type { GltfImportOptions } from "./import-context";
export type GltfImportSource = string | Record<string, unknown> | ArrayBuffer | ArrayBufferView;
export type { GltfWeldMode } from "../conversion/attributes";

export interface GltfImportResult {
  readonly document: ModelDocument;
  readonly meshes: Map<MeshId, HalfEdgeMesh>;
  readonly warnings: readonly string[];
  readonly dataLoss: readonly string[];
  readonly report: ConversionReport;
  readonly repairs: readonly GltfDiagnostic[];
  readonly losses: readonly GltfDiagnostic[];
}

export async function importGltf(
  source: GltfImportSource,
  ids: IdFactory,
  options: GltfImportOptions = {},
): Promise<GltfImportResult> {
  throwIfAborted(options.signal, "glTF import");
  const io = createGltfTransformIO();
  io.setStrictResources(options.mode !== "repair" && options.strict !== false);
  try {
    const jsonDocument = await toJsonDocument(source, options);
    if (options.mode !== "repair" && options.strict !== false) {
      assertJsonAccessorBounds(jsonDocument.json as unknown as Record<string, unknown>);
    }
    const transformDoc = await io.readJSON(jsonDocument);
    const context = importGltfDocument(transformDoc, ids, options);
    const report = importReportFromSink(context.sink, isBinarySource(source) ? "glb" : "gltf");
    const disposable = transformDoc as { dispose?: () => void };
    disposable.dispose?.();
    return {
      document: context.document,
      meshes: context.meshes,
      warnings: report.warnings,
      dataLoss: report.dataLoss,
      report,
      repairs: report.repairs,
      losses: context.sink.losses,
    };
  } catch (error) {
    if (error instanceof SchemaError) {
      throw error;
    }
    throw new SchemaError(error instanceof Error ? error.message : String(error));
  }
}

async function toJsonDocument(source: GltfImportSource, options: GltfImportOptions) {
  const io = createGltfTransformIO();
  const resolveContext = {
    ...(options.documentUri ? { documentUri: options.documentUri } : {}),
    ...(options.rootDir ? { rootDir: options.rootDir } : {}),
  };
  if (typeof source === "string") {
    return resolveJsonResources(parseJson(source), options.resourceResolver, resolveContext);
  }
  if (source instanceof ArrayBuffer) {
    return bytesToJson(new Uint8Array(source), options, io);
  }
  if (ArrayBuffer.isView(source)) {
    return bytesToJson(new Uint8Array(source.buffer, source.byteOffset, source.byteLength), options, io);
  }
  return resolveJsonResources(source, options.resourceResolver, resolveContext);
}

async function bytesToJson(
  bytes: Uint8Array,
  options: GltfImportOptions,
  io: ReturnType<typeof createGltfTransformIO>,
) {
  if (isGlb(bytes)) {
    return io.binaryToJSON(bytes);
  }
  return resolveJsonResources(parseJson(new TextDecoder().decode(bytes)), options.resourceResolver, {
    ...(options.documentUri ? { documentUri: options.documentUri } : {}),
    ...(options.rootDir ? { rootDir: options.rootDir } : {}),
  });
}

function parseJson(text: string): Record<string, unknown> {
  try {
    const raw: unknown = JSON.parse(text);
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      throw new SchemaError("glTF JSON must be an object");
    }
    return raw as Record<string, unknown>;
  } catch (error) {
    if (error instanceof SchemaError) {
      throw error;
    }
    throw new SchemaError(`glTF JSON is malformed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function isBinarySource(source: GltfImportSource): boolean {
  return source instanceof ArrayBuffer || ArrayBuffer.isView(source);
}
