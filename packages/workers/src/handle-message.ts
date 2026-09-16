import { collectTransferables } from "./transfer";
import { runComputeTask } from "./compute-task";
import type { TaskPayload } from "./types";

export async function handleComputeMessage(
  id: string,
  task: TaskPayload,
): Promise<{ readonly success: true; readonly result: unknown } | { readonly success: false; readonly error: string }> {
  try {
    const result = await runComputeTask(task);
    return { success: true, result };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export function transferablesOf(result: unknown): ArrayBuffer[] {
  return collectTransferables(result);
}
