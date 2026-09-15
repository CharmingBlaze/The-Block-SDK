import type { ModelDocument } from "@modeling-kit/document";
import type { MaterialId, MaterialInstanceId } from "@modeling-kit/core";
import type {
  MaterialDefinition,
  MaterialInstance,
  MaterialSlotTarget,
  StandardPBRMaterial,
  UnlitMaterial,
} from "./types";
import { assertValidMaterial } from "./validation";
import {
  documentInstanceToLibrary,
  libraryInstanceToDocument,
  materialDataToDefinition,
  materialDefinitionToData,
} from "./convert";

interface CacheEntry {
  readonly parentRevision: number;
  readonly instanceRevision: number;
  readonly resolved: MaterialDefinition;
}

export class MaterialLibrary {
  private readonly materials = new Map<MaterialId, { data: MaterialDefinition; revision: number }>();
  private readonly instances = new Map<MaterialInstanceId, { data: MaterialInstance; revision: number }>();
  private readonly cache = new Map<MaterialInstanceId, CacheEntry>();
  private revision = 0;
  private document: ModelDocument | null = null;

  static fromDocument(document: ModelDocument): MaterialLibrary {
    const library = new MaterialLibrary();
    library.attachDocument(document);
    return library;
  }

  attachDocument(document: ModelDocument): void {
    this.document = document;
    this.clear(false);
    for (const data of document.materials.values()) {
      this.materials.set(data.id, { data: materialDataToDefinition(data), revision: 1 });
    }
    for (const instance of document.materialInstances.values()) {
      this.instances.set(instance.id, { data: documentInstanceToLibrary(instance), revision: 1 });
    }
  }

  get revisionNumber(): number {
    return this.revision;
  }

  addMaterial(material: MaterialDefinition): void {
    assertValidMaterial(material);
    const existing = this.materials.get(material.id);
    const rev = existing ? existing.revision + 1 : 1;
    this.materials.set(material.id, { data: material, revision: rev });
    this.revision += 1;
    this.document?.materials.set(materialDefinitionToData(material));
    // Invalidate any instances pointing to this material
    for (const [instId, inst] of this.instances.entries()) {
      if (inst.data.parentMaterialId === material.id) {
        this.cache.delete(instId);
      }
    }
  }

  getMaterial(id: MaterialId): MaterialDefinition | undefined {
    return this.materials.get(id)?.data;
  }

  hasMaterial(id: MaterialId): boolean {
    return this.materials.has(id);
  }

  deleteMaterial(id: MaterialId): boolean {
    const existed = this.materials.delete(id);
    if (existed) {
      this.revision += 1;
      this.document?.materials.delete(id);
      // Invalidate cache for dependent instances
      for (const [instId, inst] of this.instances.entries()) {
        if (inst.data.parentMaterialId === id) {
          this.cache.delete(instId);
        }
      }
    }
    return existed;
  }

  addInstance(instance: MaterialInstance): void {
    if (!instance.id) {
      throw new RangeError("MaterialInstance must have an id");
    }
    if (!this.materials.has(instance.parentMaterialId)) {
      throw new RangeError(
        `MaterialInstance '${instance.id}' references non-existent parent material '${instance.parentMaterialId}'`,
      );
    }
    const existing = this.instances.get(instance.id);
    const rev = existing ? existing.revision + 1 : 1;
    this.instances.set(instance.id, { data: instance, revision: rev });
    this.cache.delete(instance.id);
    this.revision += 1;
    this.document?.materialInstances.set(libraryInstanceToDocument(instance));
  }

  getInstance(id: MaterialInstanceId): MaterialInstance | undefined {
    return this.instances.get(id)?.data;
  }

  hasInstance(id: MaterialInstanceId): boolean {
    return this.instances.has(id);
  }

  deleteInstance(id: MaterialInstanceId): boolean {
    const existed = this.instances.delete(id);
    if (existed) {
      this.cache.delete(id);
      this.revision += 1;
      this.document?.materialInstances.delete(id);
    }
    return existed;
  }

  resolve(target: MaterialSlotTarget | MaterialId | MaterialInstanceId): MaterialDefinition | undefined {
    if (typeof target === "object") {
      if (target.type === "material") {
        return this.getMaterial(target.materialId);
      }
      return this.resolveInstance(target.materialInstanceId);
    }
    // String ID
    const mat = this.getMaterial(target as MaterialId);
    if (mat) {
      return mat;
    }
    return this.resolveInstance(target as MaterialInstanceId);
  }

  private resolveInstance(id: MaterialInstanceId): MaterialDefinition | undefined {
    const instEntry = this.instances.get(id);
    if (!instEntry) {
      return undefined;
    }
    const parentEntry = this.materials.get(instEntry.data.parentMaterialId);
    if (!parentEntry) {
      throw new RangeError(
        `Cannot resolve MaterialInstance '${id}': parent material '${instEntry.data.parentMaterialId}' is missing`,
      );
    }

    const cached = this.cache.get(id);
    if (
      cached &&
      cached.parentRevision === parentEntry.revision &&
      cached.instanceRevision === instEntry.revision
    ) {
      return cached.resolved;
    }

    const parent = parentEntry.data;
    const overrides = instEntry.data.overrides;

    let resolved: MaterialDefinition;
    if (parent.type === "standard-pbr") {
      resolved = {
        ...parent,
        ...(overrides as Partial<StandardPBRMaterial>),
        id: parent.id, // Keeps parent ID or identifies base definition
        type: "standard-pbr",
        name: `${parent.name} (Instance: ${instEntry.data.name})`,
        metadata: {
          ...parent.metadata,
          ...(instEntry.data.metadata ?? {}),
          instanceId: id,
        },
      };
    } else {
      resolved = {
        ...parent,
        ...(overrides as Partial<UnlitMaterial>),
        id: parent.id,
        type: "unlit",
        name: `${parent.name} (Instance: ${instEntry.data.name})`,
        metadata: {
          ...parent.metadata,
          ...(instEntry.data.metadata ?? {}),
          instanceId: id,
        },
      };
    }

    assertValidMaterial(resolved);
    this.cache.set(id, {
      parentRevision: parentEntry.revision,
      instanceRevision: instEntry.revision,
      resolved,
    });

    return resolved;
  }

  clear(resetDocument = true): void {
    this.materials.clear();
    this.instances.clear();
    this.cache.clear();
    this.revision += 1;
    if (resetDocument && this.document) {
      this.document.materials.clear();
      this.document.materialInstances.clear();
    }
  }

  listMaterials(): readonly MaterialDefinition[] {
    return [...this.materials.values()].map((e) => e.data);
  }

  listInstances(): readonly MaterialInstance[] {
    return [...this.instances.values()].map((e) => e.data);
  }
}
