import { runComputeTask } from "./compute-task";
import { collectTransferables } from "./transfer";
import type { TaskPayload } from "./types";

const scope = globalThis as unknown as {
  addEventListener(
    type: "message",
    listener: (event: { data: { id: string; task: TaskPayload } }) => void,
  ): void;
  postMessage(message: unknown, transfer?: ArrayBuffer[]): void;
};

scope.addEventListener("message", (event) => {
  const { id, task } = event.data;
  try {
    const result = runComputeTask(task);
    const transfer = collectTransferables(result);
    scope.postMessage({ id, success: true, result }, transfer);
  } catch (err) {
    scope.postMessage({
      id,
      success: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
});
