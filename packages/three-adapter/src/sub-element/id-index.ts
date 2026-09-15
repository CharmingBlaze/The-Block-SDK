export class IdIndexMap<T extends string = string> {
  private ids: T[] = [];
  private index = new Map<string, number>();
  private generation = 0;

  get size(): number {
    return this.ids.length;
  }

  get revision(): number {
    return this.generation;
  }

  getId(index: number): T | undefined {
    return this.ids[index];
  }

  getIndex(id: string): number | undefined {
    return this.index.get(id);
  }

  rebuild(ids: Iterable<T>): boolean {
    const next: T[] = [];
    const nextIndex = new Map<string, number>();
    let i = 0;
    for (const id of ids) {
      next.push(id);
      nextIndex.set(id, i);
      i += 1;
    }
    if (sameMap(this.ids, next)) {
      return false;
    }
    this.ids = next;
    this.index = nextIndex;
    this.generation += 1;
    return true;
  }

  pruneMissing(live: ReadonlySet<string>): string[] {
    const removed: string[] = [];
    for (const id of this.ids) {
      if (!live.has(id)) {
        removed.push(id);
      }
    }
    if (removed.length === 0) {
      return removed;
    }
    this.rebuild(this.ids.filter((id) => live.has(id)));
    return removed;
  }
}

function sameMap<T>(a: readonly T[], b: readonly T[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}
