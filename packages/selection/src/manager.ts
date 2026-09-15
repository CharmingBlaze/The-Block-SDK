import type { ObjectId } from "@modeling-kit/core";
import type { HalfEdgeMesh } from "@modeling-kit/mesh";
import {
  allElementIds,
  boundaryElementIds,
  edgeLoopIds,
  edgeRingIds,
  growElementIds,
  invertElementIds,
  linkedElementIds,
  shrinkElementIds,
  boxSelectIds,
  lassoSelectIds,
  coplanarFaceIds,
  similarMaterialFaceIds,
  type ScreenSelectOptions,
} from "./topology";

import type { SelectionDomain, SelectionSnapshot } from "./types";
export type { SelectionDomain, SelectionSnapshot };

export interface ReplaceSelectionInput {
  readonly domain: SelectionDomain;
  readonly objectId?: ObjectId;
  readonly objectIds?: readonly ObjectId[];
  readonly elementIds?: readonly string[];
  readonly activeId?: string | null;
}

export interface IdRemap {
  readonly map: ReadonlyMap<string, string>;
  readonly deleted?: ReadonlySet<string>;
}

export type SelectionChangeListener = (snapshot: SelectionSnapshot) => void;

export class SelectionManager {
  domain: SelectionDomain = "none";
  objectIds: ObjectId[] = [];
  elementIds: string[] = [];
  activeId: string | null = null;
  private readonly listeners = new Set<SelectionChangeListener>();

  snapshot(): SelectionSnapshot {
    return {
      domain: this.domain,
      objectIds: [...this.objectIds],
      elementIds: [...this.elementIds],
      activeId: this.activeId,
    };
  }

