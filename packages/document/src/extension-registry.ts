import type { Disposable } from "@modeling-kit/core";
import type { ModelDocument } from "./types";

export interface SceneNodeExtensionDefinition {
  readonly typeId: string;
}

const registries = new WeakMap<ModelDocument, SceneNodeExtensionRegistry>();

export class SceneNodeExtensionRegistry implements Disposable {
  private readonly types = new Map<string, SceneNodeExtensionDefinition>();
  private registryDisposed = false;

  get disposed(): boolean {
    return this.registryDisposed;
  }

  has(typeId: string): boolean {
    return this.types.has(typeId);
  }

  register(typeId: string): void {
    this.assertAlive();
    this.types.set(typeId, { typeId });
  }

  unregister(typeId: string): void {
    this.assertAlive();
    this.types.delete(typeId);
  }

  dispose(): void {
    this.types.clear();
    this.registryDisposed = true;
  }

  private assertAlive(): void {
    if (this.registryDisposed) {
      throw new Error("SceneNodeExtensionRegistry is disposed");
    }
  }
}

export function sceneNodeExtensions(document: ModelDocument): SceneNodeExtensionRegistry {
  let registry = registries.get(document);
  if (!registry || registry.disposed) {
    registry = new SceneNodeExtensionRegistry();
    registries.set(document, registry);
  }
  return registry;
}

export function registerSceneNodeExtension(document: ModelDocument, typeId: string): void {
  sceneNodeExtensions(document).register(typeId);
}
