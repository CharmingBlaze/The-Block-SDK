import { describe, expect, it } from "vitest";
import {
  FORMAT_ASPECTS,
  FORMAT_CAPABILITY_MATRIX,
  FORMAT_FIDELITIES,
  FORMAT_IDS,
  formatAspectFidelity,
  formatCapability,
} from "../src/index";

describe("format capability matrix", () => {
  it("covers every published format id and aspect", () => {
    expect(FORMAT_CAPABILITY_MATRIX.map((row) => row.id)).toEqual([...FORMAT_IDS]);
    for (const row of FORMAT_CAPABILITY_MATRIX) {
      expect(Object.keys(row.aspects).sort()).toEqual([...FORMAT_ASPECTS].sort());
      for (const aspect of FORMAT_ASPECTS) {
        expect(FORMAT_FIDELITIES).toContain(row.aspects[aspect].fidelity);
        expect(row.aspects[aspect].summary.length).toBeGreaterThan(0);
      }
    }
  });

  it("states honest fidelity for canonical vs interchange codecs", () => {
    for (const aspect of FORMAT_ASPECTS) {
      expect(formatAspectFidelity("native-json", aspect).fidelity).toBe("preserve");
    }
    // PLY carries geometry only: faces survive as index lists, nothing else does.
    expect(formatAspectFidelity("ply", "topology").fidelity).toBe("approximate");
    for (const aspect of ["materials", "skins", "animation"] as const) {
      expect(formatAspectFidelity("ply", aspect).fidelity).toBe("lose");
    }
    expect(formatCapability("gltf").aspects).toEqual(formatCapability("glb").aspects);
    expect(formatAspectFidelity("gltf", "topology").fidelity).toBe("approximate");
    expect(formatAspectFidelity("obj", "topology").fidelity).toBe("approximate");
    expect(formatAspectFidelity("obj", "materials").fidelity).toBe("lose");
    expect(formatAspectFidelity("obj", "skins").fidelity).toBe("lose");
    expect(formatAspectFidelity("obj", "animation").fidelity).toBe("lose");
    expect(formatAspectFidelity("stl-ascii", "topology").fidelity).toBe("lose");
    expect(formatCapability("ply").codec).toBe("implemented");
    expect(formatCapability("ppm").aspects.topology.fidelity).toBe("none");
  });
});
