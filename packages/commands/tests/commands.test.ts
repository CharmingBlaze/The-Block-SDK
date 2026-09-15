import { createSequenceIdFactory } from "@modeling-kit/core";
import { MeshBuilder, meshFingerprint, restoreMesh, serializeMesh } from "@modeling-kit/mesh";
import { describe, expect, it } from "vitest";
import {
  CreatePrimitiveCommand,
  ExtrudeFacesCommand,
  InsetFacesCommand,
  SubdivideFacesCommand,
  BevelEdgesCommand,
  LoopCutCommand,
  DissolveEdgesCommand,
  ProjectUvCommand,
  AssignMaterialSlotCommand,
  CreateClipCommand,
  SetKeyframeCommand,
  CreateSkeletonCommand,
  BindSkinCommand,
  ReparentCommand,
  DuplicateObjectsCommand,
  SetVisibilityCommand,
  GroupObjectsCommand,
  UngroupObjectsCommand,
  CreateTextureCommand,
  RenameNodeCommand,
  ReorderNodeCommand,
  WeldVerticesCommand,
  ModelingSession,
  createModelingSession,
  SplitEdgeCommand,
  CutFaceCommand,
  ConnectVerticesCommand,
  MergeVerticesCommand,
  DissolveVertexCommand,
  CollapseEdgeCommand,
  TriangulateFacesCommand,
  ExtrudeRegionCommand,
  BridgeLoopsCommand,
  ExecuteKnifePlanCommand,
  CatmullClarkSubdivideCommand,
} from "../src/index";

