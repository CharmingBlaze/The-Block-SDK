import { CyclicHierarchyError, createSequenceIdFactory } from "@modeling-kit/core";
import { identityTransform, Quaternion } from "@modeling-kit/math";
import { MeshBuilder } from "@modeling-kit/mesh";
import { describe, expect, it } from "vitest";
import {
  SkeletonBuilder,
  assignRigidWeights,
  collectRootBoneIds,
  inverseBindMatchesRest,
  normalizeWeights,
  normalizeWeightsWithReport,
  reparentBone,
  resolveInverseBindMatrix,
  skinFromBinding,
  skinPositions,
  skeletonFromData,
  skeletonToData,
  skinningFromEntries,
  validateSkeletonData,
  validateSkinBinding,
} from "../src/index";

describe("@modeling-kit/rigging", () => {
  it("rejects cyclic bone reparenting", () => {
    const ids = createSequenceIdFactory("rig");
    const root = ids.bone();
    const child = ids.bone();
    const skeleton = new SkeletonBuilder(ids.skeleton(), "Arm")
      .addBone({ id: root, name: "Root" })
      .addBone({
        id: child,
        name: "Limb",
        parentId: root,
        restTransform: {
          ...identityTransform(),
          position: { x: 0, y: 1, z: 0 },
        },
      })
      .build();
    expect(() => reparentBone(skeleton, root, child)).toThrow(CyclicHierarchyError);
  });

  it("normalizes and limits influences", () => {
    const ids = createSequenceIdFactory("w");
    const limited = normalizeWeights(
      [
        { boneId: ids.bone(), weight: 2 },
        { boneId: ids.bone(), weight: 2 },
        { boneId: ids.bone(), weight: 1 },
      ],
      2,
    );
    expect(limited).toHaveLength(2);
    expect(limited[0]!.weight + limited[1]!.weight).toBeCloseTo(1);
  });

  it("skins a vertex rigidly to a child bone", () => {
    const ids = createSequenceIdFactory("skin");
    const root = ids.bone();
    const child = ids.bone();
    const skeleton = new SkeletonBuilder(ids.skeleton())
      .addBone({ id: root, name: "Root" })
      .addBone({
        id: child,
        name: "Limb",
        parentId: root,
        restTransform: {
          ...identityTransform(),
          position: { x: 0, y: 1, z: 0 },
        },
      })
      .build();
    const mesh = MeshBuilder.createCube(2, 2, 2, ids.mesh());
    const vertexId = [...mesh.vertices.keys()][0]!;
    mesh.vertices.get(vertexId)!.position = [1, 1, 0];
    const skin = skinningFromEntries(skeleton.id, [
      { vertexId, influences: [{ boneId: child, weight: 1 }] },
    ]);
    const pose = new Map([
      [
        child,
        {
          ...identityTransform(),
          position: { x: 0, y: 1, z: 0 },
          rotation: Quaternion.fromAxisAngle({ x: 0, y: 0, z: 1 }, Math.PI / 2).toJSON(),
        },
      ],
    ]);
    const posed = skinPositions(mesh, skeleton, skin, pose).get(vertexId)!;
    expect(posed.x).toBeCloseTo(0, 4);
    expect(posed.y).toBeCloseTo(2, 4);
    expect(posed.z).toBeCloseTo(0, 4);
    const rigid = assignRigidWeights(mesh, child);
    expect(rigid.get(vertexId)?.[0]?.weight).toBe(1);
  });

  it("rejects duplicate bone ids, missing parents, and cyclic graphs", () => {
    const ids = createSequenceIdFactory("cycle");
    const a = ids.bone();
    const b = ids.bone();
    expect(() =>
      new SkeletonBuilder(ids.skeleton())
        .addBone({ id: a, name: "A" })
        .addBone({ id: a, name: "A2" })
        .build(),
    ).toThrow(/already defined/);
    expect(() =>
      new SkeletonBuilder(ids.skeleton())
        .addBone({ id: a, name: "A", parentId: b })
        .addBone({ id: b, name: "B", parentId: a })
        .build(),
    ).toThrow();
    const missing = ids.bone();
    expect(() =>
      new SkeletonBuilder(ids.skeleton()).addBone({ id: a, name: "A", parentId: missing }).build(),
    ).toThrow();
    const skeleton = new SkeletonBuilder(ids.skeleton())
      .addBone({ id: a, name: "A" })
      .addBone({ id: b, name: "B", parentId: a })
      .build();
    expect(() => reparentBone(skeleton, a, ids.bone())).toThrow();
  });

  it("rejects invalid weights and keeps rest pose when all influences are missing", () => {
    const ids = createSequenceIdFactory("w2");
    expect(() => normalizeWeights([{ boneId: ids.bone(), weight: -1 }])).toThrow();
    const merged = normalizeWeights(
      [
        { boneId: ids.bone(), weight: 1 },
        { boneId: ids.bone(), weight: 1 },
      ].map((item, index) => (index === 1 ? { boneId: item.boneId, weight: 1 } : item)),
    );
    expect(merged.length).toBeGreaterThan(0);
    const bone = ids.bone();
    const combined = normalizeWeights(
      [
        { boneId: bone, weight: 0.25 },
        { boneId: bone, weight: 0.75 },
      ],
      4,
    );
    expect(combined).toHaveLength(1);
    expect(combined[0]!.weight).toBeCloseTo(1);
    const root = ids.bone();
    const skeleton = new SkeletonBuilder(ids.skeleton()).addBone({ id: root, name: "Root" }).build();
    const mesh = MeshBuilder.createCube(1, 1, 1, ids.mesh());
    const vertexId = [...mesh.vertices.keys()][0]!;
    const rest = mesh.vertices.get(vertexId)!.position;
    const missing = ids.bone();
    const posed = skinPositions(
      mesh,
      skeleton,
      skinningFromEntries(skeleton.id, [{ vertexId, influences: [{ boneId: missing, weight: 1 }] }]),
    ).get(vertexId)!;
    expect(posed.x).toBeCloseTo(rest[0]);
    expect(posed.y).toBeCloseTo(rest[1]);
    expect(posed.z).toBeCloseTo(rest[2]);
  });

  it("allows multiple roots, validates rest IBM, and uses authored identity IBMs", () => {
    const ids = createSequenceIdFactory("forest");
    const a = ids.bone();
    const b = ids.bone();
    const skeleton = new SkeletonBuilder(ids.skeleton(), "Forest")
      .addBone({ id: a, name: "A" })
      .addBone({
        id: b,
        name: "B",
        restTransform: { ...identityTransform(), position: { x: 2, y: 0, z: 0 } },
      })
      .build();
    expect(collectRootBoneIds(skeleton.bones).sort()).toEqual([a, b].sort());
    expect(validateSkeletonData(skeletonToData(skeleton))).toEqual([]);
    expect(inverseBindMatchesRest(skeleton, skeleton.bones.get(a)!.inverseBindMatrix, a)).toBe(true);
    const data = skeletonToData(skeleton);
    const roundtrip = skeletonFromData(data);
    expect(roundtrip.rootBoneIds).toHaveLength(2);
    const vertexId = ids.vertex();
    const identitySkin = skinFromBinding({
      skeletonId: skeleton.id,
      maxInfluences: 4,
      vertices: [{ vertexId, influences: [{ boneId: a, weight: 1 }] }],
      inverseBindMatrices: [
        { boneId: a, matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] },
      ],
    });
    const ibm = resolveInverseBindMatrix(skeleton, identitySkin, a);
    expect(ibm.elements[0]).toBe(1);
    expect(ibm.elements[12]).toBe(0);
    const missing = resolveInverseBindMatrix(skeleton, identitySkin, b);
    expect(missing.elements).toEqual([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    const issues = validateSkinBinding(skeleton, identitySkin);
    expect(issues.some((item) => item.code === "IBM_MISSING_BONE")).toBe(false);
    const extra = [ids.bone(), ids.bone(), ids.bone(), ids.bone()] as const;
    const reported = normalizeWeightsWithReport(
      [
        { boneId: a, weight: 0.8 },
        { boneId: a, weight: 0.2 },
        { boneId: b, weight: 0 },
        { boneId: extra[0], weight: 0.05 },
        { boneId: extra[1], weight: 0.04 },
        { boneId: extra[2], weight: 0.03 },
        { boneId: extra[3], weight: 0.02 },
      ],
      4,
    );
    expect(reported.influences).toHaveLength(4);
    expect(reported.dropped.some((item) => item.weight === 0 || item.weight === 0.02)).toBe(true);
    expect(reported.influences.reduce((sum, item) => sum + item.weight, 0)).toBeCloseTo(1);
  });
});
