import { createSequenceIdFactory } from "@modeling-kit/core";
import { createAnimationClipData } from "@modeling-kit/document";
import { describe, expect, it } from "vitest";
import { AnimationPlayer, evaluateDocumentClip, interpolateNumbers, sampleTrack, wrapTime } from "../src/index";

describe("@modeling-kit/animation", () => {
  it("interpolates linear keys at the midpoint", () => {
    const value = interpolateNumbers(
      [
        { time: 0, value: [0] },
        { time: 2, value: [10] },
      ],
      1,
      "linear",
    );
    expect(value[0]).toBeCloseTo(5);
  });

  it("wraps ping-pong time", () => {
    expect(wrapTime(0.25, 1, "ping-pong")).toBeCloseTo(0.25);
    expect(wrapTime(1.25, 1, "ping-pong")).toBeCloseTo(0.75);
  });

  it("evaluates a bone translation track", () => {
    const ids = createSequenceIdFactory("clip");
    const boneId = ids.bone();
    const clip = createAnimationClipData(ids.animation(), "Wave", {
      duration: 2,
      tracks: [
        {
          id: "t0",
          targetKind: "bone",
          targetId: boneId,
          channel: "position",
          interpolation: "linear",
          keys: [
            { time: 0, value: [0, 0, 0] },
            { time: 2, value: [0, 4, 0] },
          ],
        },
      ],
    });
    const pose = evaluateDocumentClip(clip, 1);
    expect(pose.boneLocals.get(boneId)?.position.y).toBeCloseTo(2);
    const player = new AnimationPlayer(clip);
    player.play();
    player.tick(0.5);
    expect(player.time).toBeCloseTo(0.5);
  });

  it("rejects CUBICSPLINE and unsorted tracks", () => {
    const ids = createSequenceIdFactory("legacy");
    expect(() =>
      sampleTrack(
        {
          targetId: ids.object(),
          path: "translation",
          interpolation: "CUBICSPLINE",
          times: [0, 1],
          values: [0, 0, 0, 1, 1, 1],
        },
        0.5,
      ),
    ).toThrow(/CUBICSPLINE/);
    expect(() =>
      sampleTrack(
        {
          targetId: ids.object(),
          path: "translation",
          interpolation: "LINEAR",
          times: [1, 0],
          values: [0, 0, 0, 1, 1, 1],
        },
        0.5,
      ),
    ).toThrow(/sorted/);
  });
});
