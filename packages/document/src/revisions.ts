import { emptyDocumentRevisions, type DocumentRevisions } from "@modeling-kit/core";
import type { ModelDocument } from "./types";

export function bumpDocumentRevisions(
  document: ModelDocument,
  keys: readonly (keyof DocumentRevisions)[],
  options: { readonly bumpDocument?: boolean } = {},
): void {
  ensureDocumentRevisions(document);
  const selectionOnly = keys.length > 0 && keys.every((key) => key === "selection");
  const bumpDocument = options.bumpDocument ?? !selectionOnly;
  if (bumpDocument) {
    document.revision += 1;
    document.revisions.document += 1;
  }
  for (const key of keys) {
    if (key !== "document") {
      document.revisions[key] += 1;
    }
  }
}

export function ensureDocumentRevisions(document: ModelDocument): DocumentRevisions {
  if (!document.revisions) {
    document.revisions = emptyDocumentRevisions();
  }
  return document.revisions;
}

export function parseDocumentRevisions(raw: unknown): DocumentRevisions {
  const base = emptyDocumentRevisions();
  if (!raw || typeof raw !== "object") {
    return base;
  }
  const record = raw as Record<string, unknown>;
  const next = { ...base };
  for (const key of Object.keys(base) as (keyof DocumentRevisions)[]) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      next[key] = value;
    }
  }
  return next;
}