  onChange(listener: SelectionChangeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  restore(snapshot: SelectionSnapshot): void {
    this.domain = snapshot.domain;
    this.objectIds = [...snapshot.objectIds];
    this.elementIds = [...snapshot.elementIds];
    this.activeId = snapshot.activeId;
    this.notify();
  }

  clear(): void {
    this.domain = "none";
    this.objectIds = [];
    this.elementIds = [];
    this.activeId = null;
    this.notify();
  }

  replace(input: ReplaceSelectionInput): void {
    const objectIds = input.objectIds ?? (input.objectId ? [input.objectId] : []);
    this.domain = input.domain;
    this.objectIds = [...objectIds];
    this.elementIds = [...(input.elementIds ?? [])];
    this.activeId = input.activeId ?? this.elementIds[0] ?? this.objectIds[0] ?? null;
    this.notify();
  }

  add(ids: readonly string[]): void {
    if (ids.length === 0 || this.domain === "none") {
      return;
    }
    const set = new Set(this.selectedIds());
    for (const id of ids) {
      set.add(id);
    }
    this.writeSelectedIds([...set]);
    this.activeId = ids[ids.length - 1] ?? this.activeId;
    this.notify();
  }

  remove(ids: readonly string[]): void {
    if (ids.length === 0 || this.domain === "none") {
      return;
    }
    const drop = new Set(ids);
    const next = this.selectedIds().filter((id) => !drop.has(id));
    this.writeSelectedIds(next);
    if (this.activeId && drop.has(this.activeId)) {
      this.activeId = next[0] ?? null;
    }
    this.notify();
  }

  toggle(id: string): void {
    if (this.domain === "none") {
      return;
    }
    if (this.selectedIds().includes(id)) {
      this.remove([id]);
    } else {
      this.add([id]);
    }
  }

  invert(mesh: HalfEdgeMesh): void {
    if (!this.isMeshDomain()) {
      return;
    }
    this.replaceElements(invertElementIds(mesh, this.snapshot()));
  }

  selectAll(mesh: HalfEdgeMesh): void {
    if (!this.isMeshDomain()) {
      return;
    }
    this.replaceElements(allElementIds(mesh, this.snapshot()));
  }

  grow(mesh: HalfEdgeMesh): void {
    if (!this.isMeshDomain()) {
      return;
    }
    this.replaceElements(growElementIds(mesh, this.snapshot()));
  }

  shrink(mesh: HalfEdgeMesh): void {
    if (!this.isMeshDomain()) {
      return;
    }
    this.replaceElements(shrinkElementIds(mesh, this.snapshot()));
  }

  selectLinked(mesh: HalfEdgeMesh): void {
    if (!this.isMeshDomain()) {
      return;
    }
    this.replaceElements(linkedElementIds(mesh, this.snapshot()));
  }

  selectEdgeLoop(mesh: HalfEdgeMesh): void {
    if (this.domain !== "edge") {
      return;
    }
    this.replaceElements(edgeLoopIds(mesh, this.snapshot()));
  }

  selectEdgeRing(mesh: HalfEdgeMesh): void {
    if (this.domain !== "edge") {
      return;
    }
    this.replaceElements(edgeRingIds(mesh, this.snapshot()));
  }

  selectBoundary(mesh: HalfEdgeMesh): void {
    if (!this.isMeshDomain()) {
      return;
    }
    this.replaceElements(boundaryElementIds(mesh, this.snapshot()));
  }

  selectCoplanar(mesh: HalfEdgeMesh): void {
    if (this.domain !== "face") {
      return;
    }
    this.replaceElements(coplanarFaceIds(mesh, this.snapshot()));
  }

  selectSimilarMaterial(mesh: HalfEdgeMesh): void {
    if (this.domain !== "face") {
      return;
    }
    this.replaceElements(similarMaterialFaceIds(mesh, this.snapshot()));
  }

  selectBox(
    mesh: HalfEdgeMesh,
    minX: number,
    minY: number,
    maxX: number,
    maxY: number,
    options: ScreenSelectOptions,
  ): void {
    if (!this.isMeshDomain()) {
      return;
    }
    this.replaceElements(boxSelectIds(mesh, this.snapshot(), minX, minY, maxX, maxY, options));
  }

  selectLasso(
    mesh: HalfEdgeMesh,
    polygon: readonly (readonly [number, number])[],
    options: ScreenSelectOptions,
  ): void {
    if (!this.isMeshDomain()) {
      return;
    }
    this.replaceElements(lassoSelectIds(mesh, this.snapshot(), polygon, options));
  }

  applyRemap(remap: IdRemap): void {
    const remapList = (ids: readonly string[]): string[] => {
      const next: string[] = [];
      for (const id of ids) {
        if (remap.deleted?.has(id)) {
          continue;
        }
        next.push(remap.map.get(id) ?? id);
      }
      return [...new Set(next)];
    };
    this.objectIds = remapList(this.objectIds) as ObjectId[];
    this.elementIds = remapList(this.elementIds);
    const selected = this.selectedIds();
    if (this.activeId && remap.deleted?.has(this.activeId)) {
      this.activeId = selected[0] ?? null;
    } else if (this.activeId && remap.map.has(this.activeId)) {
      this.activeId = remap.map.get(this.activeId) ?? null;
    }
    this.notify();
  }

  dispose(): void {
    this.listeners.clear();
    this.elementIds = [];
    this.objectIds = [];
    this.activeId = null;
    this.domain = "none";
  }

  private isMeshDomain(): boolean {
    return this.domain === "vertex" || this.domain === "edge" || this.domain === "face";
  }

  private selectedIds(): string[] {
    return this.domain === "object" ? this.objectIds : this.elementIds;
  }

  private writeSelectedIds(ids: readonly string[]): void {
    if (this.domain === "object") {
      this.objectIds = [...ids] as ObjectId[];
      return;
    }
    this.elementIds = [...ids];
  }

  private replaceElements(elementIds: readonly string[]): void {
    this.elementIds = [...elementIds];
    this.activeId = this.elementIds.includes(this.activeId ?? "")
      ? this.activeId
      : (this.elementIds[0] ?? null);
    this.notify();
  }

  private notify(): void {
    const snapshot = this.snapshot();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }
}
