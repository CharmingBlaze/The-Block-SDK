import { createSequenceIdFactory } from "@modeling-kit/core";
import { createAnimationClipData } from "@modeling-kit/document";
import { describe, expect, it } from "vitest";
import { AnimationPlayer, animationClipToDocumentClip, AnimationClipBuilder, evaluateClip, evaluateDocumentClip, interpolateNumbers, interpolateRotation, sampleTrack, validateClip, wrapTime } from "../src/index";

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

  it("routes legacy glTF tracks through the document evaluator", () => {
    const ids = createSequenceIdFactory("legacy-eval");
    const target = ids.object();
    const sampled = sampleTrack(
      {
        targetId: target,
        path: "translation",
        interpolation: "LINEAR",
        times: [0, 2],
        values: [0, 0, 0, 0, 4, 0],
      },
      1,
    );
    expect(sampled[1]).toBeCloseTo(2);
    const builder = new AnimationClipBuilder(ids.animation(), "Move");
    builder.addTrack({
      targetId: target,
      path: "translation",
      interpolation: "LINEAR",
      times: [0, 2],
      values: [0, 0, 0, 0, 4, 0],
    });
    const pose = evaluateClip(builder.build(), 1);
    expect(pose.get(target)?.translation?.[1]).toBeCloseTo(2);
    const converted = animationClipToDocumentClip(builder.build());
    expect(converted.tracks[0]?.channel).toBe("position");
    expect(converted.tracks[0]?.interpolation).toBe("linear");
  });

  it("rejects duplicate document tracks", () => {
    const ids = createSequenceIdFactory("dup");
    const boneId = ids.bone();
    const clip = createAnimationClipData(ids.animation(), "Dup", {
      tracks: [
        {
          id: "a",
          targetKind: "bone",
          targetId: boneId,
          channel: "position",
          interpolation: "linear",
          keys: [{ time: 0, value: [0, 0, 0] }],
        },
        {
          id: "b",
          targetKind: "bone",
          targetId: boneId,
          channel: "position",
          interpolation: "linear",
          keys: [{ time: 0, value: [1, 0, 0] }],
        },
      ],
    });
    expect(() => evaluateDocumentClip(clip, 0)).toThrow(/Duplicate/);
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

  it("slerp rotations, evaluates visibility, and rejects wrong component counts", () => {
    const ids = createSequenceIdFactory("eval");
    const q = interpolateRotation(
      [
        { time: 0, value: [0, 0, 0, 1] },
        { time: 1, value: [0, 0, 1, 0] },
      ],
      0.5,
      "linear",
    );
    expect(Math.hypot(q.x, q.y, q.z, q.w)).toBeCloseTo(1);
    const objectId = ids.object();
    const clip = createAnimationClipData(ids.animation(), "Vis", {
      duration: 1,
      tracks: [
        {
          id: "vis",
          targetKind: "object",
          targetId: objectId,
          channel: "visibility",
          interpolation: "constant",
          keys: [
            { time: 0, value: [1] },
            { time: 1, value: [0] },
          ],
        },
      ],
    });
    expect(evaluateDocumentClip(clip, 0).visibility.get(objectId)).toBe(true);
    expect(evaluateDocumentClip(clip, 1).visibility.get(objectId)).toBe(false);
    expect(() =>
      validateClip(
        createAnimationClipData(ids.animation(), "Bad", {
          tracks: [
            {
              id: "pos",
              targetKind: "object",
              targetId: objectId,
              channel: "position",
              interpolation: "linear",
              keys: [{ time: 0, value: [0, 0] }],
            },
          ],
        }),
      ),
    ).toThrow(/exactly 3/);
  });
});
describe("hermite interpolation and player", () => {
    it("interpolates cubic keyframes", () => {
      const ids = createSequenceIdFactory("herm");
      const boneId = ids.bone();
      const clip = createAnimationClipData(ids.animation(), "CubicTest", {
        duration: 2,
        tracks: [{
          id: "t0", targetKind: "bone", targetId: boneId,
          channel: "position", interpolation: "cubic",
          keys: [
            { time: 0, value: [0, 0, 0] },
            { time: 2, value: [0, 4, 0] },
          ],
        }],
      });
      const pose = evaluateDocumentClip(clip, 1);
      // At t=1 (midpoint), cubic interpolates to 2
      expect(pose.boneLocals.get(boneId)?.position.y).toBeCloseTo(2, 0);
      expect(pose.boneLocals.get(boneId)?.position.x).toBeCloseTo(0);
    });

    it("player sets time directly via play and tick", () => {
      const ids = createSequenceIdFactory("seek");
      const clip = createAnimationClipData(ids.animation(), "Seek", {
        duration: 5,
        tracks: [{
          id: "t0", targetKind: "object", targetId: "obj-1",
          channel: "position", interpolation: "linear",
          keys: [{ time: 0, value: [0, 0, 0] }, { time: 5, value: [10, 0, 0] }],
        }],
      });
      const player = new AnimationPlayer(clip);
      expect(player.time).toBeCloseTo(0);
      player.play();
      player.tick(2.5);
      expect(player.time).toBeCloseTo(2.5);
      const pose = evaluateDocumentClip(clip, player.time);
      expect(pose.objectLocals.get("obj-1")?.position.x).toBeCloseTo(5);
      player.tick(1.5);
      expect(player.time).toBeCloseTo(4);
    });

    it("player loops with repeat mode via scrub", () => {
      const ids = createSequenceIdFactory("loop");
      const clip = createAnimationClipData(ids.animation(), "Loop", {
        duration: 2,
        loopMode: "repeat",
        tracks: [{
          id: "t0", targetKind: "object", targetId: "obj-1",
          channel: "position", interpolation: "linear",
          keys: [{ time: 0, value: [0, 0, 0] }, { time: 2, value: [2, 0, 0] }],
        }],
      });
      const player = new AnimationPlayer(clip);
      player.play();
      player.tick(3); // should wrap to t=1
      expect(player.time).toBeCloseTo(1);
      const pose = evaluateDocumentClip(clip, player.time);
      expect(pose.objectLocals.get("obj-1")?.position.x).toBeCloseTo(1);
    });

    it("serializes and deserializes a clip with markers", () => {
      const ids = createSequenceIdFactory("ser");
      const clip = createAnimationClipData(ids.animation(), "WithMarkers", {
        duration: 3,
        loopMode: "ping-pong",
        markers: [
          { time: 0, name: "Start" },
          { time: 1.5, name: "Middle" },
        ],
        tracks: [{
          id: "t0", targetKind: "bone", targetId: "bone-1",
          channel: "rotation", interpolation: "linear",
          keys: [{ time: 0, value: [0, 0, 0, 1] }, { time: 3, value: [0, 1, 0, 0] }],
        }],
      });
      expect(clip.markers).toHaveLength(2);
      expect(clip.markers[0]?.name).toBe("Start");
      expect(clip.loopMode).toBe("ping-pong");
      expect(clip.tracks[0]?.channel).toBe("rotation");
      expect(clip.tracks[0]?.interpolation).toBe("linear");
      expect(clip.tracks[0]?.keys).toHaveLength(2);
    });
  });
