import { describe, expect, it } from "vitest";
import { automaticUnwrap, UvUnwrapError } from "../../src/unwrap";
import { getCornerUv, setCornerPinned, setCornerUv, isCornerPinned } from "../../src/corners";
import { cubeMesh } from "./helpers";
import { DEFAULT_UV_CHANNEL, createUvChannel } from "../../src/channels";

describe("automatic chart unwrap selection and channels", () => {
  it("unwraps selected faces only and leaves other UV storage byte-stable", async () => {
    const mesh = cubeMesh();
    for (const corner of mesh.corners.values()) {
      setCornerUv(mesh, corner.id, [0.25, 0.75], DEFAULT_UV_CHANNEL);
    }
    const faceIds = [...mesh.faces.keys()];
    const selected = faceIds[0]!;
    const untouchedIds = mesh.getFaceCorners(faceIds[1]!);
    const beforeRefs = untouchedIds.map((id) => mesh.corners.get(id)!.uv);
    const before = untouchedIds.map((id) => getCornerUv(mesh, id));
    const sharedEdges = mesh.getFaceEdges(selected).filter((edgeId) => {
      const [left, right] = mesh.getEdgeFaces(edgeId);
      return Boolean(left && right && left !== right);
    });
    const result = await automaticUnwrap({
      mesh,
      faceIds: [selected],
      options: { resolution: 128 },
    });
    expect(result.targetedFaceIds).toEqual([selected]);
    expect(result.warnings.some((warning) => warning.code === "overlap-with-unselected")).toBe(true);
    for (const edgeId of sharedEdges) {
      expect(result.seamEdgeIds.has(edgeId)).toBe(true);
    }
    for (let i = 0; i < untouchedIds.length; i += 1) {
      expect(getCornerUv(mesh, untouchedIds[i]!)).toEqual(before[i]);
      expect(mesh.corners.get(untouchedIds[i]!)!.uv).toBe(beforeRefs[i]);
    }
    for (const cornerId of mesh.getFaceCorners(selected)) {
      expect(getCornerUv(mesh, cornerId)).not.toEqual([0.25, 0.75]);
    }
  });

  it("does not overwrite a secondary UV channel", async () => {
    const mesh = cubeMesh();
    const lightmap = createUvChannel(1, { name: "Lightmap" });
    for (const corner of mesh.corners.values()) {
      setCornerUv(mesh, corner.id, [0.1, 0.2], lightmap.id);
    }
    await automaticUnwrap({ mesh, uvChannel: DEFAULT_UV_CHANNEL, options: { resolution: 128 } });
    for (const corner of mesh.corners.values()) {
      expect(getCornerUv(mesh, corner.id, lightmap.id)).toEqual([0.1, 0.2]);
    }
  });

  it("rejects pinned corners unless ignorePins is set", async () => {
    const mesh = cubeMesh();
    const pinned = mesh.getFaceCorners([...mesh.faces.keys()][0]!)[0]!;
    setCornerPinned(mesh, pinned, true);
    const before = getCornerUv(mesh, pinned);
    try {
      await automaticUnwrap({ mesh });
      throw new Error("expected pinned-uv");
    } catch (error) {
      expect(error).toBeInstanceOf(UvUnwrapError);
      expect(error).toMatchObject({ code: "pinned-uv", cornerIds: [pinned] });
    }
    expect(getCornerUv(mesh, pinned)).toEqual(before);
    expect(isCornerPinned(mesh, pinned)).toBe(true);
    const result = await automaticUnwrap({ mesh, options: { ignorePins: true, resolution: 128 } });
    expect(result.warnings.some((warning) => warning.code === "pins-ignored" && warning.cornerIds?.includes(pinned))).toBe(
      true,
    );
    expect(isCornerPinned(mesh, pinned)).toBe(true);
  });
});
