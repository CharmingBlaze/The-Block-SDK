import { createSequenceIdFactory, type EdgeId, type VertexId } from "@modeling-kit/core";
import {
  MeshBuilder,
  cloneMesh,
  setEdgeCreaseWeights,
  type HalfEdgeMesh,
} from "../../src/index";

export function uniqueIds(prefix: string): ReturnType<typeof createSequenceIdFactory> {
  return createSequenceIdFactory(prefix);
}

export function closedCube(prefix: string, size = 2): {
  mesh: HalfEdgeMesh;
  ids: ReturnType<typeof createSequenceIdFactory>;
} {
  const ids = uniqueIds(prefix);
  return { mesh: cloneMesh(MeshBuilder.createCube(size, size, size, ids.mesh())), ids };
}

export function openQuad(prefix: string): {
  mesh: HalfEdgeMesh;
  ids: ReturnType<typeof createSequenceIdFactory>;
} {
  const ids = uniqueIds(prefix);
  return {
    mesh: cloneMesh(MeshBuilder.createQuad([-1, 0, -1], [1, 0, -1], [1, 0, 1], [-1, 0, 1], ids.mesh())),
    ids,
  };
}

export function openNgon(prefix: string, sides = 5): {
  mesh: HalfEdgeMesh;
  ids: ReturnType<typeof createSequenceIdFactory>;
} {
  const ids = uniqueIds(prefix);
  const builder = new MeshBuilder(ids.mesh());
  const verts: VertexId[] = [];
  for (let i = 0; i < sides; i++) {
    const angle = (i / sides) * Math.PI * 2;
    verts.push(builder.addVertex(Math.cos(angle), 0, Math.sin(angle)));
  }
  builder.addFace(verts);
  return { mesh: builder.getMesh(), ids };
}

export function concaveLNgon(prefix: string): {
  mesh: HalfEdgeMesh;
  ids: ReturnType<typeof createSequenceIdFactory>;
} {
  const ids = uniqueIds(prefix);
  const builder = new MeshBuilder(ids.mesh());
  const verts = [
    builder.addVertex(0, 0, 0),
    builder.addVertex(2, 0, 0),
    builder.addVertex(2, 1, 0),
    builder.addVertex(1, 1, 0),
    builder.addVertex(1, 2, 0),
    builder.addVertex(0, 2, 0),
  ];
  builder.addFace(verts);
  return { mesh: builder.getMesh(), ids };
}

