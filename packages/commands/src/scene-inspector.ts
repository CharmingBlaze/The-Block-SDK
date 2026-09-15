import { brand, type FaceId, type ObjectId } from "@modeling-kit/core";
import { faceNormal } from "@modeling-kit/mesh";
import { validateMesh } from "@modeling-kit/validation";
import { matchingFaceTags, parseFaceGroups } from "./face-groups";
import type { ModelingSession } from "./session";

export interface SelectedSummary {
  readonly domain: "object" | "face" | "edge" | "vertex";
  readonly count: number;
  readonly tags: readonly string[];
  readonly elementIds: readonly string[];
  readonly normal?: readonly [number, number, number];
}

export interface ObjectSummary {
  readonly id: ObjectId;
  readonly name: string;
  readonly type: string;
  readonly vertices: number;
  readonly faces: number;
  readonly isClosedManifold: boolean;
  readonly boundingBox: {
    readonly min: readonly [number, number, number];
    readonly max: readonly [number, number, number];
  };
  readonly issues: readonly { readonly code: string; readonly message: string }[];
  readonly selected?: SelectedSummary;
}

export interface SceneInspectionResult {
  readonly totalObjects: number;
  readonly activeObjectId?: ObjectId;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly objects: readonly ObjectSummary[];
  /** One-line telemetry for logs and LLM tool results. */
  readonly summary: string;
}

/** Compact structured scene summary for AI agents and headless debugging. */
export function inspectScene(session: ModelingSession): SceneInspectionResult {
  const objects: ObjectSummary[] = [];
  const sel = session.selection;

  for (const node of session.document.scene.nodes.values()) {
    if (node.id === session.document.scene.rootNodeId) {
      continue;
    }

    let vertices = 0;
    let faces = 0;
    let isClosedManifold = false;
    let min: [number, number, number] = [Infinity, Infinity, Infinity];
    let max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
    const issues: { code: string; message: string }[] = [];

    const meshId = node.payloadRef ? brand<string, "MeshId">(node.payloadRef) : undefined;
    const mesh = meshId ? session.meshes.get(meshId) : undefined;
    const record = meshId ? session.document.meshes.get(meshId) : undefined;
    const groups = record ? parseFaceGroups(record.metadata) : undefined;

    if (mesh) {
      vertices = mesh.vertices.size;
      faces = mesh.faces.size;
      const val = validateMesh(mesh);
      isClosedManifold = val.statistics.isManifold && val.statistics.isClosed;
      for (const issue of [...val.errors, ...val.warnings]) {
        issues.push({ code: issue.code, message: issue.message });
      }
      for (const v of mesh.vertices.values()) {
        const [x, y, z] = v.position;
        if (x < min[0]) min[0] = x;
        if (y < min[1]) min[1] = y;
        if (z < min[2]) min[2] = z;
        if (x > max[0]) max[0] = x;
        if (y > max[1]) max[1] = y;
        if (z > max[2]) max[2] = z;
      }
    }

    if (min[0] === Infinity) {
      min = [0, 0, 0];
      max = [0, 0, 0];
    }

    const isComponentDomain =
      sel.domain === "object" || sel.domain === "face" || sel.domain === "edge" || sel.domain === "vertex";
    const isSelected = isComponentDomain && sel.objectIds.includes(node.id);
    let selected: SelectedSummary | undefined;
    if (isSelected) {
      let normal: [number, number, number] | undefined;
      if (mesh && sel.domain === "face" && sel.elementIds.length > 0) {
        let nx = 0;
        let ny = 0;
        let nz = 0;
        let counted = 0;
        for (const fId of sel.elementIds) {
          const faceId = fId as FaceId;
          if (mesh.faces.has(faceId)) {
            const norm = faceNormal(mesh, faceId);
            nx += norm.x;
            ny += norm.y;
            nz += norm.z;
            counted += 1;
          }
        }
        if (counted > 0) {
          const len = Math.hypot(nx, ny, nz) || 1;
          normal = [nx / len, ny / len, nz / len];
        }
      }
      const tags = sel.domain === "face" ? matchingFaceTags(groups, sel.elementIds) : [];
      selected = {
        domain: sel.domain as "object" | "face" | "edge" | "vertex",
        count: sel.elementIds.length > 0 ? sel.elementIds.length : 1,
        tags,
        elementIds: sel.elementIds.length > 0 ? [...sel.elementIds] : [node.id],
        ...(normal ? { normal } : {}),
      };
    }

    objects.push({
      id: node.id as ObjectId,
      name: node.name,
      type: node.type,
      vertices,
      faces,
      isClosedManifold,
      boundingBox: { min, max },
      issues,
      ...(selected ? { selected } : {}),
    });
  }

  const result: SceneInspectionResult = {
    totalObjects: objects.length,
    ...(sel.objectIds[0] ? { activeObjectId: sel.objectIds[0] } : {}),
    canUndo: session.history.canUndo,
    canRedo: session.history.canRedo,
    objects,
    summary: "",
  };
  return { ...result, summary: formatInspectionSummary(result) };
}

function formatInspectionSummary(inspection: Omit<SceneInspectionResult, "summary">): string {
  const faces = inspection.objects.reduce((sum, object) => sum + object.faces, 0);
  const vertices = inspection.objects.reduce((sum, object) => sum + object.vertices, 0);
  const selected = inspection.objects.find((object) => object.selected)?.selected;
  const selectedText = selected
    ? `${selected.count} ${selected.domain}${selected.count === 1 ? "" : "s"}`
    : "none";
  const manifold = inspection.objects.every((object) => object.isClosedManifold || object.faces === 0);
  return `Objects: ${inspection.totalObjects} | Faces: ${faces} | Vertices: ${vertices} | Selected: ${selectedText} | Manifold: ${manifold} | Undo: ${inspection.canUndo}`;
}
