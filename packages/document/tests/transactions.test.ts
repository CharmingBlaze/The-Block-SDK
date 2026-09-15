import { describe, expect, it } from "vitest";
import { createSequenceIdFactory } from "@modeling-kit/core";
import { identityTransform } from "@modeling-kit/math";
import {
  addNode,
  beginDocumentTransaction,
  createModelDocument,
  getNode,
  setLocalTransform,
} from "../src/index";

describe("document transactions", () => {
  it("rolls back hierarchy mutations atomically", () => {
    const ids = createSequenceIdFactory("tx");
    const document = createModelDocument({ ids });
    const tx = beginDocumentTransaction(document, "add");
    addNode(document, ids.object(), { name: "Temp" });
    tx.rollback();
    expect(getNode(document, document.scene.rootNodeId).childIds).toEqual([]);
    expect(document.revision).toBe(0);
  });

  it("commits a structured change set and revision", () => {
    const ids = createSequenceIdFactory("tx2");
    const document = createModelDocument({ ids });
    const tx = beginDocumentTransaction(document, "Add node");
    const node = addNode(document, ids.object(), { name: "Box" });
    const result = tx.commit();
    expect(result.revisionAfter).toBe(1);
    expect(result.changeSet.addedNodes).toContain(node.id);
    expect(result.kind).toBe("hierarchy");
  });

  it("infers transform vs hierarchy change kinds", () => {
    const ids = createSequenceIdFactory("tx-kind");
    const document = createModelDocument({ ids });
    const node = addNode(document, ids.object(), { name: "Mover" });
    const tx = beginDocumentTransaction(document, "move");
    const moved = identityTransform();
    setLocalTransform(document, node.id, {
      ...moved,
      position: { x: 1, y: 0, z: 0 },
    });
    const result = tx.commit();
    expect(result.kind).toBe("transform");
    expect(result.changeSet.changedNodes[0]?.kind).toBe("transform");
  });

  it("rejects nested transactions", () => {
    const document = createModelDocument({ ids: createSequenceIdFactory("tx3") });
    beginDocumentTransaction(document, "outer");
    expect(() => beginDocumentTransaction(document, "inner")).toThrow(/Nested/);
  });

  it("restores revision counters on rollback", () => {
    const ids = createSequenceIdFactory("tx4");
    const document = createModelDocument({ ids });
    const before = document.revisions.hierarchy;
    const tx = beginDocumentTransaction(document, "add");
    addNode(document, ids.object(), { name: "Temp" });
    tx.rollback();
    expect(document.revisions.hierarchy).toBe(before);
    expect(document.revision).toBe(0);
  });
});