export function mixedTriQuad(prefix: string): {
  mesh: HalfEdgeMesh;
  ids: ReturnType<typeof createSequenceIdFactory>;
} {
  const ids = uniqueIds(prefix);
  const builder = new MeshBuilder(ids.mesh());
  const v0 = builder.addVertex(0, 0, 0);
  const v1 = builder.addVertex(1, 0, 0);
  const v2 = builder.addVertex(1, 1, 0);
  const v3 = builder.addVertex(0, 1, 0);
  const v4 = builder.addVertex(0.5, 1.6, 0);
  builder.addFace([v0, v1, v2, v3], {
    uvs: [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
    materialSlot: 0,
  });
  builder.addFace([v3, v2, v4], {
    uvs: [
      [0, 1],
      [1, 1],
      [0.5, 1.5],
    ],
    materialSlot: 1,
  });
  return { mesh: builder.getMesh(), ids };
}

export function holedRing(prefix: string): {
  mesh: HalfEdgeMesh;
  ids: ReturnType<typeof createSequenceIdFactory>;
} {
  const ids = uniqueIds(prefix);
  const builder = new MeshBuilder(ids.mesh());
  const outer = [
    builder.addVertex(-2, 0, -2),
    builder.addVertex(2, 0, -2),
    builder.addVertex(2, 0, 2),
    builder.addVertex(-2, 0, 2),
  ];
  const inner = [
    builder.addVertex(-1, 0, -1),
    builder.addVertex(1, 0, -1),
    builder.addVertex(1, 0, 1),
    builder.addVertex(-1, 0, 1),
  ];
  builder.addFace([outer[0]!, inner[0]!, inner[1]!, outer[1]!]);
  builder.addFace([outer[1]!, inner[1]!, inner[2]!, outer[2]!]);
  builder.addFace([outer[2]!, inner[2]!, inner[3]!, outer[3]!]);
  builder.addFace([outer[3]!, inner[3]!, inner[0]!, outer[0]!]);
  return { mesh: builder.getMesh(), ids };
}

export function twoComponents(prefix: string): {
  mesh: HalfEdgeMesh;
  ids: ReturnType<typeof createSequenceIdFactory>;
} {
  const ids = uniqueIds(prefix);
  const builder = new MeshBuilder(ids.mesh());
  const a = builder.addVertex(0, 0, 0);
  const b = builder.addVertex(1, 0, 0);
  const c = builder.addVertex(0, 1, 0);
  builder.addFace([a, b, c]);
  const d = builder.addVertex(4, 0, 0);
  const e = builder.addVertex(5, 0, 0);
  const f = builder.addVertex(4, 1, 0);
  builder.addFace([d, e, f]);
  return { mesh: builder.getMesh(), ids };
}

export function creasedSeamedCube(prefix: string): {
  mesh: HalfEdgeMesh;
  ids: ReturnType<typeof createSequenceIdFactory>;
} {
  const { mesh, ids } = closedCube(prefix, 1);
  const edgeId = [...mesh.edges.keys()][0]!;
  setEdgeCreaseWeights(mesh, { edgeIds: [edgeId], weight: 1 });
  const edge = mesh.edges.get(edgeId)!;
  edge.isSeam = true;
  return { mesh, ids };
}

export function mirroredCube(prefix: string): {
  mesh: HalfEdgeMesh;
  ids: ReturnType<typeof createSequenceIdFactory>;
} {
  const { mesh, ids } = closedCube(prefix, 1);
  for (const vertex of mesh.vertices.values()) {
    vertex.position[0] *= -1;
  }
  return { mesh, ids };
}

export function nearCoincidentTriangle(prefix: string, delta: number): {
  mesh: HalfEdgeMesh;
  ids: ReturnType<typeof createSequenceIdFactory>;
} {
  const ids = uniqueIds(prefix);
  const builder = new MeshBuilder(ids.mesh());
  const a = builder.addVertex(0, 0, 0);
  const b = builder.addVertex(1, 0, 0);
  const c = builder.addVertex(0, 1, 0);
  builder.addVertex(delta, 0, 0);
  builder.addFace([a, b, c]);
  return { mesh: builder.getMesh(), ids };
}

export function nonManifoldBowtie(prefix: string): {
  mesh: HalfEdgeMesh;
  ids: ReturnType<typeof createSequenceIdFactory>;
} {
  const ids = uniqueIds(prefix);
  const builder = new MeshBuilder({ meshId: ids.mesh(), manifoldPolicy: "allow-non-manifold" });
  const a = builder.addVertex(0, 0, 0);
  const b = builder.addVertex(1, 0, 0);
  const c = builder.addVertex(0, 1, 0);
  const d = builder.addVertex(0, 0, 1);
  const e = builder.addVertex(0, 1, 1);
  builder.addFace([a, b, c]);
  builder.addFace([a, d, e]);
  return { mesh: builder.getMesh(), ids };
}

export function disjointLoops(
  prefix: string,
  gap: number,
): {
  mesh: HalfEdgeMesh;
  loopA: VertexId[];
  loopB: VertexId[];
  ids: ReturnType<typeof createSequenceIdFactory>;
} {
  const ids = uniqueIds(prefix);
  const builder = new MeshBuilder(ids.mesh());
  const loopA = [
    builder.addVertex(-1, 0, -1),
    builder.addVertex(1, 0, -1),
    builder.addVertex(1, 0, 1),
    builder.addVertex(-1, 0, 1),
  ];
  const loopB = [
    builder.addVertex(-1, gap, -1),
    builder.addVertex(1, gap, -1),
    builder.addVertex(1, gap, 1),
    builder.addVertex(-1, gap, 1),
  ];
  return { mesh: builder.getMesh(), loopA, loopB, ids };
}

export function faceEdgeMidpoint(
  mesh: HalfEdgeMesh,
  edgeId: EdgeId,
): [number, number, number] {
  const ends = mesh.getEdgeVertices(edgeId)!;
  const a = mesh.vertices.get(ends[0])!.position;
  const b = mesh.vertices.get(ends[1])!.position;
  return [(a[0] + b[0]) * 0.5, (a[1] + b[1]) * 0.5, (a[2] + b[2]) * 0.5];
}
