import type { DocumentId, JobId } from "./brand";

export interface RevisionedJobRequest {
  readonly documentId: DocumentId;
  readonly sourceRevision: number;
  readonly jobId: JobId;
}

export interface StaleJobCheck {
  readonly documentExists: boolean;
  readonly targetExists: boolean;
  readonly sourceRevision: number;
  readonly currentRevision: number;
  readonly cancelled: boolean;
  readonly adapterDisposed: boolean;
  readonly superseded: boolean;
}

export function isStaleJobResult(check: StaleJobCheck): boolean {
  return (
    !check.documentExists ||
    !check.targetExists ||
    check.cancelled ||
    check.adapterDisposed ||
    check.superseded ||
    check.sourceRevision !== check.currentRevision
  );
}
