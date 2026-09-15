import { describe, expect, it } from "vitest";
import * as ModelingKit from "../src/index";

describe("@modeling-kit/sdk unified portal", () => {
  it("exports all core modeling subsystems", () => {
    // Commands & Session
    expect(ModelingKit.createModelingSession).toBeDefined();
    expect(ModelingKit.CreatePrimitiveCommand).toBeDefined();
    expect(ModelingKit.generateBox).toBeDefined();
    expect(ModelingKit.ExtrudeFacesCommand).toBeDefined();
    expect(ModelingKit.InsetFacesCommand).toBeDefined();
    expect(ModelingKit.SubdivideFacesCommand).toBeDefined();
    expect(ModelingKit.BevelEdgesCommand).toBeDefined();
    expect(ModelingKit.LoopCutCommand).toBeDefined();
    expect(ModelingKit.DissolveEdgesCommand).toBeDefined();
    expect(ModelingKit.BridgeLoopsCommand).toBeDefined();
    expect(ModelingKit.SplitEdgeCommand).toBeDefined();
    expect(ModelingKit.CutFaceCommand).toBeDefined();
    expect(ModelingKit.splitEdge).toBeDefined();
    expect(ModelingKit.cutFace).toBeDefined();

    // Materials & UV
    expect(ModelingKit.createPbrMaterial).toBeDefined();
    expect(ModelingKit.projectBoxUv).toBeDefined();
    expect(ModelingKit.packUvs).toBeDefined();

    // Rigging & Animation
    expect(ModelingKit.SkeletonBuilder).toBeDefined();
    expect(ModelingKit.AnimationClipBuilder).toBeDefined();

    // Paint
    expect(ModelingKit.TextureBuffer).toBeDefined();
    expect(ModelingKit.drawBrushLine).toBeDefined();

    // Formats
    expect(ModelingKit.exportObj).toBeDefined();
    expect(ModelingKit.importObj).toBeDefined();
    expect(ModelingKit.exportStlAscii).toBeDefined();
    expect(ModelingKit.exportGltf).toBeDefined();
    expect(ModelingKit.exportGlb).toBeDefined();
    expect(ModelingKit.importGltf).toBeDefined();

    // Workers
    expect(ModelingKit.AsyncComputePool).toBeDefined();
    expect(ModelingKit.defaultComputePool).toBeDefined();
  });

  it("executes Milestone 1 vertical workflow end-to-end", () => {
    const session = ModelingKit.createModelingSession();
    const cube = session.execute(
      new ModelingKit.CreatePrimitiveCommand("cube", { width: 2, height: 2, depth: 2 }),
    );

    expect(cube.objectId).toBeDefined();
    expect(cube.faceIds.top).toBeDefined();

    session.selection.replace({
      domain: "face",
      objectId: cube.objectId,
      elementIds: [cube.faceIds.top],
    });

    session.execute(new ModelingKit.ExtrudeFacesCommand({ distance: 1 }));
    expect(session.meshes.get(cube.meshId)!.faces.size).toBe(10);

    session.undo();
    expect(session.meshes.get(cube.meshId)!.faces.size).toBe(6);

    session.redo();
    expect(session.meshes.get(cube.meshId)!.faces.size).toBe(10);

    const json = session.saveNativeJson();
    const reloaded = ModelingKit.ModelingSession.loadNativeJson(json);
    expect(reloaded.meshes.get(cube.meshId)!.faces.size).toBe(10);
  });
});
