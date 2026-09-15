import { brand } from "@modeling-kit/core";
import { describe, expect, it } from "vitest";
import { ModelingSession } from "../src/index";

describe("session.capabilities", () => {
  it("denies mesh ops without a face selection and allows undo after a command", () => {
    const session = new ModelingSession();
    expect(session.capabilities.canExecute("mesh.extrude").ok).toBe(false);
    expect(session.capabilities.canExecute("edit.undo").ok).toBe(false);
    session.selection.replace({ domain: "face", objectIds: [brand("obj")], elementIds: [brand("f")] });
    expect(session.capabilities.canExecute("mesh.extrude").reason?.code).toBe("NO_OBJECT");
  });
});
