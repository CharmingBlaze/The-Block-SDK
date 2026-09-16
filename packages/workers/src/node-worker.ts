import { parentPort } from "node:worker_threads";
import { runComputeTask } from "./compute-task";
import { collectTransferables } from "./transfer";
import type { TaskPayload } from "./types";

parentPort?.on("message", (message: { id: string; task: TaskPayload }) => {
  try {
    const result = runComputeTask(message.task);
    const transfer = collectTransferables(result);
    parentPort?.postMessage({ id: message.id, success: true, result }, transfer);
  } catch (err) {
    parentPort?.postMessage({
      id: message.id,
      success: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
});
