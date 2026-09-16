import { createSequenceIdFactory } from "@modeling-kit/core";
import { MeshBuilder, subdivideFaces, type HalfEdgeMesh } from "@modeling-kit/mesh";
import { generateCapsule, generateQuadSphere, generateTorus, generateUvSphere } from "@modeling-kit/primitives";

export function triangleMesh(): HalfEdgeMesh {
  return MeshBuilder.createTriangle([0, 0, 0], [1, 0, 0], [0, 1, 0]);
}

export function quadMesh(): HalfEdgeMesh {
  return MeshBuilder.createQuad([0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]);
}

export function cubeMesh(): HalfEdgeMesh {
  return MeshBuilder.createCube(1, 1, 1);
}

export function subdividedCubeMesh(): HalfEdgeMesh {
  const ids = createSequenceIdFactory("subdiv-cube");
  const mesh = MeshBuilder.createCube(1, 1, 1, ids.mesh());
  subdivideFaces(mesh, [...mesh.faces.keys()], ids);
  return mesh;
}

export function concaveNgonMesh(): HalfEdgeMesh {
  const builder = new MeshBuilder();
  const v0 = builder.addVertex(0, 0, 0);
  const v1 = builder.addVertex(2, 0, 0);
  const v2 = builder.addVertex(2, 1, 0);
  const v3 = builder.addVertex(1, 1, 0);
  const v4 = builder.addVertex(1, 2, 0);
  const v5 = builder.addVertex(0, 2, 0);
  builder.addFace([v0, v1, v2, v3, v4, v5]);
  return builder.getMesh();
}

export function cylinderMesh(): HalfEdgeMesh {
  return MeshBuilder.createCylinder(0.5, 1, 8);
}

export function uvSphereMesh(): HalfEdgeMesh {
  return generateUvSphere({ radius: 0.5, widthSegments: 8, heightSegments: 6 }).mesh;
}

export function quadSphereMesh(): HalfEdgeMesh {
  return generateQuadSphere({ radius: 0.5, segments: 2 }).mesh;
}

export function torusMesh(): HalfEdgeMesh {
  return generateTorus({ radius: 0.5, tube: 0.15, radialSegments: 8, tubularSegments: 10 }).mesh;
}

export function capsuleMesh(): HalfEdgeMesh {
  return generateCapsule().mesh;
}

export function disconnectedMesh(): HalfEdgeMesh {
  const builder = new MeshBuilder();
  const a0 = builder.addVertex(0, 0, 0);
  const a1 = builder.addVertex(1, 0, 0);
  const a2 = builder.addVertex(0, 1, 0);
  builder.addFace([a0, a1, a2]);
  const b0 = builder.addVertex(4, 0, 0);
  const b1 = builder.addVertex(5, 0, 0);
  const b2 = builder.addVertex(4, 1, 0);
  builder.addFace([b0, b1, b2]);
  return builder.getMesh();
}

export function twoQuadMesh(): HalfEdgeMesh {
  const builder = new MeshBuilder();
  const v0 = builder.addVertex(0, 0, 0);
  const v1 = builder.addVertex(1, 0, 0);
  const v2 = builder.addVertex(1, 1, 0);
  const v3 = builder.addVertex(0, 1, 0);
  const v4 = builder.addVertex(2, 0, 0);
  const v5 = builder.addVertex(2, 1, 0);
  builder.addFace([v0, v1, v2, v3]);
  builder.addFace([v1, v4, v5, v2]);
  return builder.getMesh();
}

export function topologyFingerprint(mesh: HalfEdgeMesh): { vertices: number; faces: number; edges: number } {
  return { vertices: mesh.vertices.size, faces: mesh.faces.size, edges: mesh.edges.size };
}

export function canonicalSnapshot(mesh: HalfEdgeMesh) {
  return {
    vertexIds: [...mesh.vertices.keys()],
    edgeIds: [...mesh.edges.keys()],
    faceIds: [...mesh.faces.keys()],
    cornerIds: [...mesh.corners.keys()],
    halfEdges: [...mesh.halfEdges.values()].map((he) => ({
      id: he.id,
      next: he.next,
      prev: he.prev,
      twin: he.twin,
      origin: he.origin,
      face: he.face,
      edgeId: he.edgeId,
      corner: he.corner,
    })),
    faceLoops: [...mesh.faces.keys()].map((id) => mesh.getFaceVertices(id)),
    materials: [...mesh.faces.values()].map((face) => ({
      id: face.id,
      materialSlot: face.materialSlot,
      materialSlotId: face.materialSlotId ?? null,
    })),
    normals: [...mesh.corners.values()].map((corner) => ({
      id: corner.id,
      normal: corner.normal ? [...corner.normal] : undefined,
    })),
    positions: [...mesh.vertices.values()].map((vertex) => ({
      id: vertex.id,
      position: [...vertex.position],
    })),
  };
}
