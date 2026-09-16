import { parentPort } from "node:worker_threads";
import { handleComputeMessage, transferablesOf } from "./handle-message";
import type { TaskPayload } from "./types";

parentPort?.on("message", (message: { id: string; task: TaskPayload }) => {
  void handleComputeMessage(message.id, message.task).then((outcome) => {
    if (outcome.success) {
      parentPort?.postMessage({ id: message.id, success: true, result: outcome.result }, transferablesOf(outcome.result));
      return;
    }
    parentPort?.postMessage({ id: message.id, success: false, error: outcome.error });
  });
});
