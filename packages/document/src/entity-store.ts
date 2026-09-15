import type { Brand } from "@modeling-kit/core";

export class EntityStore<T extends { readonly id: Brand<string, string> }> {
  private readonly items = new Map<T["id"], T>();
  revision = 0;

  get size(): number {
    return this.items.size;
  }

  get(id: T["id"]): T | undefined {
    return this.items.get(id);
  }

  has(id: T["id"]): boolean {
    return this.items.has(id);
  }

  values(): IterableIterator<T> {
    return this.items.values();
  }

  keys(): IterableIterator<T["id"]> {
    return this.items.keys();
  }

  entries(): IterableIterator<[T["id"], T]> {
    return this.items.entries();
  }

  sizeOf(): number {
    return this.items.size;
  }

  add(entity: T): void {
    if (this.items.has(entity.id)) {
      throw new RangeError(`EntityStore: duplicate id ${String(entity.id)}`);
    }
    this.items.set(entity.id, entity);
    this.revision += 1;
  }

  replace(id: T["id"], entity: T): void {
    if (!this.items.has(id)) {
      throw new RangeError(`EntityStore: missing ${String(id)}`);
    }
    this.items.set(id, { ...entity, id } as T);
    this.revision += 1;
  }

  set(entity: T): void;
  set(id: T["id"], entity: T): void;
  set(entityOrId: T | T["id"], maybeEntity?: T): void {
    if (maybeEntity !== undefined) {
      this.items.set(entityOrId as T["id"], maybeEntity);
    } else {
      const entity = entityOrId as T;
      this.items.set(entity.id, entity);
    }
    this.revision += 1;
  }

  require(id: T["id"]): T {
    const entity = this.items.get(id);
    if (!entity) {
      throw new RangeError(`EntityStore: missing ${String(id)}`);
    }
    return entity;
  }

  update(id: T["id"], patch: Omit<Partial<T>, "id">): T {
    const current = this.require(id);
    const next = { ...current, ...patch, id: current.id } as T;
    this.set(next);
    return next;
  }

  remove(id: T["id"]): T {
    const current = this.require(id);
    this.delete(id);
    return current;
  }

  delete(id: T["id"]): boolean {
    const existed = this.items.delete(id);
    if (existed) {
      this.revision += 1;
    }
    return existed;
  }

  clear(): void {
    if (this.items.size === 0) {
      return;
    }
    this.items.clear();
    this.revision += 1;
  }

  clone(): EntityStore<T> {
    const store = new EntityStore<T>();
    for (const [id, entity] of this.items) {
      store.items.set(id, entity);
    }
    store.revision = this.revision;
    return store;
  }

  toJSON(): EntityStoreJson<T> {
    const list = [...this.items.values()].sort((a, b) =>
      (a.id as string).localeCompare(b.id as string),
    );
    return { revision: this.revision, items: list };
  }

  static fromJSON<T extends { readonly id: Brand<string, string> }>(
    raw: EntityStoreJson<T>,
  ): EntityStore<T> {
    const store = new EntityStore<T>();
    for (const item of raw.items) {
      store.items.set(item.id, item);
    }
    store.revision = raw.revision;
    return store;
  }
}

export interface EntityStoreJson<T> {
  readonly revision: number;
  readonly items: readonly T[];
}
