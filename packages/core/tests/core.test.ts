import { describe, expect, it } from "vitest";
import { Emitter, createSequenceIdFactory, ok, err } from "../src/index";

describe("ids", () => {
  it("creates sequential branded identifiers", () => {
    const ids = createSequenceIdFactory("doc");
    expect(ids.document()).toBe("doc-1");
    expect(ids.object()).toBe("doc-2");
  });
});

describe("Result", () => {
  it("constructs ok and err variants", () => {
    expect(ok(3).ok).toBe(true);
    expect(err("fail").ok).toBe(false);
  });
});

describe("Emitter", () => {
  it("unsubscribes and isolates listener errors", () => {
    const emitter = new Emitter<{ ping: number }>();
    const seen: number[] = [];
    const off = emitter.on("ping", (n) => {
      seen.push(n);
    });
    emitter.on("ping", () => {
      throw new Error("listener failed");
    });
    emitter.emit("ping", 1);
    off();
    emitter.emit("ping", 2);
    expect(seen).toEqual([1]);
  });
});
