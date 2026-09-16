import { runComputeTask } from "./compute-task";
import type { ComputeWorkerBackend, ComputeWorkerHandlers, ComputeWorkerSession } from "./backend";
import type { TaskPayload } from "./types";

interface InlineNative {
  handlers?: ComputeWorkerHandlers | undefined;
  timer?: ReturnType<typeof setTimeout> | undefined;
  terminated: boolean;
}

export function createInlineBackend(): ComputeWorkerBackend {
  const natives = new WeakMap<ComputeWorkerSession, InlineNative>();
  return {
    kind: "inline",
    concurrency: 1,
    spawn(): ComputeWorkerSession {
      const native: InlineNative = { terminated: false };
      const session: ComputeWorkerSession = {
        postMessage(message: unknown): void {
          if (native.terminated) {
            return;
          }
          const payload = message as { id: string; task: TaskPayload };
          native.timer = setTimeout(() => {
            native.timer = undefined;
            if (native.terminated) {
              return;
            }
            try {
              const result = runComputeTask(payload.task);
              native.handlers?.onMessage({ id: payload.id, success: true, result });
            } catch (err) {
              native.handlers?.onMessage({
                id: payload.id,
                success: false,
                error: err instanceof Error ? err.message : String(err),
              });
            }
          }, 0);
        },
        terminate(): void {
          native.terminated = true;
          if (native.timer) {
            clearTimeout(native.timer);
            native.timer = undefined;
          }
          native.handlers?.onExit?.(1);
        },
      };
      natives.set(session, native);
      return session;
    },
    subscribe(worker: ComputeWorkerSession, handlers: ComputeWorkerHandlers): () => void {
      const native = natives.get(worker);
      if (native) {
        native.handlers = handlers;
      }
      return () => {
        if (native && native.handlers === handlers) {
          native.handlers = undefined;
        }
      };
    },
  };
}
