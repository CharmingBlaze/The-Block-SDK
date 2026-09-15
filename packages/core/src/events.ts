export type Handler<T> = (payload: T) => void;

export class Emitter<TEvents extends Record<string, unknown>> {
  private readonly listeners = new Map<keyof TEvents, Set<Handler<unknown>>>();

  on<K extends keyof TEvents>(type: K, handler: Handler<TEvents[K]>): () => void {
    let set = this.listeners.get(type);
    if (!set) {
      set = new Set();
      this.listeners.set(type, set);
    }
    const wrapped: Handler<unknown> = (payload) => {
      handler(payload as TEvents[K]);
    };
    set.add(wrapped);
    return () => {
      set.delete(wrapped);
    };
  }

  emit<K extends keyof TEvents>(type: K, payload: TEvents[K]): void {
    const set = this.listeners.get(type);
    if (!set) {
      return;
    }
    for (const handler of [...set]) {
      try {
        handler(payload);
      } catch {
        // Listener failures must not interrupt remaining subscribers or editor state.
      }
    }
  }

  listenerCount<K extends keyof TEvents>(type: K): number {
    return this.listeners.get(type)?.size ?? 0;
  }

  totalListenerCount(): number {
    let n = 0;
    for (const set of this.listeners.values()) {
      n += set.size;
    }
    return n;
  }

  clear(): void {
    this.listeners.clear();
  }
}
