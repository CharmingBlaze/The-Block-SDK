import type { EdgeId, FaceId, VertexId } from "@modeling-kit/core";
import type { HalfEdgeMesh } from "@modeling-kit/mesh";
import {
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
  Points,
  PointsMaterial,
  type Object3D,
} from "three";
import type { RenderMapping } from "./geometry";

export interface OverlayBuildInput {
  readonly domain: "object" | "face" | "edge" | "vertex";
  readonly elementIds: readonly string[];
  readonly kernel: HalfEdgeMesh;
  readonly geometry: BufferGeometry;
  readonly mapping: RenderMapping;
}

const FACE_COLOR = 0xffcc44;
const EDGE_COLOR = 0xffee88;
const VERTEX_COLOR = 0xffffff;

export function buildSelectionOverlay(input: OverlayBuildInput): Object3D | null {
  if (input.domain === "face") {
    return buildFaceOverlay(input);
  }
  if (input.domain === "edge") {
    return buildEdgeOverlay(input.kernel, input.elementIds as EdgeId[]);
  }
  if (input.domain === "vertex") {
    return buildVertexOverlay(input.kernel, input.elementIds as VertexId[]);
  }
  return buildObjectWireOverlay(input.kernel);
}

function markOverlay(object: Object3D): void {
  object.userData.isOverlay = true;
  object.name = "selection-overlay";
}

function buildFaceOverlay(input: OverlayBuildInput): Object3D | null {
  const selected = new Set(input.elementIds as FaceId[]);
  if (selected.size === 0) {
    return null;
  }
  const position = input.geometry.getAttribute("position");
  const index = input.geometry.getIndex();
  if (!position) {
    return null;
  }
  const positions: number[] = [];
  for (let tri = 0; tri < input.mapping.triangleToFace.length; tri++) {
    if (!selected.has(input.mapping.triangleToFace[tri]!)) {
      continue;
    }
    for (let k = 0; k < 3; k++) {
      const vertexIndex = index ? index.getX(tri * 3 + k) : tri * 3 + k;
      positions.push(position.getX(vertexIndex), position.getY(vertexIndex), position.getZ(vertexIndex));
    }
  }
  if (positions.length === 0) {
    return null;
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
  const material = new MeshStandardMaterial({
    color: FACE_COLOR,
    emissive: 0x442200,
    transparent: true,
    opacity: 0.45,
    side: DoubleSide,
    depthTest: true,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const mesh = new Mesh(geometry, material);
  markOverlay(mesh);
  mesh.userData.overlayKind = "face";
  mesh.userData.triangleCount = positions.length / 9;
  return mesh;
}

function buildEdgeOverlay(mesh: HalfEdgeMesh, edgeIds: readonly EdgeId[]): Object3D | null {
  if (edgeIds.length === 0) {
    return null;
  }
  const positions: number[] = [];
  for (const edgeId of edgeIds) {
    const verts = mesh.getEdgeVertices(edgeId);
    if (!verts) {
      continue;
    }
    const a = mesh.vertices.get(verts[0]);
    const b = mesh.vertices.get(verts[1]);
    if (!a || !b) {
      continue;
    }
    positions.push(a.position[0], a.position[1], a.position[2], b.position[0], b.position[1], b.position[2]);
  }
  if (positions.length === 0) {
    return null;
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
  const material = new LineBasicMaterial({ color: EDGE_COLOR, depthTest: true });
  const lines = new LineSegments(geometry, material);
  markOverlay(lines);
  lines.userData.overlayKind = "edge";
  lines.userData.segmentCount = positions.length / 6;
  return lines;
}

function buildVertexOverlay(mesh: HalfEdgeMesh, vertexIds: readonly VertexId[]): Object3D | null {
  if (vertexIds.length === 0) {
    return null;
  }
  const positions: number[] = [];
  for (const vertexId of vertexIds) {
    const vertex = mesh.vertices.get(vertexId);
    if (!vertex) {
      continue;
    }
    positions.push(vertex.position[0], vertex.position[1], vertex.position[2]);
  }
  if (positions.length === 0) {
    return null;
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
  const material = new PointsMaterial({ color: VERTEX_COLOR, size: 8, sizeAttenuation: false, depthTest: true });
  const points = new Points(geometry, material);
  markOverlay(points);
  points.userData.overlayKind = "vertex";
  points.userData.pointCount = positions.length / 3;
  return points;
}

function buildObjectWireOverlay(mesh: HalfEdgeMesh): Object3D | null {
  const positions: number[] = [];
  for (const edgeId of mesh.edges.keys()) {
    const verts = mesh.getEdgeVertices(edgeId);
    if (!verts) {
      continue;
    }
    const a = mesh.vertices.get(verts[0]);
    const b = mesh.vertices.get(verts[1]);
    if (!a || !b) {
      continue;
    }
    positions.push(a.position[0], a.position[1], a.position[2], b.position[0], b.position[1], b.position[2]);
  }
  if (positions.length === 0) {
    return null;
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
  const material = new LineBasicMaterial({ color: FACE_COLOR, depthTest: true });
  const lines = new LineSegments(geometry, material);
  markOverlay(lines);
  lines.userData.overlayKind = "object";
  return lines;
}

export function disposeOverlayObject(object: Object3D): void {
  object.removeFromParent();
  object.traverse((child) => {
    const mesh = child as Mesh;
    mesh.geometry?.dispose();
    const material = mesh.material;
    if (Array.isArray(material)) {
      for (const item of material) {
        item.dispose();
      }
    } else {
      material?.dispose();
    }
  });
}