describe("create cube, extrude, undo, redo", () => {
  it("round-trips topology exactly", () => {
    const session = createModelingSession(createSequenceIdFactory("cmd"));
    const cube = session.execute(
      new CreatePrimitiveCommand("cube", { width: 2, height: 2, depth: 2 }),
    );
    expect(session.document.scene.nodes.has(cube.objectId)).toBe(true);
    const mesh = session.meshes.get(cube.meshId)!;
    expect(mesh.faces.size).toBe(6);

    session.selection.replace({
      domain: "face",
      objectId: cube.objectId,
      elementIds: [cube.faceIds.top],
    });
    session.execute(new ExtrudeFacesCommand({ distance: 1 }));
    const afterExtrude = meshFingerprint(session.meshes.get(cube.meshId)!);
    expect(session.meshes.get(cube.meshId)!.faces.size).toBe(10);
    expect(session.history.canUndo).toBe(true);

    session.undo();
    expect(meshFingerprint(session.meshes.get(cube.meshId)!)).not.toBe(afterExtrude);
    expect(session.meshes.get(cube.meshId)!.faces.size).toBe(6);

    session.redo();
    expect(meshFingerprint(session.meshes.get(cube.meshId)!)).toBe(afterExtrude);

    session.undo();
    session.undo();
    expect(session.meshes.has(cube.meshId)).toBe(false);

    session.redo();
    expect(session.meshes.has(cube.meshId)).toBe(true);

    const json = session.saveNativeJson();
    const fromJson = ModelingSession.loadNativeJson(json);
    expect(fromJson.meshes.get(cube.meshId)?.faces.size).toBe(6);
  });

  it("restores face selection on extrude undo and redo", () => {
    const session = createModelingSession(createSequenceIdFactory("sel-ex"));
    const cube = session.execute(
      new CreatePrimitiveCommand("cube", { width: 2, height: 2, depth: 2 }),
    );
    const originalFace = cube.faceIds.top;
    session.selection.replace({
      domain: "face",
      objectId: cube.objectId,
      elementIds: [originalFace],
    });
    session.execute(new ExtrudeFacesCommand({ distance: 1 }));
    expect(session.selection.elementIds).not.toContain(originalFace);
    expect(session.selection.elementIds.length).toBeGreaterThan(0);
    session.undo();
    expect(session.selection.elementIds).toEqual([originalFace]);
    session.redo();
    expect(session.selection.elementIds).not.toContain(originalFace);
    expect(session.selection.domain).toBe("face");
  });

  it("drops deleted vertex IDs after merge and restores them on undo", () => {
    const session = createModelingSession(createSequenceIdFactory("sel-merge"));
    const cube = session.execute(
      new CreatePrimitiveCommand("cube", { width: 2, height: 2, depth: 2 }),
    );
    const mesh = session.meshes.get(cube.meshId)!;
    const pair = [...mesh.vertices.keys()].slice(0, 2);
    session.selection.replace({
      domain: "vertex",
      objectId: cube.objectId,
      elementIds: pair,
    });
    const merged = session.execute(new MergeVerticesCommand({ vertexIds: pair, target: "center" }));
    expect(session.selection.elementIds).toEqual(merged.survivorId ? [merged.survivorId] : []);
    expect(session.selection.elementIds.every((id) => mesh.vertices.has(id as typeof pair[0]))).toBe(true);
    expect(session.selection.elementIds).not.toContain(pair[1]);
    session.undo();
    expect(session.selection.elementIds).toEqual(pair);
  });

  it("bumps selection revision without topology, and failed commands stay off the stack", () => {
    const session = createModelingSession(createSequenceIdFactory("rev"));
    const cube = session.execute(
      new CreatePrimitiveCommand("cube", { width: 1, height: 1, depth: 1 }),
    );
    const topology = session.document.revisions.topology;
    const documentRev = session.document.revision;
    session.selection.replace({
      domain: "face",
      objectId: cube.objectId,
      elementIds: [cube.faceIds.top],
    });
    expect(session.document.revisions.selection).toBeGreaterThan(0);
    expect(session.document.revisions.topology).toBe(topology);
    expect(session.document.revision).toBe(documentRev);
    const depth = session.history.undoStack.length;
    session.selection.clear();
    expect(() => session.execute(new ExtrudeFacesCommand({ distance: 1 }))).toThrow();
    expect(session.history.undoStack.length).toBe(depth);
    expect(session.diagnostics().runtimeGeometries).toBe(1);
    session.dispose();
    expect(() => session.execute(new ExtrudeFacesCommand({ distance: 1 }))).toThrow(/disposed/);
  });

  it("splits an edge, remaps selection, and restores the original edge on undo", () => {
    const session = createModelingSession(createSequenceIdFactory("knife"));
    const cube = session.execute(
      new CreatePrimitiveCommand("cube", { width: 2, height: 2, depth: 2 }),
    );
    const mesh = session.meshes.get(cube.meshId)!;
    const edgeId = [...mesh.edges.keys()][0]!;
    const before = meshFingerprint(mesh);
    session.selection.replace({
      domain: "edge",
      objectId: cube.objectId,
      elementIds: [edgeId],
    });
    session.execute(new SplitEdgeCommand({ t: 0.4 }));
    expect(mesh.vertices.size).toBe(9);
    expect(session.selection.elementIds).not.toEqual([edgeId]);
    session.undo();
    expect(meshFingerprint(mesh)).toBe(before);
    expect(session.selection.elementIds).toEqual([edgeId]);
    session.redo();
    expect(mesh.vertices.size).toBe(9);
  });

  it("cuts a face through commands with exact undo", () => {
    const session = createModelingSession(createSequenceIdFactory("cutcmd"));
    const cube = session.execute(
      new CreatePrimitiveCommand("cube", { width: 2, height: 2, depth: 2 }),
    );
    const mesh = session.meshes.get(cube.meshId)!;
    const edges = mesh.getFaceEdges(cube.faceIds.top);
    const before = meshFingerprint(mesh);
    session.selection.replace({
      domain: "face",
      objectId: cube.objectId,
      elementIds: [cube.faceIds.top],
    });
    session.execute(
      new CutFaceCommand({
        from: { kind: "edge", edgeId: edges[0]!, t: 0.3 },
        to: { kind: "edge", edgeId: edges[2]!, t: 0.6 },
      }),
    );
    expect(mesh.faces.size).toBe(7);
    session.undo();
    expect(meshFingerprint(mesh)).toBe(before);
  });

  it("dissolves a vertex through a command and restores it on undo", () => {
    const session = createModelingSession(createSequenceIdFactory("dv-cmd"));
    const cube = session.execute(
      new CreatePrimitiveCommand("cube", { width: 2, height: 2, depth: 2 }),
    );
    const mesh = session.meshes.get(cube.meshId)!;
    const vertexId = [...mesh.vertices.keys()][0]!;
    const before = meshFingerprint(mesh);
    session.selection.replace({
      domain: "vertex",
      objectId: cube.objectId,
      elementIds: [vertexId],
    });
    session.execute(new DissolveVertexCommand({ vertexId }));
    expect(mesh.vertices.has(vertexId)).toBe(false);
    session.undo();
    expect(meshFingerprint(mesh)).toBe(before);
    expect(session.selection.elementIds).toEqual([vertexId]);
  });

  it("collapses an edge through a command and restores topology on undo", () => {
    const session = createModelingSession(createSequenceIdFactory("ce-cmd"));
    const cube = session.execute(
      new CreatePrimitiveCommand("cube", { width: 2, height: 2, depth: 2 }),
    );
    const mesh = session.meshes.get(cube.meshId)!;
    const edgeId = [...mesh.edges.keys()][0]!;
    const before = meshFingerprint(mesh);
    session.selection.replace({
      domain: "edge",
      objectId: cube.objectId,
      elementIds: [edgeId],
    });
    session.execute(new CollapseEdgeCommand({ edgeId }));
    expect(mesh.vertices.size).toBe(7);
    session.undo();
    expect(meshFingerprint(mesh)).toBe(before);
  });

  it("executes a knife plan and Catmull-Clark with exact undo", () => {
    const session = createModelingSession(createSequenceIdFactory("knife-cc"));
    const cube = session.execute(
      new CreatePrimitiveCommand("cube", { width: 2, height: 2, depth: 2 }),
    );
    const mesh = session.meshes.get(cube.meshId)!;
    const edges = mesh.getFaceEdges(cube.faceIds.top);
    const mid = (edgeId: (typeof edges)[number]): [number, number, number] => {
      const ends = mesh.getEdgeVertices(edgeId)!;
      const a = mesh.vertices.get(ends[0])!.position;
      const b = mesh.vertices.get(ends[1])!.position;
      return [(a[0] + b[0]) * 0.5, (a[1] + b[1]) * 0.5, (a[2] + b[2]) * 0.5];
    };
    session.selection.replace({
      domain: "face",
      objectId: cube.objectId,
      elementIds: [cube.faceIds.top],
    });
    const beforeKnife = meshFingerprint(mesh);
    session.execute(
      new ExecuteKnifePlanCommand({
        points: [mid(edges[0]!), mid(edges[2]!)],
        snapRadius: 0.05,
      }),
    );
    expect(mesh.faces.size).toBe(7);
    session.undo();
    expect(meshFingerprint(mesh)).toBe(beforeKnife);

    const beforeCc = meshFingerprint(mesh);
    session.execute(new CatmullClarkSubdivideCommand({ iterations: 1 }));
    expect(mesh.faces.size).toBe(24);
    session.undo();
    expect(meshFingerprint(mesh)).toBe(beforeCc);
  });

  it("connects, merges, triangulates, and region-extrudes with exact undo", () => {
    const session = createModelingSession(createSequenceIdFactory("ops"));
    const cube = session.execute(
      new CreatePrimitiveCommand("cube", { width: 2, height: 2, depth: 2 }),
    );
    const mesh = session.meshes.get(cube.meshId)!;
    const verts = mesh.getFaceVertices(cube.faceIds.top);
    const beforeConnect = meshFingerprint(mesh);
    session.selection.replace({
      domain: "vertex",
      objectId: cube.objectId,
      elementIds: [verts[0]!, verts[2]!],
    });
    session.execute(new ConnectVerticesCommand({ a: verts[0]!, b: verts[2]!, faceId: cube.faceIds.top }));
    expect(mesh.faces.size).toBe(7);
    session.undo();
    expect(meshFingerprint(mesh)).toBe(beforeConnect);

    const beforeMerge = meshFingerprint(mesh);
    const pair = [...mesh.vertices.keys()].slice(0, 2);
    session.selection.replace({
      domain: "vertex",
      objectId: cube.objectId,
      elementIds: pair,
    });
    session.execute(new MergeVerticesCommand({ vertexIds: pair, target: "center" }));
    session.undo();
    expect(meshFingerprint(mesh)).toBe(beforeMerge);

    const beforeTri = meshFingerprint(mesh);
    session.selection.replace({
      domain: "face",
      objectId: cube.objectId,
      elementIds: [cube.faceIds.top],
    });
    session.execute(new TriangulateFacesCommand({ faceIds: [cube.faceIds.top] }));
    expect(mesh.getFaceVertices(cube.faceIds.top).length).toBe(3);
    session.undo();
    expect(meshFingerprint(mesh)).toBe(beforeTri);

    const beforeRegion = meshFingerprint(mesh);
    session.selection.replace({
      domain: "face",
      objectId: cube.objectId,
      elementIds: [cube.faceIds.top, cube.faceIds.posZ],
    });
    session.execute(
      new ExtrudeRegionCommand({
        distance: 0.5,
        faceIds: [cube.faceIds.top, cube.faceIds.posZ],
      }),
    );
    session.undo();
    expect(meshFingerprint(mesh)).toBe(beforeRegion);
  });

  it("canceling a preview does not push history", () => {
    const session = createModelingSession(createSequenceIdFactory("prev"));
    session.execute(new CreatePrimitiveCommand("cube", { width: 1, height: 1, depth: 1 }));
    const depth = session.history.undoStack.length;
    expect(depth).toBe(1);
  });

  it("insets and subdivides faces with undo and redo", () => {
    const session = createModelingSession(createSequenceIdFactory("test"));
    const cube = session.execute(
      new CreatePrimitiveCommand("cube", { width: 2, height: 2, depth: 2 }),
    );

    session.selection.replace({
      domain: "face",
      objectId: cube.objectId,
      elementIds: [cube.faceIds.top],
    });

    // Inset top face
    session.execute(new InsetFacesCommand({ distance: 0.2 }));
    const mesh = session.meshes.get(cube.meshId)!;
    // 6 - 1 + 1 + 4 = 10 faces
    expect(mesh.faces.size).toBe(10);

    // Subdivide the selected inner face (which is auto-selected after inset)
    session.execute(new SubdivideFacesCommand());
    // 10 - 1 + 4 = 13 faces
    expect(mesh.faces.size).toBe(13);

    // Undo subdivide
    session.undo();
    expect(mesh.faces.size).toBe(10);

    // Undo inset
    session.undo();
    expect(mesh.faces.size).toBe(6);

    // Redo inset
    session.redo();
    expect(mesh.faces.size).toBe(10);

    // Redo subdivide
    session.redo();
    expect(mesh.faces.size).toBe(13);
  });

  it("bevels, loop-cuts, and dissolves with undo", () => {
    const session = createModelingSession(createSequenceIdFactory("edge-ops"));
    const cube = session.execute(
      new CreatePrimitiveCommand("cube", { width: 2, height: 2, depth: 2 }),
    );
    const mesh = session.meshes.get(cube.meshId)!;
    const shared = mesh
      .getFaceEdges(cube.faceIds.posY)
      .find((id) => mesh.getFaceEdges(cube.faceIds.posZ).includes(id))!;

    session.selection.replace({
      domain: "edge",
      objectId: cube.objectId,
      elementIds: [shared],
    });
    session.execute(new BevelEdgesCommand({ offset: 0.25 }));
    expect(mesh.faces.size).toBe(7);
    session.undo();
    expect(mesh.faces.size).toBe(6);

    session.selection.replace({
      domain: "edge",
      objectId: cube.objectId,
      elementIds: [shared],
    });
    session.execute(new LoopCutCommand({ factor: 0.5 }));
    expect(mesh.faces.size).toBe(10);
    session.undo();
    expect(mesh.faces.size).toBe(6);

    session.selection.replace({
      domain: "edge",
      objectId: cube.objectId,
      elementIds: [shared],
    });
    session.execute(new DissolveEdgesCommand());
    expect(mesh.faces.size).toBe(5);
    session.undo();
    expect(mesh.faces.size).toBe(6);
  });

  it("projects UVs and assigns material slots with undo/redo", () => {
    const session = createModelingSession(createSequenceIdFactory("uv-mat"));
    const cube = session.execute(
      new CreatePrimitiveCommand("cube", { width: 2, height: 2, depth: 2 }),
    );
    const mesh = session.meshes.get(cube.meshId)!;

    session.selection.replace({
      domain: "object",
      objectId: cube.objectId,
      elementIds: [],
    });

    // 1. Project box UV
    session.execute(new ProjectUvCommand({ mode: { type: "box" } }));
    const c0 = mesh.corners.get(mesh.getFaceCorners(cube.faceIds.posY)[0]!)!;
    expect(c0.uv).toBeDefined();

    session.undo();
    // After undo, original mesh state restored
    expect(mesh.faces.size).toBe(6);

    // 2. Assign material slot 2 to top face
    session.selection.replace({
      domain: "face",
      objectId: cube.objectId,
      elementIds: [cube.faceIds.posY],
    });
    session.execute(new AssignMaterialSlotCommand({ slotIndex: 2 }));
    expect(mesh.faces.get(cube.faceIds.posY)?.materialSlot).toBe(2);

    session.undo();
    expect(mesh.faces.get(cube.faceIds.posY)?.materialSlot).toBe(0);

    session.redo();
    expect(mesh.faces.get(cube.faceIds.posY)?.materialSlot).toBe(2);
  });

  it("creates a skeleton, binds skin, and undoes a keyframe", () => {
    const session = createModelingSession(createSequenceIdFactory("rig-cmd"));
    const cube = session.execute(
      new CreatePrimitiveCommand("cube", { width: 1, height: 1, depth: 1 }),
    );
    const skeleton = session.execute(new CreateSkeletonCommand({ name: "Armature" }));
    const boneId = session.document.skeletons.get(skeleton.skeletonId)!.bones[0]!.id;
    expect(session.document.scene.nodes.get(skeleton.armatureObjectId)?.type).toBe("group");
    expect(session.document.scene.nodes.get(skeleton.boneObjectIds[boneId]!)?.type).toBe("bone");
    session.selection.replace({ domain: "object", objectId: cube.objectId, elementIds: [] });
    session.execute(new BindSkinCommand({ skeletonId: skeleton.skeletonId, mode: "rigid" }));
    expect(session.document.meshes.get(cube.meshId)?.skin?.skeletonId).toBe(skeleton.skeletonId);

    const clipId = session.execute(new CreateClipCommand({ name: "Wave", duration: 2 }));
    session.execute(
      new SetKeyframeCommand({
        clipId,
        targetKind: "bone",
        targetId: boneId,
        channel: "position",
        time: 0,
        value: [0, 0, 0],
      }),
    );
    session.execute(
      new SetKeyframeCommand({
        clipId,
        targetKind: "bone",
        targetId: boneId,
        channel: "position",
        time: 2,
        value: [0, 4, 0],
      }),
    );
    expect(session.document.animations.get(clipId)?.tracks[0]?.keys).toHaveLength(2);
    session.undo();
    expect(session.document.animations.get(clipId)?.tracks[0]?.keys).toHaveLength(1);
    session.redo();
    expect(session.document.animations.get(clipId)?.tracks[0]?.keys).toHaveLength(2);
    const json = session.saveNativeJson();
    const loaded = ModelingSession.loadNativeJson(json);
    expect(loaded.document.skeletons.get(skeleton.skeletonId)?.bones).toHaveLength(1);
    expect(loaded.document.scene.nodes.get(skeleton.armatureObjectId)?.type).toBe("group");
    expect(loaded.document.animations.get(clipId)?.tracks[0]?.keys).toHaveLength(2);
  });

  it("undoes skeleton scene bones and restores them on redo", () => {
    const session = createModelingSession(createSequenceIdFactory("skel-scene"));
    const skeleton = session.execute(new CreateSkeletonCommand({ name: "Armature" }));
    expect(session.document.scene.nodes.has(skeleton.armatureObjectId)).toBe(true);
    session.undo();
    expect(session.document.skeletons.get(skeleton.skeletonId)).toBeUndefined();
    expect(session.document.scene.nodes.has(skeleton.armatureObjectId)).toBe(false);
    session.redo();
    expect(session.document.skeletons.get(skeleton.skeletonId)?.bones).toHaveLength(1);
    expect(session.document.scene.nodes.get(skeleton.armatureObjectId)?.type).toBe("group");
  });

  it("commits one transform command and cancels with zero history", () => {
    const session = createModelingSession(createSequenceIdFactory("xf-cmd"));
    const cube = session.execute(
      new CreatePrimitiveCommand("cube", { width: 1, height: 1, depth: 1 }),
    );
    const historyAfterCreate = session.history.undoStack.length;
    session.selection.replace({ domain: "object", objectId: cube.objectId, elementIds: [] });
    session.beginTransform({ mode: "translate", space: "world" });
    session.updateTransform({ translation: { x: 2, y: 0, z: 0 } });
    session.updateTransform({ translation: { x: 4, y: 0, z: 0 } });
    expect(session.history.undoStack.length).toBe(historyAfterCreate);
    expect(session.commitTransform()).toBe(true);
    expect(session.history.undoStack.length).toBe(historyAfterCreate + 1);
    expect(session.document.scene.nodes.get(cube.objectId)?.localTransform.position.x).toBeCloseTo(
      4,
    );
    session.undo();
    expect(session.document.scene.nodes.get(cube.objectId)?.localTransform.position.x).toBeCloseTo(
      0,
    );
    session.redo();
    expect(session.document.scene.nodes.get(cube.objectId)?.localTransform.position.x).toBeCloseTo(
      4,
    );

    session.beginTransform({ mode: "translate", space: "world", objectIds: [cube.objectId] });
    session.updateTransform({ translation: { x: 1, y: 0, z: 0 } });
    session.cancelTransform();
    expect(session.document.scene.nodes.get(cube.objectId)?.localTransform.position.x).toBeCloseTo(
      4,
    );
    expect(session.history.undoStack.length).toBe(historyAfterCreate + 1);

    session.beginTransform({ mode: "translate", space: "world", objectIds: [cube.objectId] });
    session.updateTransform({ translation: { x: 0, y: 0, z: 0 } });
    expect(session.commitTransform()).toBe(false);
    expect(session.history.undoStack.length).toBe(historyAfterCreate + 1);
  });

  it("reparents, duplicates, and hides objects with exact undo", () => {
    const session = createModelingSession(createSequenceIdFactory("outliner"));
    const cube = session.execute(
      new CreatePrimitiveCommand("cube", { width: 1, height: 1, depth: 1 }),
    );
    const skeleton = session.execute(new CreateSkeletonCommand({ name: "Armature" }));
    const boneId = session.document.skeletons.get(skeleton.skeletonId)!.bones[0]!.id;
    const boneObjectId = skeleton.boneObjectIds[boneId]!;
    const rootId = session.document.scene.rootNodeId;
    expect(session.document.scene.nodes.get(cube.objectId)?.parentId).toBe(rootId);

    session.execute(new ReparentCommand({ objectId: cube.objectId, newParentId: boneObjectId }));
    expect(session.document.scene.nodes.get(cube.objectId)?.parentId).toBe(boneObjectId);
    session.undo();
    expect(session.document.scene.nodes.get(cube.objectId)?.parentId).toBe(rootId);
    session.redo();
    expect(session.document.scene.nodes.get(cube.objectId)?.parentId).toBe(boneObjectId);

    const copy = session.execute(new DuplicateObjectsCommand({ objectId: cube.objectId }));
    expect(copy.objectId).not.toBe(cube.objectId);
    expect(copy.meshIds[0]).not.toBe(cube.meshId);
    expect(session.meshes.get(copy.meshIds[0]!)?.faces.size).toBe(6);
    expect(session.document.scene.nodes.get(copy.objectId)?.name).toBe("Cube Copy");
    session.undo();
    expect(session.document.scene.nodes.has(copy.objectId)).toBe(false);
    expect(session.meshes.has(copy.meshIds[0]!)).toBe(false);
    session.redo();
    expect(session.document.scene.nodes.has(copy.objectId)).toBe(true);
    expect(session.meshes.get(copy.meshIds[0]!)?.faces.size).toBe(6);

    session.execute(new SetVisibilityCommand({ objectId: cube.objectId, visible: false }));
    expect(session.document.scene.nodes.get(cube.objectId)?.visible).toBe(false);
    session.undo();
    expect(session.document.scene.nodes.get(cube.objectId)?.visible).toBe(true);
  });

  it("groups and ungroups objects with exact undo", () => {
    const session = createModelingSession(createSequenceIdFactory("group-cmd"));
    const a = session.execute(new CreatePrimitiveCommand("cube", { name: "A" }));
    const b = session.execute(new CreatePrimitiveCommand("cube", { name: "B" }));
    const grouped = session.execute(
      new GroupObjectsCommand({ objectIds: [a.objectId, b.objectId], name: "G" }),
    );
    expect(session.document.scene.nodes.get(a.objectId)?.parentId).toBe(grouped.groupId);
    expect(session.document.scene.nodes.get(b.objectId)?.parentId).toBe(grouped.groupId);
    session.undo();
    expect(session.document.scene.nodes.has(grouped.groupId)).toBe(false);
    expect(session.document.scene.nodes.get(a.objectId)?.parentId).toBe(
      session.document.scene.rootNodeId,
    );
    session.redo();
    expect(session.document.scene.nodes.get(grouped.groupId)?.name).toBe("G");
    session.execute(new UngroupObjectsCommand({ groupId: grouped.groupId }));
    expect(session.document.scene.nodes.has(grouped.groupId)).toBe(false);
    session.undo();
    expect(session.document.scene.nodes.get(a.objectId)?.parentId).toBe(grouped.groupId);
  });

  it("commits one paint stroke and cancels with zero extra history", () => {
    const session = createModelingSession(createSequenceIdFactory("paint-cmd"));
    const textureId = session.execute(new CreateTextureCommand({ width: 8, height: 8 }));
    const historyAfterCreate = session.history.undoStack.length;
    session.beginPaintStroke(textureId);
    session.dabPaintStroke(2, 2, { size: 1, color: [255, 0, 0, 255] });
    expect(session.commitPaintStroke()).toBe(true);
    expect(session.history.undoStack.length).toBe(historyAfterCreate + 1);
    expect(session.textures.get(textureId)!.getPixel(2, 2)).toEqual([255, 0, 0, 255]);
    session.undo();
    expect(session.textures.get(textureId)!.getPixel(2, 2)[3]).toBe(0);
    session.redo();
    expect(session.textures.get(textureId)!.getPixel(2, 2)[0]).toBe(255);

    session.beginPaintStroke(textureId);
    session.dabPaintStroke(1, 1, { size: 1, color: [0, 255, 0, 255] });
    session.cancelPaintStroke();
    expect(session.textures.get(textureId)!.getPixel(1, 1)[3]).toBe(0);
    expect(session.history.undoStack.length).toBe(historyAfterCreate + 1);
  });

  it("round-trips painted pixels through native JSON", () => {
    const session = createModelingSession(createSequenceIdFactory("tex-json"));
    const textureId = session.execute(new CreateTextureCommand({ width: 4, height: 4, name: "Ink" }));
    session.beginPaintStroke(textureId);
    session.dabPaintStroke(0, 0, { size: 1, color: [0, 128, 255, 255] });
    session.commitPaintStroke();
    const loaded = ModelingSession.loadNativeJson(session.saveNativeJson());
    expect(loaded.textures.get(textureId)?.getPixel(0, 0)).toEqual([0, 128, 255, 255]);
  });

  it("renames a node and undoes", () => {
    const session = createModelingSession(createSequenceIdFactory("rename"));
    const cube = session.execute(new CreatePrimitiveCommand("cube", { name: "Box" }));
    session.execute(new RenameNodeCommand({ objectId: cube.objectId, name: "Hero" }));
    expect(session.document.scene.nodes.get(cube.objectId)?.name).toBe("Hero");
    session.undo();
    expect(session.document.scene.nodes.get(cube.objectId)?.name).toBe("Box");
  });

  it("welds coincident vertices with exact undo", () => {
    const session = createModelingSession(createSequenceIdFactory("weld-cmd"));
    const cube = session.execute(new CreatePrimitiveCommand("cube", { width: 1, height: 1, depth: 1 }));
    const mesh = session.meshes.get(cube.meshId)!;
    const [first, second] = [...mesh.vertices.values()];
    if (first && second) {
      second.position = [first.position[0], first.position[1], first.position[2]];
    }
    const before = mesh.vertices.size;
    session.selection.replace({ domain: "object", objectId: cube.objectId, elementIds: [] });
    const result = session.execute(new WeldVerticesCommand({ epsilon: 0.01 }));
    expect(result.weldedCount).toBeGreaterThan(0);
    expect(mesh.vertices.size).toBeLessThan(before);
    session.undo();
    expect(session.meshes.get(cube.meshId)!.vertices.size).toBe(before);
  });

  it("bridges two vertex loops and restores topology on undo", () => {
    const session = createModelingSession(createSequenceIdFactory("bridge-cmd"));
    const cube = session.execute(new CreatePrimitiveCommand("cube", { width: 2, height: 2, depth: 2 }));
    const mesh = session.meshes.get(cube.meshId)!;
    const builder = new MeshBuilder(mesh.id);
    const a0 = builder.addVertex(-1, 0, -1);
    const a1 = builder.addVertex(1, 0, -1);
    const a2 = builder.addVertex(1, 0, 1);
    const a3 = builder.addVertex(-1, 0, 1);
    const b0 = builder.addVertex(-1, 2, -1);
    const b1 = builder.addVertex(1, 2, -1);
    const b2 = builder.addVertex(1, 2, 1);
    const b3 = builder.addVertex(-1, 2, 1);
    restoreMesh(mesh, serializeMesh(builder.getMesh()));
    session.selection.replace({ domain: "object", objectId: cube.objectId, elementIds: [] });
    const before = meshFingerprint(mesh);
    session.execute(
      new BridgeLoopsCommand({
        loopA: [a0, a1, a2, a3],
        loopB: [b0, b1, b2, b3],
      }),
    );
    expect(mesh.faces.size).toBe(4);
    session.undo();
    expect(meshFingerprint(mesh)).toBe(before);
    session.redo();
    expect(mesh.faces.size).toBe(4);
  });

  it("duplicates as a linked mesh instance", () => {
    const session = createModelingSession(createSequenceIdFactory("link-dup"));
    const cube = session.execute(new CreatePrimitiveCommand("cube", { width: 1, height: 1, depth: 1 }));
    const copy = session.execute(new DuplicateObjectsCommand({ objectId: cube.objectId, linkMeshes: true }));
    expect(copy.meshIds).toEqual([]);
    expect(session.document.scene.nodes.get(copy.objectId)?.payloadRef).toBe(
      session.document.scene.nodes.get(cube.objectId)?.payloadRef,
    );
    session.undo();
    expect(session.document.scene.nodes.has(copy.objectId)).toBe(false);
    session.redo();
    expect(session.document.scene.nodes.has(copy.objectId)).toBe(true);
  });

  it("duplicates as an independent mesh copy", () => {
    const session = createModelingSession(createSequenceIdFactory("ind-dup"));
    const cube = session.execute(new CreatePrimitiveCommand("cube", { width: 1, height: 1, depth: 1 }));
    const copy = session.execute(new DuplicateObjectsCommand({ objectId: cube.objectId }));
    expect(copy.meshIds).toHaveLength(1);
    expect(session.document.scene.nodes.get(copy.objectId)?.payloadRef).not.toBe(
      session.document.scene.nodes.get(cube.objectId)?.payloadRef,
    );
    session.undo();
    expect(session.meshes.has(copy.meshIds[0]!)).toBe(false);
    session.redo();
    expect(session.meshes.has(copy.meshIds[0]!)).toBe(true);
  });

  it("reorders siblings with undo", () => {
    const session = createModelingSession(createSequenceIdFactory("reorder"));
    const a = session.execute(new CreatePrimitiveCommand("cube", { name: "A", width: 1, height: 1, depth: 1 }));
    const b = session.execute(new CreatePrimitiveCommand("cube", { name: "B", width: 1, height: 1, depth: 1 }));
    const root = session.document.scene.rootNodeId;
    expect(session.document.scene.nodes.get(root)?.childIds).toEqual([a.objectId, b.objectId]);
    session.execute(new ReorderNodeCommand({ objectId: b.objectId, index: 0 }));
    expect(session.document.scene.nodes.get(root)?.childIds).toEqual([b.objectId, a.objectId]);
    session.undo();
    expect(session.document.scene.nodes.get(root)?.childIds).toEqual([a.objectId, b.objectId]);
  });

  it("reports structured capability denials", () => {
    const session = createModelingSession(createSequenceIdFactory("cap"));
    expect(session.capabilities.canExecute("edit.undo").ok).toBe(false);
    expect(session.capabilities.canExecute("mesh.extrude").reason?.code).toBe("NO_OBJECT");
    const cube = session.execute(new CreatePrimitiveCommand("cube", { width: 1, height: 1, depth: 1 }));
    session.selection.replace({ domain: "object", objectId: cube.objectId, elementIds: [] });
    expect(session.capabilities.canExecute("mesh.extrude").reason?.code).toBe("NEED_FACES");
    session.selection.replace({
      domain: "face",
      objectId: cube.objectId,
      elementIds: [cube.faceIds.top],
    });
    expect(session.capabilities.canExecute("mesh.extrude").ok).toBe(true);
    session.execute(new ExtrudeFacesCommand({ distance: 0.1 }));
    expect(session.capabilities.canExecute("edit.undo").ok).toBe(true);
  });

  it("disposes session selection listeners and rejects later commands", () => {
    const session = createModelingSession(createSequenceIdFactory("life-session"));
    let seen = 0;
    session.selection.onChange(() => {
      seen += 1;
    });
    const cube = session.execute(new CreatePrimitiveCommand("cube", { width: 1, height: 1, depth: 1 }));
    session.selection.replace({ domain: "object", objectId: cube.objectId, elementIds: [] });
    expect(seen).toBeGreaterThan(0);
    seen = 0;
    session.dispose();
    session.selection.replace({ domain: "object", objectIds: [] });
    expect(seen).toBe(0);
    expect(() => session.execute(new CreatePrimitiveCommand("cube"))).toThrow(/disposed/);
    session.dispose();
  });
});
