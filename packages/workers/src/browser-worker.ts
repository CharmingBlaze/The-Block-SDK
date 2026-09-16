import { handleComputeMessage, transferablesOf } from "./handle-message";
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
  void handleComputeMessage(id, task).then((outcome) => {
    if (outcome.success) {
      scope.postMessage({ id, success: true, result: outcome.result }, transferablesOf(outcome.result));
      return;
    }
    scope.postMessage({ id, success: false, error: outcome.error });
  });
});
