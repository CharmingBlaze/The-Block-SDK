import { createModelDocument, type CreateDocumentOptions } from "./create";
import type { DocumentLifecycle, ModelDocument } from "./types";

export type { CreateDocumentOptions };

const allowed: Record<DocumentLifecycle, readonly DocumentLifecycle[]> = {
  creating: ["ready", "failed"],
  ready: ["loading", "saving", "closing", "failed"],
  loading: ["ready", "failed"],
  saving: ["ready", "failed"],
  closing: ["closed", "failed"],
  closed: [],
  failed: ["closing", "creating"],
};

export function createDocument(options: CreateDocumentOptions = {}): ModelDocument {
  const document = createModelDocument(options);
  document.lifecycle = "ready";
  return document;
}

export function transitionDocumentLifecycle(
  document: ModelDocument,
  next: DocumentLifecycle,
): void {
  if (document.lifecycle === next) {
    return;
  }
  if (!allowed[document.lifecycle].includes(next)) {
    throw new Error(`Illegal document lifecycle transition: ${document.lifecycle} → ${next}`);
  }
  document.lifecycle = next;
}
