import { createSequenceIdFactory } from "@modeling-kit/core";
import { createAnimationClipData } from "@modeling-kit/document";
import { identityTransform } from "@modeling-kit/math";
import { MeshBuilder } from "@modeling-kit/mesh";
import { SkeletonBuilder, skinningFromEntries } from "@modeling-kit/rigging";
import { describe, expect, it } from "vitest";
import {
  createAnimationPlayback,
  createThreeAnimationClip,
  createThreeSkeleton,
  createThreeSkinnedMesh,
  disposeThreeAnimation,
  disposeThreeSkeleton,
  playThreeClip,
  updateThreeAnimation,
  updateThreeSkeleton,
} from "../src/index";

describe("Three.js rigging and animation adapters", () => {
  it("maps canonical bones, skins a mesh, plays clips, and disposes", () => {
    const ids = createSequenceIdFactory("three-rig");
    const root = ids.bone();
    const child = ids.bone();
    const skeleton = new SkeletonBuilder(ids.skeleton(), "Arm")
      .addBone({ id: root, name: "Root" })
      .addBone({
        id: child,
        name: "Limb",
        parentId: root,
        restTransform: { ...identityTransform(), position: { x: 0, y: 1, z: 0 } },
      })
      .build();
    const resources = createThreeSkeleton(skeleton);
    expect(resources.bones).toHaveLength(2);
    expect(resources.boneById.get(child)?.parent).toBe(resources.boneById.get(root));
    expect(resources.boneById.get(child)?.position.y).toBeCloseTo(1);

    const mesh = MeshBuilder.createCube(1, 1, 1, ids.mesh());
    const vertexId = [...mesh.vertices.keys()][0]!;
    const skin = skinningFromEntries(skeleton.id, [{ vertexId, influences: [{ boneId: child, weight: 1 }] }]);
    const skinned = createThreeSkinnedMesh(mesh, skeleton, skin);
    expect(skinned.mesh.geometry.getAttribute("skinIndex")).toBeDefined();
    expect(skinned.mesh.geometry.getAttribute("skinWeight")).toBeDefined();

    const clipA = createAnimationClipData(ids.animation(), "Lift", {
      duration: 1,
      tracks: [
        {
          id: "t",
          targetKind: "bone",
          targetId: child,
          channel: "position",
          interpolation: "linear",
          keys: [
            { time: 0, value: [0, 1, 0] },
            { time: 1, value: [0, 2, 0] },
          ],
        },
      ],
    });
    const clipB = createAnimationClipData(ids.animation(), "Twist", {
      duration: 1,
      tracks: [
        {
          id: "r",
          targetKind: "bone",
          targetId: child,
          channel: "rotation",
          interpolation: "linear",
          keys: [
            { time: 0, value: [0, 0, 0, 1] },
            { time: 1, value: [0, 0, 1, 0] },
          ],
        },
      ],
    });
    const threeA = createThreeAnimationClip(clipA, { skeleton: resources });
    const threeB = createThreeAnimationClip(clipB, { skeleton: resources });
    expect(threeA.tracks).toHaveLength(1);
    expect(threeB.tracks[0]?.name).toMatch(/quaternion/);
    const playback = createAnimationPlayback(skinned.mesh, new Map([
      [clipA.id, threeA],
      [clipB.id, threeB],
    ]));
    playThreeClip(playback, clipA.id, "repeat");
    updateThreeAnimation(playback, 0.25);
    playThreeClip(playback, clipB.id, "once");
    updateThreeSkeleton(resources, skeleton);
    disposeThreeAnimation(playback);
    disposeThreeSkeleton(resources, skinned.mesh);
    const rebuilt = createThreeSkeleton(skeleton);
    disposeThreeSkeleton(rebuilt);
  });
});
