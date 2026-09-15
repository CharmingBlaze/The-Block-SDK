export interface DocumentRevisions {
  document: number;
  hierarchy: number;
  transforms: number;
  topology: number;
  positions: number;
  normals: number;
  uv: number;
  seams: number;
  materials: number;
  textureBindings: number;
  imagePixels: number;
  layerStructure: number;
  selection: number;
}

export function emptyDocumentRevisions(): DocumentRevisions {
  return {
    document: 0,
    hierarchy: 0,
    transforms: 0,
    topology: 0,
    positions: 0,
    normals: 0,
    uv: 0,
    seams: 0,
    materials: 0,
    textureBindings: 0,
    imagePixels: 0,
    layerStructure: 0,
    selection: 0,
  };
}

export interface MeshRevisions {
  topology: number;
  positions: number;
  normals: number;
  uv: number;
  seams: number;
  pins: number;
  materials: number;
}

export function emptyMeshRevisions(): MeshRevisions {
  return {
    topology: 0,
    positions: 0,
    normals: 0,
    uv: 0,
    seams: 0,
    pins: 0,
    materials: 0,
  };
}
